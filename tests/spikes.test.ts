import { describe, expect, it } from 'vitest';
import { computeSpikes } from '../src/layout/spikes';

describe('computeSpikes', () => {
  it('gives spikes only to the very largest files and the hottest ones', () => {
    const sizes = Array.from({ length: 1000 }, (_, i) => i); // file 999 is largest
    const counts = new Uint16Array(1000);
    counts[5] = 4; // hottest
    counts[6] = 1;
    const s = computeSpikes(sizes, counts);
    const spiked = [...s.keys()].filter((i) => s[i] > 0);
    expect(spiked).toContain(999);
    expect(spiked).toContain(5);
    expect(spiked.length).toBeLessThanOrEqual(12);
    expect(s[5]).toBeGreaterThan(s[999]); // churn spikes outshine size spikes
  });

  it('caps the count on huge repos', () => {
    const n = 50_000;
    const s = computeSpikes(
      Array.from({ length: n }, (_, i) => i),
      new Uint16Array(n),
    );
    expect([...s].filter((v) => v > 0).length).toBeLessThanOrEqual(40);
  });

  it('gives no size spikes to empty files', () => {
    const s = computeSpikes([0, 0, 0], new Uint16Array(3));
    expect([...s].every((v) => v === 0)).toBe(true);
  });
});
