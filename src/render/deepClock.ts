import { NOW } from '../data/deepTime';

/**
 * Deep time's playhead, outside React because it moves every frame (DeepDriver).
 *
 * - `epoch`: fractional moment, 0 = the first commit … `last` = today. When deep time is
 *   off it sits far in the future, so every star is simply alive.
 * - `alive`: the share of today's files that exist at the playhead (0..1), which dims
 *   the haze and nebulae while the galaxy is young.
 */
export const OFF = 1e4;
export const deepClock = { epoch: OFF, last: 0, alive: 1 };

/** A birth moment from the history (NOW = born today) on the playhead's scale. */
export function momentOf(born: number): number {
  return born === NOW ? deepClock.last : born;
}
