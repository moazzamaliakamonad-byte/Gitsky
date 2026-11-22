/**
 * Live collision values shared between the scene (CollisionView, every frame) and the
 * DOM (CollisionHud, on its own animation frame). Plain mutable data, no React state.
 */
export const collisionClock = {
  /** Simulated seconds since the start. */
  t: 0,
  /** Core separation divided by the pair's combined radii. */
  separation: 10,
  playing: true,
  /** Set to true to restart the simulation on the next frame. */
  reset: false,
  /** Name labels for the two galaxies, positioned by CollisionView. */
  labels: [null, null] as (HTMLElement | null)[],
};
