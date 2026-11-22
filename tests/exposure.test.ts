import { describe, expect, it } from 'vitest';
import { densityExposure } from '../src/render/exposure';
import { buildGlow } from '../src/render/glow';
import { buildModel } from '../src/state/model';
import type { RepoData } from '../src/data/types';

function repo(n: number): RepoData {
  return {
    meta: {
      owner: 'o',
      repo: 'r',
      fullName: 'o/r',
      description: null,
      stars: 0,
      language: null,
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/o/r',
    },
    branch: 'main',
    headSha: 'x',
    truncated: false,
    files: Array.from({ length: n }, (_, i) => ({
      path: `d${i % 7}/f${String(i).padStart(5, '0')}.ts`,
      size: 100 + i,
    })),
    commits: [],
    sampling: { listed: 0, detailed: 0, withToken: false },
    fetchedAt: '2024-01-01T00:00:00.000Z',
    capped: null,
  };
}

describe('densityExposure', () => {
  it('leaves small skies at full brightness and dims dense ones to a floor', () => {
    expect(densityExposure(0)).toBe(1);
    expect(densityExposure(2500)).toBe(1);
    expect(densityExposure(10000)).toBeCloseTo(0.5);
    expect(densityExposure(50000)).toBe(0.26);
  });
});

describe('buildGlow', () => {
  it('gives every file the same share of glow points until the cap', () => {
    expect(buildGlow(buildModel(repo(100), 'bundled'), 36000).count).toBe(400);
    expect(buildGlow(buildModel(repo(20000), 'bundled'), 36000).count).toBe(36000);
  });

  it('is deterministic and stays near the real stars', () => {
    const model = buildModel(repo(300), 'bundled');
    const a = buildGlow(model, 36000);
    const b = buildGlow(model, 36000);
    expect(a.pos).toEqual(b.pos);
    let far = 0;
    for (let j = 0; j < a.count; j++) {
      const r = Math.hypot(a.pos[j * 3], a.pos[j * 3 + 2]);
      if (r > model.layout.radius * 1.5) far++;
    }
    expect(far / a.count).toBeLessThan(0.01);
  });

  it('builds nothing for an empty repo', () => {
    expect(buildGlow(buildModel(repo(0), 'bundled'), 36000).count).toBe(0);
  });
});
