import { loadDeepHistory } from '../data/deepLoad';
import { GitHubError } from '../data/github';
import { findBundled } from '../data/bundled';
import { deepClock, OFF } from '../render/deepClock';
import { timelineClock } from '../render/timelineClock';
import { START } from '../render/timeline';
import { useStore } from './store';
import { stopTour } from './tour';
import { closeUniverse } from './universeActions';
import { warpUp } from './systemActions';
import { endCollision } from './collisionActions';

let abort: AbortController | null = null;

/**
 * Deep time: the galaxy forming over the repo's whole life. Loads the history (prebuilt
 * for featured skies, cached, or from GitHub), then plays it from the first commit to
 * today. The commit replay pauses meanwhile, so no comets fly.
 */
export async function openDeepTime() {
  const s = useStore.getState();
  const model = s.model;
  if (!model || s.deep) return;
  if (s.tour) stopTour();
  if (s.universe) closeUniverse();
  else if (s.system !== null) warpUp();
  else if (s.collision) endCollision();

  abort?.abort();
  abort = new AbortController();
  const signal = abort.signal;
  timelineClock.playhead = START;
  s.set({
    deep: { status: 'loading', done: 0, total: 0, epoch: 0, playing: false },
    playing: false,
    commitIndex: -1,
    selection: null,
    highlight: null,
    panel: s.panel === 'list' || s.panel === 'share' ? s.panel : 'none',
  });
  s.fly([0, 0, 0], model.layout.extent * 1.85 + 14);

  try {
    const history = await loadDeepHistory(model.data, {
      bundled:
        model.source === 'bundled' ? findBundled(s.bundled, model.data.meta.fullName) : undefined,
      signal,
      onProgress: (done, total) => {
        const d = useStore.getState().deep;
        if (d && !signal.aborted) useStore.getState().set({ deep: { ...d, done, total } });
      },
    });
    if (signal.aborted || useStore.getState().model !== model) return;
    deepClock.last = history.epochs.length;
    deepClock.epoch = useStore.getState().reducedMotion ? history.epochs.length : 0;
    useStore.getState().set({
      deep: {
        status: 'ready',
        done: 0,
        total: 0,
        history,
        epoch: Math.floor(deepClock.epoch),
        playing: !useStore.getState().reducedMotion,
      },
    });
  } catch (e) {
    if (signal.aborted) return;
    closeDeepTime();
    const reset =
      e instanceof GitHubError && e.kind === 'rate_limited' && e.resetAt
        ? ` Try again after ${new Date(e.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
        : '';
    useStore.getState().set({
      notice:
        e instanceof GitHubError && e.kind === 'rate_limited'
          ? `Deep time needs more GitHub requests than are left this hour.${reset}`
          : "Couldn't read this repo's history.",
    });
  }
}

export function closeDeepTime() {
  abort?.abort();
  abort = null;
  deepClock.epoch = OFF;
  deepClock.alive = 1;
  const s = useStore.getState();
  if (!s.deep) return;
  s.set({ deep: null, playing: !s.reducedMotion });
}

/** Jump to a moment (fractional). Pauses playback. */
export function seekDeep(epoch: number) {
  const d = useStore.getState().deep;
  if (!d?.history) return;
  deepClock.epoch = Math.max(0, Math.min(deepClock.last, epoch));
  useStore.getState().set({ deep: { ...d, playing: false, epoch: Math.floor(deepClock.epoch) } });
}

export function toggleDeepPlay() {
  const d = useStore.getState().deep;
  if (!d?.history) return;
  // Pressing play at the end starts again from the first commit.
  if (!d.playing && deepClock.epoch >= deepClock.last) deepClock.epoch = 0;
  useStore.getState().set({ deep: { ...d, playing: !d.playing } });
}
