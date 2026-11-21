import { describe, expect, it } from 'vitest';
import { computeInsights } from '../src/layout/insights';
import { sortFiles, filterFiles } from '../src/layout/listView';
import { buildModel } from '../src/state/model';
import type { RepoData } from '../src/data/types';

function repo(): RepoData {
  const files = [
    { path: 'README.md', size: 100 },
    { path: 'src/a.ts', size: 5000 },
    { path: 'src/b.ts', size: 300 },
    { path: 'src/c.ts', size: 200 },
    ...Array.from({ length: 12 }, (_, i) => ({ path: `vendor/v${i}.js`, size: 900 })),
    { path: 'docs/guide.md', size: 50 },
  ];
  const c = (sha: string, f: number[], author: string) => ({
    sha,
    message: sha,
    author,
    date: '2024-01-01T00:00:00.000Z',
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
    commits: [c('c1', [1, 2], 'ada'), c('c2', [1], 'ada'), c('c3', [1, 16], 'grace')],
    sampling: { listed: 50, detailed: 3, withToken: false },
    fetchedAt: '2024-01-05T00:00:00.000Z',
    capped: null,
  };
}

describe('computeInsights', () => {
  const model = buildModel(repo(), 'bundled');
  const ins = computeInsights(model);

  it('ranks the hottest files by sampled commits', () => {
    expect(ins.hottest[0]).toEqual({ index: 1, count: 3 });
  });

  it('ranks the largest files by bytes', () => {
    expect(ins.largest[0].index).toBe(1);
    expect(ins.largest[0].bytes).toBe(5000);
  });

  it('breaks languages down by bytes, shares summing to 1', () => {
    expect(ins.languages[0].name).toBe('JavaScript'); // 12 × 900 bytes
    const total = ins.languages.reduce((s, l) => s + l.share, 0);
    expect(total).toBeCloseTo(1);
  });

  it('finds quiet zones: big folders with no sampled changes', () => {
    expect(ins.quiet.map((q) => model.layout.tree.folders[q.folder].path)).toEqual(['vendor']);
  });

  it('ranks contributors in the sample', () => {
    expect(ins.contributors[0]).toMatchObject({ name: 'ada', commits: 2 });
  });

  it('finds where recent work concentrated', () => {
    expect(ins.busiest && model.layout.tree.folders[ins.busiest.folder].path).toBe('src');
    expect(ins.busiest?.commits).toBe(3);
  });

  it('writes a plain-language summary that names the sample size honestly', () => {
    const text = ins.summary.join(' ');
    expect(text).toContain('JavaScript');
    expect(text).toContain('last 3 sampled commits');
  });
});

describe('summary when assets outweigh code', () => {
  it('names the main code language, not just the byte leader', () => {
    const data = repo();
    data.files.push({ path: 'img/huge.png', size: 10_000_000 });
    data.files.sort((a, b) => (a.path < b.path ? -1 : 1));
    data.commits = [];
    const text = computeInsights(buildModel(data, 'bundled')).summary[0];
    expect(text).toMatch(/assets/i);
    expect(text).toMatch(/main code language is JavaScript/);
  });
});

describe('list view', () => {
  const model = buildModel(repo(), 'bundled');

  it('sorts by size, churn, language and path in both directions', () => {
    const bySize = sortFiles(model, 'size', 'desc');
    expect(bySize[0]).toBe(1);
    expect(sortFiles(model, 'churn', 'desc')[0]).toBe(1);
    const byPath = sortFiles(model, 'path', 'asc');
    expect(model.data.files[byPath[0]].path).toBe('README.md');
    expect(sortFiles(model, 'path', 'desc')[0]).toBe(byPath[byPath.length - 1]);
    expect(sortFiles(model, 'language', 'asc')).toHaveLength(model.data.files.length);
  });

  it('filters by a path substring, case-insensitively', () => {
    const all = sortFiles(model, 'path', 'asc');
    expect(filterFiles(model, all, 'SRC/').map((i) => model.data.files[i].path)).toEqual([
      'src/a.ts',
      'src/b.ts',
      'src/c.ts',
    ]);
    expect(filterFiles(model, all, '')).toBe(all);
  });
});
