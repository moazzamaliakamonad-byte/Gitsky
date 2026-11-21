import { describe, expect, it } from 'vitest';
import { buildFolderTree } from '../src/layout/tree';
import { computeLayout, spiralRadius } from '../src/layout/galaxy';
import type { FileEntry } from '../src/data/types';

/** A synthetic repo shaped like real ones: a few big top-level dirs, nested, uneven. */
function synthetic(n: number): FileEntry[] {
  const files: FileEntry[] = [];
  const tops = ['src', 'packages', 'test', 'docs', 'scripts', 'examples', 'vendor', 'tools'];
  for (let i = 0; i < n; i++) {
    const top = tops[(i * 7919) % tops.length];
    const a = `m${(i * 31) % 23}`;
    const b = `n${(i * 17) % 11}`;
    const depth = i % 4;
    const dir = [top, a, b].slice(0, depth).join('/');
    const name = `file${i}.${['ts', 'js', 'md', 'go'][i % 4]}`;
    files.push({ path: dir ? `${dir}/${name}` : name, size: (i * 2654435761) % 100000 });
  }
  return files.sort((x, y) => (x.path < y.path ? -1 : 1));
}

describe('buildFolderTree', () => {
  it('builds nested folders with recursive counts', () => {
    const t = buildFolderTree([
      { path: 'README.md', size: 1 },
      { path: 'src/a.ts', size: 10 },
      { path: 'src/lib/b.ts', size: 100 },
      { path: 'src/lib/c.ts', size: 1000 },
    ]);
    const root = t.folders[0];
    expect(root.path).toBe('');
    expect(root.totalFiles).toBe(4);
    expect(root.totalBytes).toBe(1111);
    const src = t.folders[t.byPath.get('src')!];
    expect(src.totalFiles).toBe(3);
    expect(src.files).toEqual([1]);
    const lib = t.folders[t.byPath.get('src/lib')!];
    expect(lib.parent).toBe(t.byPath.get('src'));
    expect(lib.depth).toBe(2);
    expect(Array.from(t.fileFolder)).toEqual([0, src.index, lib.index, lib.index]);
  });
});

describe('spiralRadius', () => {
  it('is a logarithmic spiral: r(0) = a, and equal angle steps multiply r by e^(b·Δθ)', () => {
    const a = 5;
    const b = 0.3;
    expect(spiralRadius(a, b, 0)).toBeCloseTo(5);
    const r1 = spiralRadius(a, b, 1);
    const r2 = spiralRadius(a, b, 2);
    expect(r2 / r1).toBeCloseTo(r1 / a);
  });
});

describe('computeLayout', () => {
  const files = synthetic(3000);

  it('is deterministic: same repo, same sky', () => {
    const a = computeLayout(files);
    const b = computeLayout(files);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });

  it('gives every file a finite position (no NaN, no Infinity)', () => {
    const { positions } = computeLayout(files);
    expect(positions.length).toBe(files.length * 3);
    for (const v of positions) expect(Number.isFinite(v)).toBe(true);
  });

  it('reports a bounding radius that contains every star', () => {
    const { positions, radius } = computeLayout(files);
    let max = 0;
    for (let i = 0; i < positions.length; i += 3) {
      max = Math.max(max, Math.hypot(positions[i], positions[i + 1], positions[i + 2]));
    }
    expect(radius).toBeGreaterThanOrEqual(max - 1e-6);
    expect(radius).toBeLessThan(600);
  });

  it('is a disk: much flatter in y than in x/z', () => {
    const { positions } = computeLayout(files);
    let xz = 0;
    let y = 0;
    for (let i = 0; i < positions.length; i += 3) {
      xz += Math.abs(positions[i]) + Math.abs(positions[i + 2]);
      y += Math.abs(positions[i + 1]);
    }
    expect(y * 2).toBeLessThan(xz * 0.5);
  });

  it('puts bigger top-level folders closer to the core', () => {
    const big = Array.from({ length: 400 }, (_, i) => ({ path: `big/f${i}.ts`, size: 10 }));
    const mid = Array.from({ length: 60 }, (_, i) => ({ path: `mid/f${i}.ts`, size: 10 }));
    const small = Array.from({ length: 5 }, (_, i) => ({ path: `small/f${i}.ts`, size: 10 }));
    const extra = ['a', 'b', 'c', 'd'].map((d) => ({ path: `${d}/x.ts`, size: 1 }));
    const l = computeLayout([...big, ...mid, ...small, ...extra]);
    const dist = (p: string) => {
      const f = l.tree.byPath.get(p)!;
      return Math.hypot(l.folderCenters[f * 3], l.folderCenters[f * 3 + 2]);
    };
    expect(dist('big')).toBeLessThan(dist('mid'));
    expect(dist('mid')).toBeLessThan(dist('small'));
  });

  it('keeps files near their own folder', () => {
    const l = computeLayout(files);
    let near = 0;
    for (let i = 0; i < files.length; i++) {
      const f = l.tree.fileFolder[i];
      const dx = l.positions[i * 3] - l.folderCenters[f * 3];
      const dy = l.positions[i * 3 + 1] - l.folderCenters[f * 3 + 1];
      const dz = l.positions[i * 3 + 2] - l.folderCenters[f * 3 + 2];
      if (Math.hypot(dx, dy, dz) <= l.folderRadii[f] * 3 + 1) near++;
    }
    expect(near / files.length).toBeGreaterThan(0.97);
  });

  it('handles tiny repos: one file, root only', () => {
    const l = computeLayout([{ path: 'index.js', size: 5 }]);
    for (const v of l.positions) expect(Number.isFinite(v)).toBe(true);
  });

  it('handles an empty file list', () => {
    const l = computeLayout([]);
    expect(l.positions.length).toBe(0);
    expect(Number.isFinite(l.radius)).toBe(true);
  });

  it('lays out 50,000 files in under ~200ms', () => {
    const big = synthetic(50_000);
    computeLayout(synthetic(2000)); // warm up the JIT
    const t0 = performance.now();
    computeLayout(big);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(250); // small slack over the 200ms target for CI noise
  });
});
