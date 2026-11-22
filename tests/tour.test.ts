import { describe, expect, it } from 'vitest';
import { planTour } from '../src/state/tourPlan';
import { buildModel } from '../src/state/model';
import type { RepoData } from '../src/data/types';

function repo(commits: number[][]): RepoData {
  const files = [
    { path: 'README.md', size: 100 },
    ...Array.from({ length: 6 }, (_, i) => ({ path: `src/core/f${i}.ts`, size: 1000 + i })),
    { path: 'docs/a.md', size: 50 },
  ];
  return {
    meta: {
      owner: 'o',
      repo: 'r',
      fullName: 'o/r',
      description: null,
      stars: 1,
      language: null,
      defaultBranch: 'main',
      htmlUrl: 'x',
    },
    branch: 'main',
    headSha: 'x',
    truncated: false,
    files,
    commits: commits.map((f, i) => ({
      sha: `c${i}`,
      message: 'm',
      author: 'a',
      date: '2024-01-01T00:00:00.000Z',
      files: f,
      changedCount: f.length,
    })),
    sampling: { listed: 10, detailed: commits.length, withToken: false },
    fetchedAt: '2024-01-02T00:00:00.000Z',
    capped: null,
  };
}

describe('planTour', () => {
  it('flies overview → largest region → busiest file → its system → back → comets → overview', () => {
    const model = buildModel(repo([[3], [3, 4], [3]]), 'bundled');
    const steps = planTour(model);
    expect(steps.map((s) => s.action.kind)).toEqual([
      'overview',
      'folder',
      'file',
      'system',
      'leave-system',
      'replay',
      'overview',
    ]);
    const file = steps[2].action;
    expect(file.kind === 'file' && model.data.files[file.file].path).toBe('src/core/f2.ts');
    expect(steps[1].caption).toContain('src/');
    expect(steps[2].caption).toContain('3 of the last 3 commits');
  });

  it('falls back to the heaviest file and skips the comets when nothing was sampled', () => {
    const steps = planTour(buildModel(repo([]), 'bundled'));
    expect(steps.some((s) => s.action.kind === 'replay')).toBe(false);
    expect(steps.find((s) => s.action.kind === 'file')?.caption).toContain('heaviest');
  });

  it('keeps the whole tour short', () => {
    const total = planTour(buildModel(repo([[3]]), 'bundled')).reduce((s, x) => s + x.seconds, 0);
    expect(total).toBeLessThan(50);
  });
});
