import { useStore } from './store';
import { stopTour } from './tour';
import { closeUniverse } from './universeActions';
import { warpUp } from './systemActions';
import { endCollision } from './collisionActions';

/**
 * Drift mode: the interface fades away, the browser goes full screen, and the camera
 * drifts through the galaxy on its own (render/DriftDriver.tsx), moving on to the next
 * featured sky every so often. Any key or click brings everything back.
 */
export function startDrift() {
  const s = useStore.getState();
  if (s.drift) return;
  if (s.tour) stopTour();
  if (s.universe) closeUniverse();
  else if (s.system !== null) warpUp();
  else if (s.collision) endCollision();
  s.set({
    drift: true,
    heroOpen: false,
    panel: 'none',
    selection: null,
    highlight: null,
    playing: !s.reducedMotion,
  });
  document.documentElement.requestFullscreen?.().catch(() => undefined);
}

export function stopDrift() {
  if (!useStore.getState().drift) return;
  useStore.getState().set({ drift: false });
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
}
