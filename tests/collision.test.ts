import { describe, expect, it } from 'vitest';
import {
  coreSeparation,
  setupCollision,
  sharedPaths,
  stepCollision,
} from '../src/layout/collision';

/** A flat disk of n stars out to radius R, deterministic. */
function disk(n: number, R: number) {
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = R * Math.sqrt((i + 0.5) / n);
    const a = i * 2.399963; // golden angle
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  return { positions, count: n, extent: R };
}

function coreDist(s: ReturnType<typeof setupCollision>, i: number) {
  const o = s.galaxy[i] * 3;
  return Math.hypot(
    s.pos[i * 3] - s.corePos[o],
    s.pos[i * 3 + 1] - s.corePos[o + 1],
    s.pos[i * 3 + 2] - s.corePos[o + 2],
  );
}

describe('setupCollision', () => {
  it('places both galaxies around their cores, with one star per file', () => {
    const s = setupCollision(disk(300, 80), disk(120, 50));
    expect(s.n).toBe(420);
    expect(s.galaxy.filter((g) => g === 1)).toHaveLength(120);
    for (let i = 0; i < s.n; i++) expect(coreDist(s, i)).toBeLessThanOrEqual(81);
    expect(coreSeparation(s)).toBeGreaterThan(s.scale);
  });

  it('samples big galaxies down to the cap', () => {
    const s = setupCollision(disk(5000, 80), disk(100, 40), { cap: 1000 });
    expect(s.n).toBe(1100);
  });

  it('gives the bigger repo more mass', () => {
    const s = setupCollision(disk(900, 80), disk(100, 40));
    expect(s.mass[0]).toBeGreaterThan(s.mass[1]);
    expect(s.mass[0] + s.mass[1]).toBeCloseTo(2);
  });
});

describe('stepCollision', () => {
  it('keeps disks in orbit while the galaxies are still apart', () => {
    const s = setupCollision(disk(200, 80), disk(200, 80));
    const before = Array.from({ length: s.n }, (_, i) => coreDist(s, i));
    for (let k = 0; k < 20; k++) stepCollision(s, 0.05);
    let worst = 0;
    for (let i = 0; i < s.n; i++) worst = Math.max(worst, Math.abs(coreDist(s, i) - before[i]));
    expect(worst).toBeLessThan(80 * 0.08);
  });

  it('plays the whole story: close pass, swing apart with tails, then merge', () => {
    const s = setupCollision(disk(400, 80), disk(400, 80));
    const seps: number[] = [];
    let tail = 0;
    for (let k = 0; k <= 2000; k++) {
      if (k % 20 === 0) seps.push(coreSeparation(s));
      if (k === 400) {
        for (let i = 0; i < s.n; i++) if (coreDist(s, i) > s.scale * 0.9) tail++;
      }
      stepCollision(s, 0.05);
    }
    const first = seps.findIndex((d, i) => i > 0 && d > seps[i - 1]); // first time they separate
    expect(first).toBeGreaterThan(0);
    expect(Math.max(...seps.slice(first))).toBeGreaterThan(seps[first - 1] * 1.3);
    expect(tail / s.n).toBeGreaterThan(0.05); // stars flung into tidal tails
    expect(seps[seps.length - 1]).toBeLessThan(s.scale * 0.15); // merged
  });

  it('is deterministic', () => {
    const a = setupCollision(disk(150, 60), disk(90, 40));
    const b = setupCollision(disk(150, 60), disk(90, 40));
    for (let k = 0; k < 50; k++) {
      stepCollision(a, 0.05);
      stepCollision(b, 0.05);
    }
    expect(a.pos).toEqual(b.pos);
  });
});

describe('sharedPaths', () => {
  it('pairs files that exist at the same path in both repos', () => {
    const a = [{ path: 'README.md' }, { path: 'src/a.ts' }, { path: 'LICENSE' }];
    const b = [{ path: 'LICENSE' }, { path: 'lib/b.ts' }, { path: 'README.md' }];
    expect(sharedPaths(a, b)).toEqual([
      [0, 2],
      [2, 0],
    ]);
    expect(sharedPaths(a, b, 1)).toHaveLength(1);
  });
});
