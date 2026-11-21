import { describe, expect, it } from 'vitest';
import { languageOf, legendFor, LANGUAGES, hexToRgb, spectrumOf } from '../src/layout/color';
import { sizeFromBytes } from '../src/layout/size';
import { computeChurn } from '../src/layout/churn';
import type { Commit } from '../src/data/types';

describe('languageOf', () => {
  it('maps common extensions', () => {
    expect(languageOf('src/index.ts').name).toBe('TypeScript');
    expect(languageOf('a/b/App.tsx').name).toBe('TSX');
    expect(languageOf('lib.mjs').name).toBe('JavaScript');
    expect(languageOf('main.go').name).toBe('Go');
    expect(languageOf('lib.rs').name).toBe('Rust');
    expect(languageOf('README.md').name).toBe('Markdown');
  });

  it('is case-insensitive and recognises special file names', () => {
    expect(languageOf('FOO.TS').name).toBe('TypeScript');
    expect(languageOf('docker/Dockerfile').name).toBe('Docker');
    expect(languageOf('Makefile').name).toBe('Make');
  });

  it('falls back to Other', () => {
    expect(languageOf('weird.xyzzy').name).toBe('Other');
    expect(languageOf('LICENSE').name).toBe('Text');
  });
});

describe('palette', () => {
  it('has a valid color for every language', () => {
    for (const l of LANGUAGES) {
      const [r, g, b] = hexToRgb(l.color);
      for (const c of [r, g, b]) expect(c).toBeGreaterThanOrEqual(0);
      for (const c of [r, g, b]) expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('gives related languages related hues (TS and TSX share a family)', () => {
    expect(languageOf('a.ts').family).toBe(languageOf('a.tsx').family);
    expect(languageOf('a.c').family).toBe(languageOf('a.cpp').family);
    expect(languageOf('a.json').family).toBe(languageOf('a.yaml').family);
  });
});

describe('legendFor', () => {
  it('lists languages by file count, capped, with the rest grouped as Other', () => {
    const paths = ['a.ts', 'b.ts', 'c.ts', 'd.go', 'e.go', 'f.md', 'g.rs', 'h.py'];
    const legend = legendFor(
      paths.map((p) => ({ path: p, size: 1 })),
      3,
    );
    expect(legend.map((l) => l.name)).toEqual(['TypeScript', 'Go', 'Markdown', 'Other']);
    expect(legend[0].count).toBe(3);
    expect(legend[3].count).toBe(2);
  });
});

describe('sizeFromBytes', () => {
  it('grows with the log of bytes and stays in range', () => {
    expect(sizeFromBytes(0)).toBeGreaterThan(0);
    expect(sizeFromBytes(1000)).toBeGreaterThan(sizeFromBytes(100));
    // log scale: x10 bytes adds a constant amount
    const d1 = sizeFromBytes(1000) - sizeFromBytes(100);
    const d2 = sizeFromBytes(10000) - sizeFromBytes(1000);
    expect(d1).toBeCloseTo(d2);
    expect(sizeFromBytes(1e12)).toBeLessThanOrEqual(5);
  });
});

describe('computeChurn', () => {
  const commit = (files: number[]): Commit => ({
    sha: 'x',
    message: '',
    author: 'a',
    date: '2024-01-01T00:00:00Z',
    files,
    changedCount: files.length,
  });

  it('counts how many sampled commits touched each file', () => {
    const c = computeChurn(4, [commit([0, 1]), commit([1]), commit([1, 3])]);
    expect(Array.from(c.counts)).toEqual([1, 3, 0, 1]);
    expect(c.max).toBe(3);
  });

  it('makes hot files brighter and untouched files dimmer', () => {
    const c = computeChurn(3, [commit([0]), commit([0]), commit([1])]);
    expect(c.brightness[0]).toBeGreaterThan(c.brightness[1]);
    expect(c.brightness[1]).toBeGreaterThan(c.brightness[2]);
    expect(c.brightness[0]).toBeCloseTo(1);
  });

  it('uses a neutral brightness when nothing was sampled', () => {
    const c = computeChurn(2, []);
    expect(c.brightness[0]).toBe(c.brightness[1]);
    expect(c.brightness[0]).toBeGreaterThan(0.4);
  });
});

describe('spectrumOf', () => {
  it('gives language fractions by bytes that sum to 1, biggest first', () => {
    const sp = spectrumOf([
      { path: 'a.ts', size: 600 },
      { path: 'b.go', size: 300 },
      { path: 'c.md', size: 100 },
    ]);
    expect(sp.map(([c]) => c)).toEqual([
      languageOf('a.ts').color,
      languageOf('b.go').color,
      languageOf('c.md').color,
    ]);
    expect(sp.reduce((s, [, f]) => s + f, 0)).toBeCloseTo(1);
  });

  it('is empty for a repo of empty files', () => {
    expect(spectrumOf([{ path: 'a.ts', size: 0 }])).toEqual([]);
  });
});
