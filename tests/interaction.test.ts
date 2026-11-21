import { describe, expect, it } from 'vitest';
import { pickNearest } from '../src/render/picking';
import { searchFiles } from '../src/layout/search';
import { fileDetail, folderStats, subtreeFiles } from '../src/layout/stats';
import { buildModel } from '../src/state/model';
import type { RepoData } from '../src/data/types';

// Identity view-projection: world xyz == clip xyz with w = 1, so NDC == world.
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe('pickNearest', () => {
  const pos = new Float32Array([
    0,
    0,
    0, // centre of a 200x200 viewport → (100,100)
    0.5,
    0,
    0, // → (150,100)
    -0.9,
    0.9,
    0, // → (10,10)
  ]);

  it('returns the star nearest the cursor within the radius', () => {
    expect(pickNearest(pos, 3, I, 200, 200, 104, 98, 10)).toBe(0);
    expect(pickNearest(pos, 3, I, 200, 200, 146, 103, 10)).toBe(1);
  });

  it('returns -1 when nothing is close enough', () => {
    expect(pickNearest(pos, 3, I, 200, 200, 60, 160, 10)).toBe(-1);
  });

  it('ignores stars the filter rejects (e.g. dimmed ones)', () => {
    expect(pickNearest(pos, 3, I, 200, 200, 104, 98, 10, (i) => i !== 0)).toBe(-1);
  });

  it('ignores stars behind the camera (w ≤ 0)', () => {
    const behind = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1];
    expect(pickNearest(pos, 3, behind, 200, 200, 100, 100, 10)).toBe(-1);
  });
});

describe('searchFiles', () => {
  const paths = [
    'src/index.ts',
    'packages/vite/src/node/index.ts',
    'docs/guide/index.md',
    'src/indexer.ts',
    'src/utils/reindex.ts',
    'README.md',
  ].map((p) => p.toLowerCase());

  it('ranks exact file-name matches first, shallower paths before deeper', () => {
    const r = searchFiles(paths, 'index.ts');
    expect(r.slice(0, 2)).toEqual([0, 1]);
  });

  it('ranks name prefix above name substring above path substring', () => {
    const r = searchFiles(paths, 'index');
    expect(r.indexOf(3)).toBeLessThan(r.indexOf(4)); // indexer.ts (prefix) before reindex.ts
  });

  it('matches across the path when the query has a slash', () => {
    expect(searchFiles(paths, 'guide/ind')).toEqual([2]);
  });

  it('is case-insensitive and ignores surrounding space', () => {
    expect(searchFiles(paths, '  README ')).toEqual([5]);
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(searchFiles(paths, '')).toEqual([]);
    expect(searchFiles(paths, 'i', 2)).toHaveLength(2);
  });
});

function repo(): RepoData {
  const files = [
    { path: 'README.md', size: 100 },
    { path: 'src/a.ts', size: 1000 },
    { path: 'src/b.ts', size: 10 },
    { path: 'src/lib/c.ts', size: 500 },
    { path: 'docs/d.md', size: 50 },
  ];
  const c = (sha: string, f: number[], author = 'ada') => ({
    sha,
    message: `msg ${sha}`,
    author,
    date: `2024-01-0${sha.slice(1)}T00:00:00.000Z`,
    files: f,
    changedCount: f.length,
  });
  return {
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
    headSha: 'x',
    truncated: false,
    files,
    commits: [c('c1', [1, 3]), c('c2', [1], 'grace'), c('c3', [1, 0])],
    sampling: { listed: 10, detailed: 3, withToken: false },
    fetchedAt: '2024-01-05T00:00:00.000Z',
    capped: null,
  };
}

describe('fileDetail', () => {
  const model = buildModel(repo(), 'bundled');

  it('lists the sampled commits that touched a file, newest first', () => {
    const d = fileDetail(model, 1);
    expect(d.touches).toEqual([2, 1, 0]);
    expect(d.githubUrl).toBe('https://github.com/o/r/blob/main/src/a.ts');
  });

  it('computes the size percentile among all files', () => {
    expect(fileDetail(model, 1).sizePercentile).toBe(100); // the biggest file
    expect(fileDetail(model, 2).sizePercentile).toBe(20); // smallest of 5
  });
});

describe('folderStats', () => {
  const model = buildModel(repo(), 'bundled');
  const src = model.layout.tree.byPath.get('src')!;

  it('collects every file in the subtree', () => {
    expect(subtreeFiles(model.layout.tree, src).sort()).toEqual([1, 2, 3]);
  });

  it('summarises size, churn, hottest files and authors', () => {
    const s = folderStats(model, src);
    expect(s.files).toBe(3);
    expect(s.bytes).toBe(1510);
    expect(s.touchedFiles).toBe(2);
    expect(s.hottest[0]).toEqual({ index: 1, count: 3 });
    expect(s.authors[0]).toEqual({ name: 'ada', commits: 2 });
    expect(s.subfolders.map((f) => f.index)).toEqual([model.layout.tree.byPath.get('src/lib')]);
  });
});
