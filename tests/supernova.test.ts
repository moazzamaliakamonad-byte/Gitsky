import { describe, expect, it } from 'vitest';
import { supernovaAt, planSupernova } from '../src/render/supernovaMath';
import type { Commit } from '../src/data/types';

function commit(files: number[]): Commit {
  return {
    sha: 's',
    message: 'm',
    author: 'a',
    date: '2024-01-01T00:00:00.000Z',
    files,
    changedCount: files.length,
  };
}

describe('planSupernova', () => {
  it('picks the most-changed file and the first commit that lands on it', () => {
    const commits = [commit([0]), commit([1, 2]), commit([2]), commit([2, 0])];
    expect(planSupernova(commits, 3)).toEqual({ file: 2, commit: 1, touches: 3 });
  });

  it('needs a file changed at least twice', () => {
    expect(planSupernova([commit([0]), commit([1])], 2)).toBeNull();
    expect(planSupernova([], 2)).toBeNull();
  });
});

describe('supernovaAt', () => {
  const plan = { file: 2, commit: 1, touches: 3 };

  it('is dark before its comet lands', () => {
    expect(supernovaAt(plan, 1.5)).toBeNull();
  });

  it('flashes at impact, then the shell expands and the remnant lingers', () => {
    const early = supernovaAt(plan, 1.75);
    const late = supernovaAt(plan, 4.5);
    expect(early).not.toBeNull();
    expect(late).not.toBeNull();
    expect(early!.flash).toBeGreaterThan(late!.flash);
    expect(late!.shell).toBeGreaterThan(early!.shell);
    expect(late!.shell).toBeLessThanOrEqual(1);
    expect(late!.remnant).toBeGreaterThan(0);
  });
});
