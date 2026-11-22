import { describe, expect, it } from 'vitest';
import { findBlackHoles, heavyKind, MAX_HOLES } from '../src/layout/blackHoles';
import { colorsFor } from '../src/layout/color';
import { supernovaAt, planSupernova } from '../src/render/supernovaMath';
import type { Commit } from '../src/data/types';

const KB = 1024;

function holesFor(files: { path: string; size: number }[]) {
  return findBlackHoles(files, colorsFor(files).languageIds);
}

const small = Array.from({ length: 40 }, (_, i) => ({ path: `src/f${i}.ts`, size: 2 * KB }));

describe('heavyKind', () => {
  it('recognises lockfiles, generated code and binary assets', () => {
    const id = (p: string) => colorsFor([{ path: p }]).languageIds[0];
    expect(heavyKind('yarn.lock', id('yarn.lock'))).toBe('lockfile');
    expect(heavyKind('web/package-lock.json', id('web/package-lock.json'))).toBe('lockfile');
    expect(heavyKind('dist/app.min.js', id('dist/app.min.js'))).toBe('generated');
    expect(heavyKind('api/user.pb.go', id('api/user.pb.go'))).toBe('generated');
    expect(heavyKind('img/hero.png', id('img/hero.png'))).toBe('binary');
    expect(heavyKind('src/parser.ts', id('src/parser.ts'))).toBeNull();
  });
});

describe('findBlackHoles', () => {
  it('ignores huge hand-written files: only generated or binary mass qualifies', () => {
    expect(holesFor([...small, { path: 'src/huge.ts', size: 900 * KB }])).toEqual([]);
  });

  it('needs real weight: 192 KB and 40x the median', () => {
    expect(holesFor([...small, { path: 'yarn.lock', size: 100 * KB }])).toEqual([]);
    const h = holesFor([...small, { path: 'yarn.lock', size: 400 * KB }]);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ index: 40, kind: 'lockfile' });
  });

  it('keeps at most three, heaviest first, with mass growing with size', () => {
    const big = [1, 2, 3, 4].map((k) => ({ path: `assets/v${k}.mp4`, size: k * 600 * KB }));
    const h = holesFor([...small, ...big]);
    expect(h).toHaveLength(MAX_HOLES);
    expect(h.map((x) => x.index)).toEqual([43, 42, 41]);
    expect(h[0].mass).toBeGreaterThan(h[2].mass);
    for (const x of h) expect(x.mass).toBeGreaterThanOrEqual(0.45);
    for (const x of h) expect(x.mass).toBeLessThanOrEqual(1);
  });

  it('has nothing to say about tiny repos', () => {
    expect(holesFor([{ path: 'a.png', size: 5_000_000 }])).toEqual([]);
  });
});

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
