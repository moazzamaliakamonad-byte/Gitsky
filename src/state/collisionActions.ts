import { parseRepoInput } from '../data/parseRepoInput';
import { controlsRef } from '../render/sceneRefs';
import { warp } from '../render/warp';
import { beginLoad, failLoad, loadModel, setRepoParam, toAppError } from './actions';
import { useStore } from './store';

/** Collide the current galaxy with another repo (owner/name, a URL, or a bundled name). */
export async function startCollision(input: string): Promise<boolean> {
  const { model } = useStore.getState();
  if (!model || warp.active) return false;
  const parsed = parseRepoInput(input);
  if (!parsed.ok) {
    useStore.getState().set({
      error: { kind: 'parse', title: 'That doesn’t look like a repo', message: parsed.error },
    });
    return false;
  }
  const fullName = `${parsed.ref.owner}/${parsed.ref.repo}`;
  if (fullName.toLowerCase() === model.data.meta.fullName.toLowerCase()) {
    useStore
      .getState()
      .set({ notice: 'Pick a different repo: a galaxy can’t collide with itself.' });
    return false;
  }
  const signal = beginLoad(fullName);
  try {
    const other = await loadModel(parsed.ref, signal);
    if (signal.aborted) return false;
    useStore.getState().set({
      status: 'ready',
      loadingRepo: null,
      progress: null,
      collision: other,
      system: null,
      selection: null,
      highlight: null,
      hovered: -1,
      panel: 'none',
      heroOpen: false,
    });
    setRepoParam(model.data.meta.fullName, other.data.meta.fullName);
    return true;
  } catch (e) {
    if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return false;
    failLoad(toAppError(e, fullName));
    return false;
  }
}

/** Back to the single galaxy. */
export function endCollision() {
  const { model } = useStore.getState();
  useStore.getState().set({ collision: null, hovered: -1 });
  if (!model) return;
  setRepoParam(model.data.meta.fullName);
  // Back to the home galaxy's usual framing and zoom range.
  const controls = controlsRef.current;
  if (controls) controls.maxDistance = model.layout.extent * 6 + 100;
  useStore.getState().fly([0, 0, 0], model.layout.extent * 1.85 + 14);
}
