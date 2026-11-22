import { describe, expect, it } from 'vitest';
import { buildFolderTree } from '../src/layout/tree';
import {
  layoutSystem,
  MAX_GIANTS,
  MAX_PLANETS,
  orbitPosition,
  planetRadius,
} from '../src/layout/system';

function setup(direct: number, subfolders: number) {
  const files = [
    ...Array.from({ length: direct }, (_, i) => ({
      path: `pkg/f${String(i).padStart(3, '0')}.ts`,
      size: 100 * (i + 1),
    })),
    ...Array.from({ length: subfolders * 3 }, (_, i) => ({
      path: `pkg/sub${Math.floor(i / 3)}/g${i}.ts`,
      size: 1000 * (Math.floor(i / 3) + 1),
    })),
  ];
  const tree = buildFolderTree(files);
  const pkg = tree.byPath.get('pkg')!;
  return { files, tree, pkg };
}

describe('layoutSystem', () => {
  it('makes each direct file a planet, up to the cap, and the rest a belt', () => {
    const { files, tree, pkg } = setup(30, 0);
    const s = layoutSystem(files, tree, new Uint16Array(files.length), pkg);
    expect(s.planets).toHaveLength(MAX_PLANETS);
    expect(s.belt?.files).toHaveLength(30 - MAX_PLANETS);
    expect(s.giants).toHaveLength(0);
  });

  it('puts the most-changed files on the innermost orbits', () => {
    const { files, tree, pkg } = setup(10, 0);
    const churn = new Uint16Array(files.length);
    churn[7] = 5;
    churn[3] = 2;
    const s = layoutSystem(files, tree, churn, pkg);
    expect(s.planets[0].file).toBe(7);
    expect(s.planets[1].file).toBe(3);
    expect(s.planets[0].heat).toBe(1);
    expect(s.planets[1].heat).toBeCloseTo(0.4);
  });

  it('spaces orbits outward with Kepler speeds: further out is slower', () => {
    const { files, tree, pkg } = setup(12, 4);
    const s = layoutSystem(files, tree, new Uint16Array(files.length), pkg);
    const bodies = [...s.planets, ...s.giants];
    for (let i = 1; i < bodies.length; i++) {
      expect(bodies[i].orbit).toBeGreaterThan(bodies[i - 1].orbit);
      expect(bodies[i].speed).toBeLessThan(bodies[i - 1].speed);
    }
    expect(s.planets[0].orbit).toBeGreaterThan(s.sunRadius);
    expect(s.extent).toBeGreaterThan(bodies[bodies.length - 1].orbit);
  });

  it('makes sub-folders gas giants (largest first), with moons and a count of the rest', () => {
    const { files, tree, pkg } = setup(2, 11);
    const s = layoutSystem(files, tree, new Uint16Array(files.length), pkg);
    expect(s.giants).toHaveLength(MAX_GIANTS);
    expect(s.hiddenFolders).toBe(3);
    expect(tree.folders[s.giants[0].folder].path).toBe('pkg/sub10');
    expect(s.giants[0].moons).toBe(3);
  });

  it('sizes planets by bytes on a log scale', () => {
    expect(planetRadius(10_000)).toBeGreaterThan(planetRadius(100));
    expect(planetRadius(1_000_000) / planetRadius(100)).toBeLessThan(3);
  });

  it('is deterministic', () => {
    const { files, tree, pkg } = setup(8, 3);
    const churn = new Uint16Array(files.length);
    expect(layoutSystem(files, tree, churn, pkg)).toEqual(layoutSystem(files, tree, churn, pkg));
  });
});

describe('orbitPosition', () => {
  it('stays on its orbit radius and moves with time', () => {
    const o = { orbit: 10, speed: 0.5, phase: 0.3, incline: 0.1, node: 1.2 };
    const a = orbitPosition(o, 0, [0, 0, 0]);
    const b = orbitPosition(o, 2, [0, 0, 0]);
    expect(Math.hypot(...a)).toBeCloseTo(10);
    expect(Math.hypot(...b)).toBeCloseTo(10);
    expect(a).not.toEqual(b);
  });
});
