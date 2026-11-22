import type { UniverseInput, UPersonIn, URepoIn } from '../layout/universe';
import { RequestBudget } from './budget';
import { createGitHubClient } from './github';

/**
 * Who builds a repo, and what else they build. Costs 1 request for the contributors
 * plus 1 per contributor for their repos (about 13 without a token), and is cached in
 * localStorage for a day so revisits are free.
 */
export const PEOPLE_NO_TOKEN = 12;
export const PEOPLE_WITH_TOKEN = 24;
export const REPOS_PER_PERSON = 8;
const TTL = 24 * 60 * 60 * 1000;

interface ApiContributor {
  login: string;
  type: string;
  contributions: number;
  avatar_url: string;
}

interface ApiRepo {
  full_name: string;
  fork: boolean;
  archived?: boolean;
  stargazers_count: number;
  language: string | null;
  description: string | null;
}

/** Real people only (no bots), most active first. */
export function peopleFrom(list: ApiContributor[], max: number): UPersonIn[] {
  return list
    .filter((c) => c.type === 'User' && !c.login.endsWith('[bot]'))
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, max)
    .map((c) => ({ login: c.login, contributions: c.contributions, avatar: c.avatar_url }));
}

/** A person's own original projects (no forks, not the home repo), most starred first. */
export function reposFrom(list: ApiRepo[], owner: string, home: string): URepoIn[] {
  return list
    .filter((r) => !r.fork && !r.archived && r.full_name.toLowerCase() !== home.toLowerCase())
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, REPOS_PER_PERSON)
    .map((r) => ({
      fullName: r.full_name,
      stars: r.stargazers_count,
      language: r.language,
      description: r.description,
      owner,
    }));
}

function readCache(key: string): UniverseInput | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { savedAt: number; data: UniverseInput };
    return Date.now() - v.savedAt < TTL ? v.data : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: UniverseInput) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Storage full or blocked: the universe still works, it just isn't remembered.
  }
}

export async function fetchUniverse(
  home: UniverseInput['home'],
  opts: {
    token?: string | null;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<UniverseInput> {
  const key = `gitsky:universe:${home.fullName.toLowerCase()}`;
  const cached = readCache(key);
  if (cached) return { ...cached, home };

  const token = opts.token ?? undefined;
  const budget = new RequestBudget({ limit: token ? 5000 : 60 });
  const client = createGitHubClient({ budget, token, signal: opts.signal });
  await client.rateLimit(); // free; makes the budget exact
  const wanted = token ? PEOPLE_WITH_TOKEN : PEOPLE_NO_TOKEN;
  const contributors = await client.getJson<ApiContributor[]>(
    `/repos/${home.fullName}/contributors?per_page=${wanted + 8}`,
  );
  // Only ask about as many people as the remaining budget allows.
  const affordable = Math.max(0, budget.available() - 1);
  const people = peopleFrom(contributors, Math.min(wanted, affordable));
  const total = people.length + 1;
  let done = 1;
  opts.onProgress?.(done, total);

  const repos: URepoIn[] = [];
  const queue = [...people];
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      try {
        const list = await client.getJson<ApiRepo[]>(
          `/users/${encodeURIComponent(p.login)}/repos?sort=pushed&per_page=30`,
        );
        repos.push(...reposFrom(list, p.login, home.fullName));
      } catch (e) {
        if (opts.signal?.aborted) throw e;
        // One person's repos failing shouldn't sink the whole universe.
      }
      opts.onProgress?.(++done, total);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  // Stable order regardless of which request finished first.
  const order = new Map(people.map((p, i) => [p.login, i]));
  repos.sort((a, b) => order.get(a.owner)! - order.get(b.owner)! || b.stars - a.stars);
  const data = { home, people, repos };
  writeCache(key, data);
  return data;
}
