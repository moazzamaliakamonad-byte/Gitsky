import { RequestBudget, type RateState } from './budget';
import { DEFAULT_BRANCH_KEY, openRepoCache, type RepoCache } from './cache';
import { createGitHubClient, GitHubError } from './github';
import { completeRepoLoad, fetchRepoHead } from './pipeline';
import type { Progress, RepoData, RepoRef } from './types';

/** Commit details to sample. Each costs one API call. */
export const DESIRED_NO_TOKEN = 25;
export const DESIRED_WITH_TOKEN = 300;
/** A cached repo younger than this is shown without asking GitHub anything. */
export const FRESH_MS = 60 * 60 * 1000;

export interface LoadResult {
  data: RepoData;
  source: 'network' | 'cache' | 'stale-cache';
  rate: RateState | null;
}

let cachePromise: Promise<RepoCache> | null = null;
const cache = () => (cachePromise ??= openRepoCache());

export async function loadRepo(
  ref: RepoRef,
  opts: {
    token?: string | null;
    onProgress?: (p: Progress) => void;
    signal?: AbortSignal;
    refresh?: boolean;
  } = {},
): Promise<LoadResult> {
  const token = opts.token ?? undefined;
  const desiredSamples = token ? DESIRED_WITH_TOKEN : DESIRED_NO_TOKEN;
  const fullName = `${ref.owner}/${ref.repo}`;
  const branchKey = ref.branch ?? DEFAULT_BRANCH_KEY;
  const c = await cache();

  opts.onProgress?.({ step: 'cache' });
  const latest = await c.latest(fullName, branchKey);
  const fromLatest = latest ? await c.get(fullName, latest.branch, latest.headSha) : null;

  if (
    !opts.refresh &&
    fromLatest &&
    latest &&
    Date.now() - latest.savedAt < FRESH_MS &&
    fromLatest.desiredSamples >= desiredSamples
  ) {
    return { data: fromLatest.data, source: 'cache', rate: null };
  }

  const budget = new RequestBudget({ limit: token ? 5000 : 60 });
  const client = createGitHubClient({ budget, token, signal: opts.signal });

  try {
    opts.onProgress?.({ step: 'rate' });
    await client.rateLimit(); // free call; makes the budget exact before we plan
    const loadOpts = { client, budget, desiredSamples, onProgress: opts.onProgress };
    const head = await fetchRepoHead(ref, loadOpts);

    const hit = await c.get(head.meta.fullName, head.branch, head.headSha);
    if (hit && hit.desiredSamples >= desiredSamples) {
      await c.put(hit.data, hit.desiredSamples); // refresh "latest" so the next reload is free
      return { data: hit.data, source: 'cache', rate: budget.state };
    }

    const data = await completeRepoLoad(head, loadOpts);
    await c.put(data, desiredSamples);
    return { data, source: 'network', rate: budget.state };
  } catch (e) {
    // Offline or out of quota, but we've seen this repo before: show the old sky.
    if (
      fromLatest &&
      e instanceof GitHubError &&
      (e.kind === 'network' || e.kind === 'rate_limited')
    ) {
      return { data: fromLatest.data, source: 'stale-cache', rate: budget.state };
    }
    throw e;
  }
}
