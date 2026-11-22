import { describe, expect, it } from 'vitest';
import { RequestBudget } from '../src/data/budget';
import { fetchDeepHistory } from '../src/data/deepFetch';
import { NOW } from '../src/data/deepTime';
import type { GitHubClient } from '../src/data/github';
import type { RepoData } from '../src/data/types';

const data = (paths: string[], capped = false): RepoData => ({
  meta: {
    owner: 'o',
    repo: 'r',
    fullName: 'o/r',
    description: null,
    stars: 1,
    language: null,
    defaultBranch: 'main',
    htmlUrl: 'https://github.com/o/r',
  },
  branch: 'main',
  headSha: 'head',
  truncated: false,
  files: paths.map((path) => ({ path, size: 10 })),
  commits: [],
  sampling: { listed: 0, detailed: 0, withToken: false },
  fetchedAt: '2026-01-01T00:00:00Z',
  capped: capped ? { originalFileCount: 99 } : null,
});

/** A repo with 9 commits; the tree at page p (newest first) holds files f1…f(10-p). */
function fakeClient(calls: string[], headTree?: string[]): GitHubClient {
  const blob = (path: string) => ({ path, type: 'blob', size: 10 });
  return {
    hasToken: false,
    rateLimit: async () => ({ limit: 60, remaining: 60, resetAt: 0 }),
    async getJsonWithLink<T>(path: string) {
      calls.push(path);
      return {
        data: [] as unknown as T,
        link: '<https://api.github.com/repos/o/r/commits?per_page=1&page=9>; rel="last"',
      };
    },
    async getJson<T>(path: string): Promise<T> {
      calls.push(path);
      const page = /[?&]page=(\d+)/.exec(path);
      if (page) {
        const p = Number(page[1]);
        return [
          {
            sha: `c${p}`,
            commit: {
              tree: { sha: `t${p}` },
              committer: { date: `20${10 + 9 - p}-01-01T00:00:00Z` },
            },
          },
        ] as T;
      }
      const tree = /git\/trees\/t(\d+)/.exec(path);
      if (tree) {
        const n = 10 - Number(tree[1]);
        return {
          sha: 'x',
          truncated: false,
          tree: Array.from({ length: n }, (_, i) => blob(`f${i + 1}`)),
        } as T;
      }
      if (path.includes('git/trees/head') && headTree)
        return { sha: 'head', truncated: false, tree: headTree.map(blob) } as T;
      throw new Error(`unexpected ${path}`);
    },
  };
}

describe('fetchDeepHistory', () => {
  it('reads moments from the first commit onward, two calls each', async () => {
    const calls: string[] = [];
    const h = await fetchDeepHistory(data(['f1', 'f2', 'f5', 'f9', 'new']), {
      client: fakeClient(calls),
      budget: new RequestBudget({ limit: 60, remaining: 60 }),
      maxEpochs: 3,
    });
    expect(h.totalCommits).toBe(9);
    // Pages 9, 6, 3 (oldest first): trees with 1, 4 and 7 files.
    expect(h.epochs.map((e) => e.count)).toEqual([1, 4, 7]);
    expect(h.epochs[0].date).toBe('2010-01-01T00:00:00Z');
    expect([...h.born]).toEqual([0, 1, 2, NOW, NOW]);
    // f3, f4, f6, f7 existed back then but not today.
    expect(h.ghosts.map((g) => g.path)).toEqual(['f3', 'f4', 'f6', 'f7']);
    expect(calls).toHaveLength(1 + 3 * 2);
  });

  it('fits the number of moments to the request budget', async () => {
    const calls: string[] = [];
    const h = await fetchDeepHistory(data(['f1']), {
      client: fakeClient(calls),
      budget: new RequestBudget({ limit: 60, remaining: 9 }, 2),
      maxEpochs: 10,
    });
    // 9 left, 2 kept in reserve, 1 for the count: 3 moments.
    expect(h.epochs).toHaveLength(3);
  });

  it('checks today’s full tree when the sky was capped, so capped files are not ghosts', async () => {
    const calls: string[] = [];
    const h = await fetchDeepHistory(data(['f1'], true), {
      client: fakeClient(calls, ['f1', 'f2', 'f3']),
      budget: new RequestBudget({ limit: 60, remaining: 60 }),
      maxEpochs: 2,
    });
    expect(h.ghosts.map((g) => g.path)).not.toContain('f2');
    expect(calls.some((c) => c.includes('git/trees/head'))).toBe(true);
  });

  it('refuses when the budget cannot pay for two moments', async () => {
    await expect(
      fetchDeepHistory(data(['f1']), {
        client: fakeClient([]),
        budget: new RequestBudget({ limit: 60, remaining: 5 }, 2),
      }),
    ).rejects.toMatchObject({ kind: 'rate_limited' });
  });
});
