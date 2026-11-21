import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openRepoCache } from '../src/data/cache';
import type { RepoData } from '../src/data/types';

function data(sha: string, detailed = 3): RepoData {
  return {
    meta: {
      owner: 'acme',
      repo: 'rocket',
      fullName: 'acme/rocket',
      description: null,
      stars: 1,
      language: null,
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/acme/rocket',
    },
    branch: 'main',
    headSha: sha,
    truncated: false,
    files: [{ path: 'a.ts', size: 1 }],
    commits: [],
    sampling: { listed: 10, detailed, withToken: false },
    fetchedAt: '2024-01-01T00:00:00.000Z',
    capped: null,
  };
}

describe('repo cache (IndexedDB)', () => {
  it('stores and returns a repo by name, branch and head SHA', async () => {
    const cache = await openRepoCache(`t-${Math.random()}`);
    await cache.put(data('sha1'), 25);
    const hit = await cache.get('acme/rocket', 'main', 'sha1');
    expect(hit?.data).toEqual(data('sha1'));
    expect(hit?.desiredSamples).toBe(25);
    expect(await cache.get('acme/rocket', 'main', 'other')).toBeNull();
  });

  it('remembers the latest SHA per repo and branch', async () => {
    const cache = await openRepoCache(`t-${Math.random()}`);
    await cache.put(data('sha1'), 25);
    await cache.put(data('sha2'), 25);
    const latest = await cache.latest('acme/rocket', 'main');
    expect(latest?.headSha).toBe('sha2');
    expect(typeof latest?.savedAt).toBe('number');
  });

  it('is case-insensitive about owner/repo, like GitHub', async () => {
    const cache = await openRepoCache(`t-${Math.random()}`);
    await cache.put(data('sha1'), 25);
    expect(await cache.latest('ACME/Rocket', 'main')).not.toBeNull();
  });

  it('degrades to a no-op cache when IndexedDB is unavailable', async () => {
    const cache = await openRepoCache('x', null);
    await cache.put(data('sha1'), 25);
    expect(await cache.get('acme/rocket', 'main', 'sha1')).toBeNull();
  });
});
