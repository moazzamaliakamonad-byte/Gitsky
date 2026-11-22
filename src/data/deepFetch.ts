import type { RequestBudget } from './budget';
import { buildHistory, lastPageOf, planEpochPages, type DeepHistory } from './deepTime';
import { GitHubError, type GitHubClient } from './github';
import { normalizeTree, type ApiTreeEntry } from './snapshot';
import type { RepoData } from './types';

/** Most moments we read; each costs two requests. */
export const MAX_EPOCHS = 10;
/** Deleted files kept as ghosts: enough to see what was lost, few enough to stay light. */
export const MAX_GHOSTS = 3000;

interface ApiCommitAtPage {
  sha: string;
  commit: {
    tree: { sha: string };
    committer?: { date?: string } | null;
    author?: { date?: string } | null;
  };
}

interface ApiTree {
  truncated: boolean;
  tree: ApiTreeEntry[];
}

export interface DeepFetchOptions {
  client: GitHubClient;
  budget: RequestBudget;
  maxEpochs?: number;
  onProgress?: (done: number, total: number) => void;
  /** Reads two moments at a time. */
  concurrency?: number;
}

/**
 * Read the repo at moments spread through its whole history:
 *
 *   1. GET commits?per_page=1             the Link header gives the commit count  (1 call)
 *   2. GET commits?per_page=1&page=N      the commit at that point, and its tree   (1 each)
 *   3. GET git/trees/{tree}?recursive=1   every file then                          (1 each)
 *
 * plus today's full tree when the sky was capped (so a file we left out of a snapshot
 * isn't mistaken for a deleted one). The number of moments fits the request budget.
 */
export async function fetchDeepHistory(
  data: RepoData,
  opts: DeepFetchOptions,
): Promise<DeepHistory> {
  const { client, budget } = opts;
  const base = `/repos/${enc(data.meta.owner)}/${enc(data.meta.repo)}`;
  const branch = enc(data.branch);
  const extra = data.capped ? 1 : 0;
  const affordable = Math.floor((budget.available() - 1 - extra) / 2);
  const want = Math.min(opts.maxEpochs ?? MAX_EPOCHS, affordable);
  if (want < 2)
    throw new GitHubError(
      'rate_limited',
      'GitHub API limit reached for this hour.',
      403,
      budget.state.resetAt || undefined,
    );

  const { link } = await client.getJsonWithLink<unknown[]>(
    `${base}/commits?sha=${branch}&per_page=1`,
  );
  const total = lastPageOf(link);
  const pages = planEpochPages(total, want);
  const steps = pages.length + extra;
  let done = 0;
  opts.onProgress?.(0, steps);

  const epochs: { sha: string; date: string; paths: string[] }[] = new Array(pages.length);
  let next = 0;
  const worker = async () => {
    while (next < pages.length) {
      const k = next++;
      const [c] = await client.getJson<ApiCommitAtPage[]>(
        `${base}/commits?sha=${branch}&per_page=1&page=${pages[k]}`,
      );
      if (!c) throw new GitHubError('http', 'GitHub returned no commit for that point.');
      const tree = await client.getJson<ApiTree>(
        `${base}/git/trees/${c.commit.tree.sha}?recursive=1`,
      );
      epochs[k] = {
        sha: c.sha,
        date: c.commit.committer?.date ?? c.commit.author?.date ?? '',
        paths: normalizeTree(tree.tree).map((f) => f.path),
      };
      opts.onProgress?.(++done, steps);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 2, pages.length) }, worker));

  let full: Set<string> | undefined;
  if (data.capped) {
    const head = await client.getJson<ApiTree>(`${base}/git/trees/${data.headSha}?recursive=1`);
    full = new Set(normalizeTree(head.tree).map((f) => f.path));
    opts.onProgress?.(++done, steps);
  }

  const current = data.files.map((f) => f.path);
  return buildHistory(current, epochs, MAX_GHOSTS, full ?? new Set(current), total);
}

function enc(s: string): string {
  return encodeURIComponent(s);
}
