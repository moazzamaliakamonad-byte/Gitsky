import { closeDeepTime } from './deepActions';
import { START } from '../render/timeline';
import { timelineClock } from '../render/timelineClock';
import { focusGalaxy } from '../ui/focus';
import { clearSelection, selectFile, selectFolder } from './selection';
import { useStore } from './store';
import { enterSystem, exitSystem } from './systemActions';
import { planTour, type TourAction } from './tourPlan';

let timer: ReturnType<typeof setTimeout> | null = null;

function apply(a: TourAction) {
  switch (a.kind) {
    case 'overview':
      clearSelection();
      focusGalaxy();
      break;
    case 'folder':
      selectFolder(a.folder, { fly: true });
      break;
    case 'file':
      useStore.getState().set({ highlight: null });
      selectFile(a.file, { fly: true });
      break;
    case 'system':
      clearSelection();
      enterSystem(a.folder);
      break;
    case 'leave-system':
      exitSystem();
      break;
    case 'replay':
      clearSelection();
      timelineClock.playhead = START;
      useStore.getState().set({ playing: true, commitIndex: -1 });
      focusGalaxy();
      break;
  }
}

/** Start the guided tour of the current repo (from the galaxy view). */
export function startTour() {
  if (useStore.getState().deep) closeDeepTime();
  const s = useStore.getState();
  if (!s.model) return;
  stopTour();
  s.set({ heroOpen: false, panel: 'none', universe: null, collision: null, interacted: true });
  const steps = planTour(s.model);
  const run = (i: number) => {
    if (i >= steps.length) {
      stopTour();
      return;
    }
    const step = steps[i];
    apply(step.action);
    useStore.getState().set({
      tour: { step: i, total: steps.length, caption: step.caption, seconds: step.seconds },
    });
    timer = setTimeout(() => run(i + 1), step.seconds * 1000);
  };
  // If we're inside a system, warp out first, then begin.
  if (s.system !== null) {
    exitSystem();
    timer = setTimeout(() => run(0), 2400);
  } else run(0);
}

export function stopTour() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (useStore.getState().tour) useStore.getState().set({ tour: null });
}
