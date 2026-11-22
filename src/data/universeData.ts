import type { GEdge, GPerson, GRepo, GraphPatch, UGraph } from '../layout/universeGraph';
import { RequestBudget } from './budget';
import { createGitHubClient, type GitHubClient } from './github';

/**
 * Fetching the universe, one expansion at a time. Every GitHub response is cached in
 * localStorage for a day, so re-opening or re-expanding costs nothing, and an expansion
 * only pays for what isn't known yet. The request budget caps how far one click reaches.
 */
export const PEOPLE_NO_TOKEN = 12;
export const PEOPLE_WITH_TOKEN = 24;
export const REPOS_PER_PERSON = 8;
/** When expanding a person: how many of their projects we ask "who else builds this?". */
const COLLAB_REPOS = 3;
const COLLAB_PEOPLE = 6;
const TTL = 24 * 60 * 60 * 1000;

export interface ApiContributor {
  login: string;
  type: string;
  contributions: number;
  avatar_url: string;
}

export interface ApiRepo {
  full_name: string;
  fork: boolean;
  archived?: boolean;
  stargazers_count: number;
  language: string | null;
  description: string | null;
  pushed_at?: string | null;
  owner?: { login: string; avatar_url: string };
}

/** Real people only (no bots), most active first. */
export function peopleFrom(
  list: ApiContributor[],
  max: number,
): (GPerson & { contributions: number })[] {
  return list
    .filter((c) => c.type === 'User' && !c.login.endsWith('[bot]'))
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, max)
    .map((c) => ({ login: c.login, avatar: c.avatar_url, contributions: c.contributions }));
}

/** A person's own original projects (no forks or archives, not `exclude`), most starred first. */
export function reposFrom(list: ApiRepo[], exclude: string[] = []): GRepo[] {
  const skip = new Set(exclude.map((x) => x.toLowerCase()));
  return list
    .filter((r) => !r.fork && !r.archived && !skip.has(r.full_name.toLowerCase()))
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, REPOS_PER_PERSON)
    .map(toRepo);
}

export function toRepo(r: ApiRepo): GRepo {
  return {
    fullName: r.full_name,
    stars: r.stargazers_count,
    language: r.language,
    description: r.description,
    pushedAt: r.pushed_at ? Date.parse(r.pushed_at) : null,
  };
}

// ---------- the response cache -----------------------------------------------------

const cacheKey = (path: string) => `gitsky:gh:${path}`;

function readCache<T>(path: string): T | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(path));
    if (!raw) return undefined;
    const v = JSON.parse(raw) as { at: number; data: T };
    return Date.now() - v.at < TTL ? v.data : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(path: string, data: unknown) {
  try {
    localStorage.setItem(cacheKey(path), JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Full or blocked storage: it just won't be remembered.
  }
}

/** Is this path already cached (i.e. free)? */
export const isCached = (path: string) => readCache(path) !== undefined;

const contributorsPath = (full: string, n: number) =>
  `/repos/${full}/contributors?per_page=${n + 8}`;
const userReposPath = (login: string) =>
  `/users/${encodeURIComponent(login)}/repos?sort=pushed&per_page=30`;

// ---------- expansions -----------------------------------------------------------------

export interface ExpandContext {
  token?: string | null;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

async function session(ctx: ExpandContext) {
  const token = ctx.token ?? undefined;
  const budget = new RequestBudget({ limit: token ? 5000 : 60 });
  const client = createGitHubClient({ budget, token, signal: ctx.signal });
  await client.rateLimit(); // free; makes the budget exact
  const get = async <T>(path: string): Promise<T> => {
    const hit = readCache<T>(path);
    if (hit !== undefined) return hit;
    const data = await client.getJson<T>(path);
    writeCache(path, data);
    return data;
  };
  return { client, budget, get, peopleMax: token ? PEOPLE_WITH_TOKEN : PEOPLE_NO_TOKEN };
}

/** An expansion's result: the patch, plus how much of it the request budget cut short. */
export interface Expansion {
  patch: GraphPatch;
  /** People (or projects) we couldn't ask about this time. */
  missing: number;
  /** When the API budget resets (ms), if it ran out. */
  resetAt: number;
}

async function pool<T>(
  items: T[],
  work: (t: T) => Promise<void>,
  ctx: ExpandContext,
  done: { n: number; total: number },
) {
  const queue = [...items];
  let failed = 0;
  const worker = async () => {
    for (let x = queue.shift(); x !== undefined; x = queue.shift()) {
      try {
        await work(x);
      } catch (e) {
        if (ctx.signal?.aborted) throw e;
        // One failing request shouldn't sink the whole expansion; it's counted instead.
        failed++;
      }
      ctx.onProgress?.(++done.n, done.total);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return failed;
}

/** Who builds this project, and what else do they build? */
export async function expandRepo(g: UGraph, repo: GRepo, ctx: ExpandContext): Promise<Expansion> {
  const s = await session(ctx);
  const list = await s.get<ApiContributor[]>(contributorsPath(repo.fullName, s.peopleMax));
  const people = peopleFrom(list, s.peopleMax);
  // Only people we haven't explored, and only as many as the budget allows.
  const fresh = people.filter((p) => !g.expanded.has(`user:${p.login}`));
  const paid = fresh.filter((p) => !isCached(userReposPath(p.login)));
  const affordable = Math.max(0, s.budget.available() - 1);
  const explore = fresh.filter((p) => !paid.includes(p) || paid.indexOf(p) < affordable);
  const done = { n: 1, total: explore.length + 1 };
  ctx.onProgress?.(done.n, done.total);

  const home: GRepo = {
    fullName: repo.fullName,
    stars: repo.stars,
    language: repo.language,
    description: repo.description,
    pushedAt: repo.pushedAt,
  };
  const patch: GraphPatch = {
    repos: [home],
    people: people.map(({ login, avatar }) => ({ login, avatar })),
    edges: people.map<GEdge>((p) => ({
      person: p.login,
      repo: repo.fullName,
      kind: 'contributes',
      weight: p.contributions,
    })),
    expanded: [`repo:${repo.fullName}`],
  };
  const failed = await pool(
    explore,
    async (p) => {
      const repos = reposFrom(await s.get<ApiRepo[]>(userReposPath(p.login)), [repo.fullName]);
      patch.repos.push(...repos);
      patch.edges.push(
        ...repos.map<GEdge>((r) => ({
          person: p.login,
          repo: r.fullName,
          kind: 'owns',
          weight: 1,
        })),
      );
      patch.expanded.push(`user:${p.login}`);
    },
    ctx,
    done,
  );
  return {
    patch: sortPatch(patch),
    missing: fresh.length - explore.length + failed,
    resetAt: s.budget.state.resetAt,
  };
}

/** A person's own projects, and the people who build the biggest of them with them. */
export async function expandUser(login: string, ctx: ExpandContext): Promise<Expansion> {
  const s = await session(ctx);
  const raw = await s.get<ApiRepo[]>(userReposPath(login));
  const repos = reposFrom(raw);
  const avatar =
    raw[0]?.owner?.avatar_url ??
    `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?v=4`;
  const patch: GraphPatch = {
    repos,
    people: [{ login, avatar }],
    edges: repos.map<GEdge>((r) => ({ person: login, repo: r.fullName, kind: 'owns', weight: 1 })),
    expanded: [`user:${login}`],
  };
  const top = repos.slice(0, COLLAB_REPOS);
  const done = { n: 1, total: top.length + 1 };
  ctx.onProgress?.(done.n, done.total);
  const failed = await pool(
    top,
    async (r) => {
      const people = peopleFrom(
        await s.get<ApiContributor[]>(contributorsPath(r.fullName, COLLAB_PEOPLE)),
        COLLAB_PEOPLE,
      );
      patch.people.push(...people.map(({ login: l, avatar: a }) => ({ login: l, avatar: a })));
      patch.edges.push(
        ...people.map<GEdge>((p) => ({
          person: p.login,
          repo: r.fullName,
          kind: 'contributes',
          weight: p.contributions,
        })),
      );
      patch.expanded.push(`repo:${r.fullName}`);
    },
    ctx,
    done,
  );
  return { patch: sortPatch(patch), missing: failed, resetAt: s.budget.state.resetAt };
}

/** Stable order however the requests finished, so the layout is deterministic. */
function sortPatch(p: GraphPatch): GraphPatch {
  const by =
    <T>(f: (x: T) => string) =>
    (a: T, b: T) =>
      f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0;
  return {
    repos: [...p.repos].sort(by((r) => r.fullName)),
    people: [...p.people].sort(by((x) => x.login)),
    edges: [...p.edges].sort(by((e) => `${e.repo}|${e.person}|${e.kind}`)),
    expanded: [...p.expanded].sort(),
  };
}

/** Requests an expansion would spend, given what's cached (an upper bound). */
export function expansionCost(kind: 'repo' | 'user', id: string, token: boolean): number {
  if (kind === 'user') return isCached(userReposPath(id)) ? 0 : 1 + COLLAB_REPOS;
  const n = token ? PEOPLE_WITH_TOKEN : PEOPLE_NO_TOKEN;
  return (isCached(contributorsPath(id, n)) ? 0 : 1) + n;
}

export type { GitHubClient };
