import { fetchUniverse } from '../data/universeData';
import { getToken } from '../data/token';
import { buildUniverse } from '../layout/universe';
import { controlsRef } from '../render/sceneRefs';
import { openRepoInput, toAppError } from './actions';
import { useStore } from './store';

let current: AbortController | null = null;

/** Map the universe around the current repo: its contributors and their other projects. */
export async function openUniverse() {
  const { model, universe } = useStore.getState();
  if (!model || universe) return;
  current?.abort();
  const ctrl = new AbortController();
  current = ctrl;
  const meta = model.data.meta;
  useStore.getState().set({
    universe: { status: 'loading', done: 0, total: 0, focus: null },
    selection: null,
    highlight: null,
    system: null,
    collision: null,
    panel: 'none',
    hovered: -1,
  });
  try {
    const input = await fetchUniverse(
      {
        fullName: meta.fullName,
        stars: meta.stars,
        language: meta.language,
        description: meta.description,
      },
      {
        token: getToken(),
        signal: ctrl.signal,
        onProgress: (done, total) => {
          const u = useStore.getState().universe;
          if (!ctrl.signal.aborted && u)
            useStore.getState().set({ universe: { ...u, done, total } });
        },
      },
    );
    if (ctrl.signal.aborted) return;
    useStore.getState().set({
      universe: {
        status: 'ready',
        done: 0,
        total: 0,
        data: buildUniverse(input),
        focus: { kind: 'galaxy', index: 0 },
      },
    });
  } catch (e) {
    if (ctrl.signal.aborted) return;
    useStore.getState().set({ universe: null, error: toAppError(e, meta.fullName) });
  }
}

/** Back to the home galaxy. */
export function closeUniverse() {
  current?.abort();
  const { model } = useStore.getState();
  useStore.getState().set({ universe: null, hovered: -1 });
  if (!model) return;
  const controls = controlsRef.current;
  if (controls) {
    controls.maxDistance = model.layout.extent * 6 + 100;
    controls.autoRotate = false;
  }
  useStore.getState().fly([0, 0, 0], model.layout.extent * 1.85 + 14);
}

/** Leave the universe and chart one of its galaxies as the new sky. */
export async function chartGalaxy(fullName: string) {
  current?.abort();
  useStore.getState().set({ universe: null });
  await openRepoInput(fullName);
}
