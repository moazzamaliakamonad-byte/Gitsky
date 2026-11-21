import { planSampleSize, type RequestBudget } from './budget';
import { GitHubError, type GitHubClient } from './github';
import { capFiles, normalizeTree, type ApiTreeEntry } from './snapshot';
import type { Commit, FileEntry, Progress, RepoData, RepoMeta, RepoRef } from './types';

/**
 * The fetch pipeline, shared by the browser and scripts/snapshot.ts.
 *
 *   1. GET /repos/{o}/{r}                          meta, default branch      (1 call)
 *   2. GET /repos/{o}/{r}/commits?per_page=100     recent commits, head SHA  (1 call per 100)
 *   3. GET /repos/{o}/{r}/git/trees/{sha}?recursive=1   every file          (1 call)
 *   4. GET /repos/{o}/{r}/commits/{sha}            files touched             (1 call EACH)
 *
 * Step 4 is the expensive one, so the budget decides how many commits we sample.
 * We take the most recent N in a row (not a spread) so the timeline tells one
 * continuous story: "the last N commits".
 */

export interface LoadOptions {
  client: GitHubClient;
  budget: RequestBudget;
  /** Commit details we'd like (25 without a token, 300 with). */
  desiredSamples: number;
  onProgress?: (p: Progress) => void;
  /** Keep at most this many files (bundled snapshots). Default: no cap. */
  maxFiles?: number;
  concurrency?: number;
}

interface ApiRepo {
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  language: string | null;
  default_branch: string;
  html_url: string;
}

export interface ApiCommitListItem {
  sha: string;
  commit: { message: string; author: { name?: string; date?: string } | null };
  author: { login: string } | null;
}

interface ApiCommitDetail {
  sha: string;
  files?: { filename: string }[];
}

interface ApiTree {
  sha: string;
  truncated: boolean;
  tree: ApiTreeEntry[];
}

export interface RepoHead {
  meta: RepoMeta;
  branch: string;
  headSha: string;
  list: ApiCommitListItem[];
}

/** Steps 1–2: cheap. Enough to know the head SHA and check the cache. */
export async function fetchRepoHead(ref: RepoRef, opts: LoadOptions): Promise<RepoHead> {
  const { client, onProgress } = opts;
  const base = `/repos/${enc(ref.owner)}/${enc(ref.repo)}`;

  onProgress?.({ step: 'meta' });
  const r = await client.getJson<ApiRepo>(base);
  const meta: RepoMeta = {
    owner: r.owner.login,
    repo: r.name,
    fullName: r.full_name,
    description: r.description,
    stars: r.stargazers_count,
    language: r.language,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
  };
  const branch = ref.branch ?? meta.defaultBranch;

  onProgress?.({ step: 'commits' });
  const pages = Math.max(1, Math.ceil(Math.min(opts.desiredSamples, 300) / 100));
  const list: ApiCommitListItem[] = [];
  for (let page = 1; page <= pages; page++) {
    // After page 1, only fetch more if the budget can still pay for the tree.
    if (page > 1 && !opts.budget.canSpend(2)) break;
    const items = await client.getJson<ApiCommitListItem[]>(
      `${base}/commits?sha=${enc(branch)}&per_page=100&page=${page}`,
    );
    list.push(...items);
    if (items.length < 100) break;
  }
  if (list.length === 0)
    throw new GitHubError('empty', 'This repository is empty: no commits yet.');

  return { meta, branch, headSha: list[0].sha, list };
}

/** Steps 3–4: the tree and a budget-sized sample of commit details. */
export async function completeRepoLoad(head: RepoHead, opts: LoadOptions): Promise<RepoData> {
  const { client, budget, onProgress } = opts;
  const base = `/repos/${enc(head.meta.owner)}/${enc(head.meta.repo)}`;

  // Plan before the tree call so the tree is always paid for first.
  const sampleSize = planSampleSize({
    available: budget.available(),
    baseCalls: 1,
    desired: opts.desiredSamples,
    listed: head.list.length,
  });

  onProgress?.({ step: 'tree' });
  const tree = await client.getJson<ApiTree>(`${base}/git/trees/${head.headSha}?recursive=1`);
  let files: FileEntry[] = normalizeTree(tree.tree);

  // Most recent N commits. The list is newest-first.
  const picked = head.list.slice(0, sampleSize);
  const details = await fetchDetails(picked, base, opts, (done) =>
    onProgress?.({ step: 'details', done, total: picked.length }),
  );

  // Cap (snapshots only), always keeping files the sampled commits touched.
  const touched = new Set<string>();
  for (const d of details.values()) for (const f of d) touched.add(f);
  const cap = capFiles(files, touched, opts.maxFiles ?? Infinity);
  files = cap.files;

  const index = new Map<string, number>();
  files.forEach((f, i) => index.set(f.path, i));

  const commits: Commit[] = [];
  for (const item of picked) {
    const touchedPaths = details.get(item.sha);
    if (!touchedPaths) continue; // failed to fetch; skip rather than guess
    const fileIdx: number[] = [];
    for (const p of touchedPaths) {
      const i = index.get(p);
      if (i !== undefined) fileIdx.push(i);
    }
    commits.push({
      sha: item.sha,
      message: firstLine(item.commit.message),
      author: item.author?.login ?? item.commit.author?.name ?? 'unknown',
      date: new Date(item.commit.author?.date ?? 0).toISOString(),
      files: fileIdx,
      changedCount: touchedPaths.length,
    });
  }
  commits.reverse(); // chronological: oldest first

  onProgress?.({ step: 'done' });
  return {
    meta: head.meta,
    branch: head.branch,
    headSha: head.headSha,
    truncated: Boolean(tree.truncated),
    files,
    commits,
    sampling: { listed: head.list.length, detailed: commits.length, withToken: client.hasToken },
    fetchedAt: new Date().toISOString(),
    capped: cap.capped,
  };
}

export async function loadRepoFromApi(ref: RepoRef, opts: LoadOptions): Promise<RepoData> {
  return completeRepoLoad(await fetchRepoHead(ref, opts), opts);
}

/**
 * Fetch commit details with limited concurrency. If GitHub says we're out of quota
 * mid-way, stop and keep what we have: a smaller sample beats an error screen.
 */
async function fetchDetails(
  picked: ApiCommitListItem[],
  base: string,
  opts: LoadOptions,
  onDone: (n: number) => void,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  let next = 0;
  let done = 0;
  let stop = false;

  async function worker() {
    while (!stop && next < picked.length) {
      const item = picked[next++];
      try {
        const d = await opts.client.getJson<ApiCommitDetail>(`${base}/commits/${item.sha}`);
        out.set(
          item.sha,
          (d.files ?? []).map((f) => f.filename),
        );
      } catch (e) {
        if (e instanceof GitHubError && (e.kind === 'rate_limited' || e.kind === 'network')) {
          stop = true;
        }
        // Other per-commit failures (e.g. a huge diff GitHub won't render): skip it.
      }
      onDone(++done);
    }
  }

  const n = Math.max(1, Math.min(opts.concurrency ?? 4, picked.length));
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

function firstLine(msg: string): string {
  const line = msg.split('\n', 1)[0].trim();
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}

function enc(s: string): string {
  return encodeURIComponent(s);
}
