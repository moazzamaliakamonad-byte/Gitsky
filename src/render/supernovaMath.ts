import type { Commit } from '../data/types';
import { ARRIVE, SECONDS_PER_COMMIT } from './timeline';

/**
 * The supernova: the most-changed file in the sample explodes the first time a comet
 * lands on it during playback. Like the comets, it's a pure function of the playhead.
 */
export interface SupernovaPlan {
  file: number;
  /** Index of the first sampled commit that touched it (its comet triggers the blast). */
  commit: number;
  /** How many sampled commits touched it. */
  touches: number;
}

export interface SupernovaState {
  /** Seconds since impact. */
  age: number;
  /** 1 at impact, decaying fast: the blinding flash. */
  flash: number;
  /** 0 → 1: how far the shock shell has expanded. */
  shell: number;
  /** 0 … 1: brightness of the lingering remnant nebula. */
  remnant: number;
}

export function planSupernova(commits: Commit[], fileCount: number): SupernovaPlan | null {
  const counts = new Uint16Array(fileCount);
  for (const c of commits) for (const f of c.files) counts[f]++;
  let file = -1;
  for (let i = 0; i < fileCount; i++) if (counts[i] > (file < 0 ? 1 : counts[file])) file = i;
  if (file < 0) return null;
  const commit = commits.findIndex((c) => c.files.includes(file));
  return { file, commit, touches: counts[file] };
}

export function supernovaAt(plan: SupernovaPlan, playhead: number): SupernovaState | null {
  const slots = playhead - (plan.commit + ARRIVE);
  if (slots < 0) return null;
  const age = slots * SECONDS_PER_COMMIT;
  return {
    age,
    flash: Math.exp(-age * 2.2),
    shell: 1 - Math.exp(-age * 0.9),
    // Rises with the shell, then settles to a steady, faint glow for the rest of the loop.
    remnant: Math.min(1, age * 2) * (0.35 + 0.65 * Math.exp(-age * 0.45)),
  };
}
