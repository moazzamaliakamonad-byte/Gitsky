import type { Commit } from '../data/types';

/** Seconds of playback per commit. */
export const SECONDS_PER_COMMIT = 1.15;
/** Fraction of a commit's slot after which its comets reach their stars. */
export const ARRIVE = 0.72;
/** Pause at the end of the loop, in commit slots. */
export const LOOP_TAIL = 2;

/**
 * For each file: the index of the latest commit ≤ `upTo` that touched it, or -1.
 * Written into the `aTouch` attribute; the shader turns (playhead − aTouch) into a flash.
 */
export function lastTouches(
  fileCount: number,
  commits: Commit[],
  upTo: number,
  out?: Float32Array,
): Float32Array {
  const touch = out ?? new Float32Array(fileCount);
  touch.fill(-1);
  const last = Math.min(commits.length - 1, Math.floor(upTo));
  for (let c = 0; c <= last; c++) {
    for (const f of commits[c].files) touch[f] = c;
  }
  return touch;
}

/** Where playback starts: one slot of calm before the first comet. */
export const START = -1;

/** Advance the playhead; after the last commit, pause, then loop back to the start. */
export function advancePlayhead(playhead: number, dtSeconds: number, commitCount: number): number {
  if (commitCount === 0) return START;
  const next = playhead + dtSeconds / SECONDS_PER_COMMIT;
  return next >= commitCount + LOOP_TAIL ? START : next;
}
