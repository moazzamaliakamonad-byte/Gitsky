import { describe, expect, it } from 'vitest';
import { RequestBudget } from '../src/data/budget';
import { createGitHubClient, GitHubError } from '../src/data/github';
import { loadRepoFromApi } from '../src/data/pipeline';

/**
 * A tiny fake of api.github.com. We fake the network boundary only (fetch), so the real
 * client, budget, and pipeline code all run.
 */
type Route = { status?: number; body: unknown; headers?: Record<string, string> };

function fakeGitHub(routes: Record<string, Route>, remaining = 60) {
  const calls: { url: string; auth: string | null }[] = [];
  let left = remaining;
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const h = new Headers(init?.headers);
    calls.push({ url, auth: h.get('authorization') });
    const path = url.replace('https://api.github.com', '');
    const isRate = path === '/rate_limit';
    if (!isRate) left = Math.max(0, left - 1);
    const route = isRate
      ? { body: { resources: { core: { limit: 60, remaining: left, reset: 9999999999 } } } }
      : routes[path];
    const headers = new Headers({
      'content-type': 'application/json',
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': String(left),
      'x-ratelimit-reset': '9999999999',
      ...(route?.headers ?? {}),
    });
    if (!route)
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200, headers });
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

const repoBody = {
  name: 'rocket',
  full_name: 'acme/rocket',
  owner: { login: 'acme' },
  description: 'Goes up',
  stargazers_count: 42,
  language: 'TypeScript',
  default_branch: 'main',
  html_url: 'https://github.com/acme/rocket',
};

const listBody = [
  {
    sha: 'c3',
    commit: { message: 'third\n\nbody', author: { name: 'Ada', date: '2024-01-03T00:00:00Z' } },
    author: { login: 'ada' },
  },
  {
    sha: 'c2',
    commit: { message: 'second', author: { name: 'Grace', date: '2024-01-02T00:00:00Z' } },
    author: null,
  },
  {
    sha: 'c1',
    commit: { message: 'first', author: { name: 'Ada', date: '2024-01-01T00:00:00Z' } },
    author: { login: 'ada' },
  },
];

const treeBody = {
  sha: 't',
  truncated: false,
  tree: [
    { path: 'README.md', type: 'blob', size: 10 },
    { path: 'src', type: 'tree' },
    { path: 'src/a.ts', type: 'blob', size: 200 },
  ],
};

const detail = (sha: string, files: string[]) => ({
  sha,
  files: files.map((filename) => ({ filename })),
});

const happyRoutes: Record<string, Route> = {
  '/repos/acme/rocket': { body: repoBody },
  '/repos/acme/rocket/commits?sha=main&per_page=100&page=1': { body: listBody },
  '/repos/acme/rocket/git/trees/c3?recursive=1': { body: treeBody },
  '/repos/acme/rocket/commits/c3': { body: detail('c3', ['src/a.ts']) },
  '/repos/acme/rocket/commits/c2': { body: detail('c2', ['README.md', 'gone.txt']) },
  '/repos/acme/rocket/commits/c1': { body: detail('c1', ['src/a.ts', 'README.md']) },
};

describe('GitHub client', () => {
  it('maps 404 to a not_found error', async () => {
    const { fetchImpl } = fakeGitHub({});
    const client = createGitHubClient({ budget: new RequestBudget(), fetchImpl });
    await expect(client.getJson('/repos/a/b')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('maps 403 with zero remaining to rate_limited with the reset time', async () => {
    const { fetchImpl } = fakeGitHub({
      '/repos/a/b': {
        status: 403,
        body: { message: 'API rate limit exceeded' },
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' },
      },
    });
    const client = createGitHubClient({ budget: new RequestBudget(), fetchImpl });
    const e = await client.getJson('/repos/a/b').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(GitHubError);
    expect(e).toMatchObject({ kind: 'rate_limited', resetAt: 1700000000 * 1000 });
  });

  it('maps 401 to bad_token', async () => {
    const { fetchImpl } = fakeGitHub({ '/repos/a/b': { status: 401, body: {} } });
    const client = createGitHubClient({ budget: new RequestBudget(), fetchImpl, token: 'x' });
    await expect(client.getJson('/repos/a/b')).rejects.toMatchObject({ kind: 'bad_token' });
  });

  it('maps a thrown fetch to a network error', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const client = createGitHubClient({ budget: new RequestBudget(), fetchImpl });
    await expect(client.getJson('/repos/a/b')).rejects.toMatchObject({ kind: 'network' });
  });

  it('refuses to spend past the budget without touching the network', async () => {
    const { fetchImpl, calls } = fakeGitHub({});
    const budget = new RequestBudget({ limit: 60, remaining: 0, resetAt: Date.now() + 60_000 });
    const client = createGitHubClient({ budget, fetchImpl });
    await expect(client.getJson('/repos/a/b')).rejects.toMatchObject({ kind: 'rate_limited' });
    expect(calls).toHaveLength(0);
  });

  it('sends the token only as an Authorization header to api.github.com', async () => {
    const { fetchImpl, calls } = fakeGitHub({ '/repos/a/b': { body: {} } });
    const client = createGitHubClient({ budget: new RequestBudget(), fetchImpl, token: 'secret' });
    await client.getJson('/repos/a/b');
    expect(calls[0].url).toBe('https://api.github.com/repos/a/b');
    expect(calls[0].auth).toBe('Bearer secret');
  });
});

describe('loadRepoFromApi', () => {
  it('builds RepoData with chronological commits and resolved file indices', async () => {
    const { fetchImpl } = fakeGitHub(happyRoutes);
    const budget = new RequestBudget();
    const client = createGitHubClient({ budget, fetchImpl });
    const data = await loadRepoFromApi(
      { owner: 'acme', repo: 'rocket' },
      { client, budget, desiredSamples: 25 },
    );

    expect(data.meta.fullName).toBe('acme/rocket');
    expect(data.headSha).toBe('c3');
    expect(data.files.map((f) => f.path)).toEqual(['README.md', 'src/a.ts']);
    expect(data.commits.map((c) => c.sha)).toEqual(['c1', 'c2', 'c3']);
    // c2 touched README.md (index 0) and a deleted file, which is dropped but still counted.
    expect(data.commits[1]).toMatchObject({ files: [0], changedCount: 2, author: 'Grace' });
    expect(data.commits[2]).toMatchObject({ message: 'third', author: 'ada' });
    expect(data.sampling).toEqual({ listed: 3, detailed: 3, withToken: false });
  });

  it('samples only the most recent commits the budget allows', async () => {
    const { fetchImpl } = fakeGitHub(happyRoutes, 6);
    const budget = new RequestBudget({}, 2);
    const client = createGitHubClient({ budget, fetchImpl });
    const data = await loadRepoFromApi(
      { owner: 'acme', repo: 'rocket' },
      { client, budget, desiredSamples: 25 },
    );
    // 6 left - 2 reserve - 3 base calls (meta, list, tree) = 1 detail call.
    expect(data.commits.map((c) => c.sha)).toEqual(['c3']);
    expect(data.sampling.detailed).toBe(1);
  });

  it('reports an empty repo', async () => {
    const { fetchImpl } = fakeGitHub({
      '/repos/acme/rocket': { body: repoBody },
      '/repos/acme/rocket/commits?sha=main&per_page=100&page=1': {
        status: 409,
        body: { message: 'Git Repository is empty.' },
      },
    });
    const budget = new RequestBudget();
    const client = createGitHubClient({ budget, fetchImpl });
    await expect(
      loadRepoFromApi({ owner: 'acme', repo: 'rocket' }, { client, budget, desiredSamples: 5 }),
    ).rejects.toMatchObject({ kind: 'empty' });
  });

  it('passes through the truncated flag', async () => {
    const { fetchImpl } = fakeGitHub({
      ...happyRoutes,
      '/repos/acme/rocket/git/trees/c3?recursive=1': { body: { ...treeBody, truncated: true } },
    });
    const budget = new RequestBudget();
    const client = createGitHubClient({ budget, fetchImpl });
    const data = await loadRepoFromApi(
      { owner: 'acme', repo: 'rocket' },
      { client, budget, desiredSamples: 1 },
    );
    expect(data.truncated).toBe(true);
  });
});
