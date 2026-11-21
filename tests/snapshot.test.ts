import { describe, expect, it } from 'vitest';
import {
  capFiles,
  decodeSnapshot,
  encodeSnapshot,
  normalizeTree,
  SnapshotError,
} from '../src/data/snapshot';
import type { RepoData } from '../src/data/types';

function sample(): RepoData {
  return {
    meta: {
      owner: 'acme',
      repo: 'rocket',
      fullName: 'acme/rocket',
      description: 'Goes up',
      stars: 42,
      language: 'TypeScript',
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/acme/rocket',
    },
    branch: 'main',
    headSha: 'abc123',
    truncated: false,
    files: [
      { path: 'README.md', size: 100 },
      { path: 'src/a.ts', size: 2000 },
      { path: 'src/deep/b.ts', size: 30 },
      { path: 'src/deep/c.ts', size: 0 },
    ],
    commits: [
      {
        sha: 'c1',
        message: 'first',
        author: 'ada',
        date: '2024-01-01T00:00:00.000Z',
        files: [0, 1],
        changedCount: 3,
      },
      {
        sha: 'c2',
        message: 'second',
        author: 'grace',
        date: '2024-01-02T12:30:00.000Z',
        files: [2],
        changedCount: 1,
      },
    ],
    sampling: { listed: 100, detailed: 2, withToken: false },
    fetchedAt: '2024-01-03T00:00:00.000Z',
    capped: null,
  };
}

describe('normalizeTree', () => {
  it('keeps only blobs, drops trees and submodules, and sorts by path', () => {
    const files = normalizeTree([
      { path: 'src', type: 'tree' },
      { path: 'src/z.ts', type: 'blob', size: 5 },
      { path: 'vendor/lib', type: 'commit' },
      { path: 'a.md', type: 'blob', size: 9 },
    ]);
    expect(files).toEqual([
      { path: 'a.md', size: 9 },
      { path: 'src/z.ts', size: 5 },
    ]);
  });

  it('treats a missing size as 0 bytes', () => {
    expect(normalizeTree([{ path: 'x', type: 'blob' }])).toEqual([{ path: 'x', size: 0 }]);
  });
});

describe('encode/decode', () => {
  it('round-trips without losing data', () => {
    const data = sample();
    const json = JSON.parse(JSON.stringify(encodeSnapshot(data)));
    expect(decodeSnapshot(json)).toEqual(data);
  });

  it('stores directories once instead of repeating them in every path', () => {
    const enc = encodeSnapshot(sample());
    expect(enc.dirs).toEqual(['', 'src', 'src/deep']);
    expect(enc.files[2]).toEqual([2, 'b.ts', 30]);
  });

  it('rejects unknown versions', () => {
    const enc = { ...encodeSnapshot(sample()), v: 99 };
    expect(() => decodeSnapshot(enc)).toThrow(SnapshotError);
  });

  it('rejects malformed input', () => {
    expect(() => decodeSnapshot(null)).toThrow(SnapshotError);
    expect(() => decodeSnapshot({ v: 1 })).toThrow(SnapshotError);
  });

  it('rejects commit file indices that point outside the file list', () => {
    const enc = encodeSnapshot(sample());
    enc.commits[0].f = [99];
    expect(() => decodeSnapshot(enc)).toThrow(SnapshotError);
  });
});

describe('capFiles', () => {
  const files = Array.from({ length: 100 }, (_, i) => ({ path: `f/${i}.ts`, size: i }));

  it('returns input untouched when under the cap', () => {
    const r = capFiles(files, new Set(), 200);
    expect(r.files).toBe(files);
    expect(r.capped).toBeNull();
  });

  it('keeps exactly max files and always keeps the must-keep set', () => {
    const keep = new Set(['f/3.ts', 'f/97.ts']);
    const r = capFiles(files, keep, 10);
    expect(r.files).toHaveLength(10);
    const paths = r.files.map((f) => f.path);
    expect(paths).toContain('f/3.ts');
    expect(paths).toContain('f/97.ts');
    expect(r.capped).toEqual({ originalFileCount: 100 });
  });

  it('is deterministic and keeps input order', () => {
    const a = capFiles(files, new Set(), 10).files.map((f) => f.path);
    const b = capFiles(files, new Set(), 10).files.map((f) => f.path);
    expect(a).toEqual(b);
    const order = a.map((p) => files.findIndex((f) => f.path === p));
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });
});
