import { START } from './timeline';

/**
 * The fractional playhead (index into the sampled commits), advanced every frame by
 * TimelineDriver. It lives outside React state on purpose: it changes 60× a second.
 * React only hears about whole-commit changes (store.commitIndex).
 */
export const timelineClock = { playhead: START };
