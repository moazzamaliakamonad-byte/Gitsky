import { peopleOf } from '../layout/constellation';
import type { SkyModel } from './model';
import { setHighlight } from './selection';
import { useStore } from './store';

/** Fly to the centre of a set of stars, far enough back to frame them. */
export function flyToSet(model: SkyModel, indices: number[]) {
  if (indices.length === 0) return;
  const p = model.layout.positions;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const i of indices) {
    x += p[i * 3];
    y += p[i * 3 + 1];
    z += p[i * 3 + 2];
  }
  const k = indices.length;
  const c: [number, number, number] = [x / k, y / k, z / k];
  let r = 0;
  for (const i of indices) r = Math.max(r, Math.hypot(p[i * 3] - c[0], p[i * 3 + 2] - c[2]));
  useStore.getState().fly(c, Math.max(18, Math.min(r * 1.6, model.layout.extent * 2.2)));
}

/**
 * Light up one person's files and draw them as a constellation (render/Constellation.tsx
 * draws whenever the highlight names a person). Showing the same person again clears it.
 */
export function showPerson(name: string) {
  const { model, highlight } = useStore.getState();
  if (!model) return;
  if (highlight?.person === name) {
    setHighlight(null);
    return;
  }
  const person = peopleOf(model.data.commits).find((p) => p.name === name);
  if (!person || person.files.length === 0) return;
  useStore.getState().set({ selection: null });
  setHighlight({ reason: 'author', label: name, person: name, indices: person.files });
  flyToSet(model, person.files);
}
