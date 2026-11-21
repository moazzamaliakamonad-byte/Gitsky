import { describe, expect, it } from 'vitest';
import { syntheticRepo } from '../src/data/synthetic';

describe('syntheticRepo (stress testing only)', () => {
  it('produces exactly n files with unique sorted paths', () => {
    const r = syntheticRepo(5000);
    expect(r.files).toHaveLength(5000);
    const paths = r.files.map((f) => f.path);
    expect(new Set(paths).size).toBe(5000);
    expect([...paths].sort()).toEqual(paths);
  });

  it('labels itself so it can never pass for a real repo', () => {
    const r = syntheticRepo(100);
    expect(r.meta.fullName).toMatch(/synthetic/i);
    expect(r.meta.description).toMatch(/not a real repository/i);
    expect(r.meta.stars).toBe(0);
  });

  it('is deterministic', () => {
    expect(syntheticRepo(300)).toEqual(syntheticRepo(300));
  });

  it('has commits that only reference existing files', () => {
    const r = syntheticRepo(2000);
    expect(r.commits.length).toBeGreaterThan(0);
    for (const c of r.commits) for (const f of c.files) expect(f).toBeLessThan(2000);
  });
});
