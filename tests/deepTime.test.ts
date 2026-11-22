import { describe, expect, it } from 'vitest';
import {
  buildHistory,
  decodeHistory,
  encodeHistory,
  folderBirths,
  lastPageOf,
  planEpochPages,
  NOW,
} from '../src/data/deepTime';
import { buildFolderTree } from '../src/layout/tree';

describe('lastPageOf: total commits from the Link header of a per_page=1 listing', () => {
  it('reads rel="last"', () => {
    const link =
      '<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", ' +
      '<https://api.github.com/repositories/1/commits?per_page=1&page=31456>; rel="last"';
    expect(lastPageOf(link)).toBe(31456);
  });
  it('is 1 when there is no next page', () => {
    expect(lastPageOf(null)).toBe(1);
    expect(lastPageOf('')).toBe(1);
  });
});

describe('planEpochPages: moments spread evenly through the history, oldest first', () => {
  it('starts at the very first commit and never reaches the present', () => {
    const pages = planEpochPages(1000, 5);
    expect(pages[0]).toBe(1000); // page N of a newest-first listing = the first commit
    expect(pages).toHaveLength(5);
    for (let i = 1; i < pages.length; i++) expect(pages[i]).toBeLessThan(pages[i - 1]);
    expect(pages[pages.length - 1]).toBeGreaterThan(1);
  });
  it('spaces moments by commits, not by calendar time', () => {
    expect(planEpochPages(1000, 4)).toEqual([1000, 750, 500, 250]);
  });
  it('shrinks for short histories', () => {
    expect(planEpochPages(3, 10)).toEqual([3, 2]);
    expect(planEpochPages(1, 10)).toEqual([]);
  });
});

describe('buildHistory: when each file was born, and what died along the way', () => {
  const now = ['README.md', 'src/a.ts', 'src/b.ts', 'docs/guide.md'];
  const epochs = [
    { sha: 'e0', date: '2015-01-01T00:00:00Z', paths: ['README.md', 'old.c'] },
    { sha: 'e1', date: '2018-01-01T00:00:00Z', paths: ['README.md', 'old.c', 'src/a.ts'] },
    { sha: 'e2', date: '2021-01-01T00:00:00Z', paths: ['README.md', 'src/a.ts', 'tmp/x.js'] },
  ];

  it('gives each current file the first moment it existed, NOW if only today', () => {
    const h = buildHistory(now, epochs, 1000);
    expect([...h.born]).toEqual([0, 1, NOW, NOW]);
    expect(h.epochs.map((e) => e.count)).toEqual([2, 3, 3]);
  });

  it('keeps deleted files as ghosts with their lifetimes', () => {
    const h = buildHistory(now, epochs, 1000);
    expect(h.ghosts).toEqual([
      { path: 'old.c', born: 0, died: 2 },
      { path: 'tmp/x.js', born: 2, died: NOW },
    ]);
  });

  it('does not call a file dead just because the snapshot capped it out', () => {
    const h = buildHistory(now, epochs, 1000, new Set([...now, 'tmp/x.js']));
    expect(h.ghosts.map((g) => g.path)).toEqual(['old.c']);
  });

  it('caps ghosts, keeping the longest-lived', () => {
    const h = buildHistory(now, epochs, 1);
    expect(h.ghosts.map((g) => g.path)).toEqual(['old.c']);
  });

  it('survives a round trip through its compact form', () => {
    const h = buildHistory(now, epochs, 1000);
    const back = decodeHistory(JSON.parse(JSON.stringify(encodeHistory(h))));
    expect(back).toEqual(h);
  });
});

describe('folderBirths: a folder is born with its first file', () => {
  it('takes the earliest birth in its subtree', () => {
    const files = [
      { path: 'README.md', size: 1 },
      { path: 'src/a.ts', size: 1 },
      { path: 'src/deep/b.ts', size: 1 },
      { path: 'docs/c.md', size: 1 },
    ];
    const tree = buildFolderTree(files);
    const born = new Uint8Array([0, 3, 1, NOW]);
    const fb = folderBirths(tree, born);
    expect(fb[tree.byPath.get('')!]).toBe(0);
    expect(fb[tree.byPath.get('src')!]).toBe(1);
    expect(fb[tree.byPath.get('src/deep')!]).toBe(1);
    expect(fb[tree.byPath.get('docs')!]).toBe(NOW);
  });
});
