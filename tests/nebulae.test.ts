import { describe, expect, it } from 'vitest';
import { computeNebulae, dominantLanguages } from '../src/layout/nebulae';
import { computeLayout } from '../src/layout/galaxy';
import { languageOf } from '../src/layout/color';
import type { FileEntry } from '../src/data/types';

const files: FileEntry[] = [
  ...Array.from({ length: 40 }, (_, i) => ({ path: `go/src/f${i}.go`, size: 100 })),
  ...Array.from({ length: 10 }, (_, i) => ({ path: `go/docs/d${i}.md`, size: 100 })),
  ...Array.from({ length: 30 }, (_, i) => ({ path: `web/a${i}.ts`, size: 100 })),
  { path: 'README.md', size: 10 },
];

describe('dominantLanguages', () => {
  it('finds the most common language in each folder subtree', () => {
    const layout = computeLayout(files);
    const dom = dominantLanguages(files, layout.tree);
    const idx = (p: string) => layout.tree.byPath.get(p)!;
    expect(dom[idx('go')]).toBe(languageOf('x.go').id);
    expect(dom[idx('go/docs')]).toBe(languageOf('x.md').id);
    expect(dom[idx('web')]).toBe(languageOf('x.ts').id);
  });
});

describe('computeNebulae', () => {
  it('creates one cloud per sizeable folder, biggest first, with finite values', () => {
    const layout = computeLayout(files);
    const touched = new Uint16Array(files.length);
    touched[0] = 3;
    const neb = computeNebulae(files, layout, touched, { minFiles: 8, max: 10 });
    expect(neb.count).toBeGreaterThanOrEqual(3);
    expect(neb.folders[0]).toBe(layout.tree.byPath.get('go'));
    for (const v of neb.centers) expect(Number.isFinite(v)).toBe(true);
    for (const v of neb.radii) expect(v).toBeGreaterThan(0);
  });

  it('makes folders with churn glow more than quiet ones', () => {
    const layout = computeLayout(files);
    const touched = new Uint16Array(files.length);
    for (let i = 0; i < 40; i++) touched[i] = 2; // all of go/src
    const neb = computeNebulae(files, layout, touched, { minFiles: 8, max: 10 });
    const at = (p: string) => neb.folders.indexOf(layout.tree.byPath.get(p)!);
    expect(neb.intensity[at('go/src')]).toBeGreaterThan(neb.intensity[at('web')]);
  });

  it('respects the cap', () => {
    const layout = computeLayout(files);
    const neb = computeNebulae(files, layout, new Uint16Array(files.length), {
      minFiles: 1,
      max: 2,
    });
    expect(neb.count).toBe(2);
  });
});
