import * as THREE from 'three';
import { layoutSystem, type SystemLayout } from '../layout/system';
import type { SkyModel } from '../state/model';

const cache = new WeakMap<SkyModel, Map<number, SystemLayout>>();

/** The solar-system layout of one folder, computed once per model and folder. */
export function systemFor(model: SkyModel, folder: number): SystemLayout {
  let m = cache.get(model);
  if (!m) {
    m = new Map();
    cache.set(model, m);
  }
  let s = m.get(folder);
  if (!s) {
    s = layoutSystem(model.data.files, model.layout.tree, model.churn.counts, folder);
    m.set(folder, s);
  }
  return s;
}

/**
 * Where each body of the current system is right now, written every frame by
 * SystemView and read by picking, labels and the warp. Keys: `p<file>`, `g<folder>`,
 * and `sun`. Each value also carries the body's radius.
 */
export const bodies = new Map<string, { pos: THREE.Vector3; radius: number }>();
