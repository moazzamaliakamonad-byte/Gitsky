import type { Commit } from '../data/types';

export interface Churn {
  /** How many sampled commits touched each file. */
  counts: Uint16Array;
  max: number;
  /** 0..1 brightness for the shader. Hot files near 1, untouched files dim. */
  brightness: Float32Array;
}

/** Brightness of files the sample never touched. */
export const QUIET = 0.38;
/** Brightness for everything when there are no sampled commits (no data, so no judgement). */
export const NEUTRAL = 0.62;

export function computeChurn(fileCount: number, commits: Commit[]): Churn {
  const counts = new Uint16Array(fileCount);
  for (const c of commits) {
    for (const f of c.files) if (counts[f] < 65535) counts[f]++;
  }
  let max = 0;
  for (let i = 0; i < fileCount; i++) if (counts[i] > max) max = counts[i];

  const brightness = new Float32Array(fileCount);
  if (max === 0) {
    brightness.fill(NEUTRAL);
  } else {
    // log1p: going from 0→1 touch is a big jump; 20→21 barely matters.
    const denom = Math.log1p(max);
    for (let i = 0; i < fileCount; i++) {
      brightness[i] = QUIET + (1 - QUIET) * (Math.log1p(counts[i]) / denom);
    }
  }
  return { counts, max, brightness };
}
