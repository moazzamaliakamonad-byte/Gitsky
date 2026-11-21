import { describe, expect, it } from 'vitest';
import {
  advancePlayhead,
  ARRIVE,
  lastTouches,
  LOOP_TAIL,
  SECONDS_PER_COMMIT,
} from '../src/render/timeline';
import { authorColor, bezier, cometsAt, MAX_PER_COMMIT } from '../src/render/cometMath';
import type { Commit } from '../src/data/types';

const commit = (files: number[], author = 'ada'): Commit => ({
  sha: `s${files.join('')}`,
  message: 'm',
  author,
  date: '2024-01-01T00:00:00Z',
  files,
  changedCount: files.length,
});

describe('lastTouches', () => {
  const commits = [commit([0, 1]), commit([1]), commit([2])];

  it('records the latest commit ≤ playhead that touched each file', () => {
    expect(Array.from(lastTouches(4, commits, 1.5))).toEqual([0, 1, -1, -1]);
    expect(Array.from(lastTouches(4, commits, 2))).toEqual([0, 1, 2, -1]);
  });

  it('is all -1 before the first commit', () => {
    expect(Array.from(lastTouches(3, commits, -0.5))).toEqual([-1, -1, -1]);
  });
});

describe('advancePlayhead', () => {
  it('moves one commit per SECONDS_PER_COMMIT', () => {
    expect(advancePlayhead(0, SECONDS_PER_COMMIT, 10)).toBeCloseTo(1);
  });

  it('loops back to the start after the tail pause', () => {
    expect(advancePlayhead(10 + LOOP_TAIL - 0.01, 1, 10)).toBe(-1);
  });
});

describe('cometsAt', () => {
  const commits = [commit([0, 1, 2]), commit([3])];

  it('has no comets before the first commit or between commits after arrival', () => {
    expect(cometsAt(commits, -0.5)).toEqual([]);
  });

  it('launches one comet per touched file during its commit slot', () => {
    const c = cometsAt(commits, 0.3);
    expect(c.map((x) => x.file).sort()).toEqual([0, 1, 2]);
    for (const x of c) {
      expect(x.u).toBeGreaterThanOrEqual(0);
      expect(x.u).toBeLessThanOrEqual(1);
    }
  });

  it('reaches every star exactly at ARRIVE', () => {
    for (const x of cometsAt(commits, ARRIVE)) expect(x.u).toBeCloseTo(1);
  });

  it('turns into a burst after arrival', () => {
    const c = cometsAt(commits, ARRIVE + 0.1);
    expect(c.every((x) => x.u > 1)).toBe(true);
  });

  it('caps comets per commit', () => {
    const big = [commit(Array.from({ length: 100 }, (_, i) => i))];
    expect(cometsAt(big, 0.3).length).toBe(MAX_PER_COMMIT);
  });
});

describe('bezier', () => {
  it('starts at the start, ends at the end', () => {
    const a: [number, number, number] = [0, 0, 0];
    const c: [number, number, number] = [5, 5, 5];
    const b: [number, number, number] = [10, 0, 0];
    expect(bezier(a, c, b, 0)).toEqual([0, 0, 0]);
    expect(bezier(a, c, b, 1)).toEqual([10, 0, 0]);
  });
});

describe('authorColor', () => {
  it('is stable per author and a valid hex colour', () => {
    expect(authorColor('ada')).toBe(authorColor('ada'));
    expect(authorColor('ada')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
