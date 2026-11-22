import { startWarp, warp } from '../render/warp';
import { bodies } from '../render/systemRuntime';
import { useStore } from './store';

/** Warp into a folder's solar system: from the galaxy, or deeper from a system. */
export function enterSystem(folder: number) {
  const { model, system, heroOpen } = useStore.getState();
  if (!model || warp.active || heroOpen || folder <= 0 || folder === system) return;
  let aim: [number, number, number];
  const giant = system !== null ? bodies.get(`g${folder}`) : undefined;
  if (giant) aim = [giant.pos.x, giant.pos.y, giant.pos.z];
  else {
    const c = model.layout.folderCenters;
    aim = system !== null ? [0, 0, 0] : [c[folder * 3], c[folder * 3 + 1], c[folder * 3 + 2]];
  }
  useStore.getState().set({ selection: null, highlight: null });
  startWarp(folder, aim, 1);
}

/** Warp back out to the galaxy, arriving at the folder you were in. */
export function exitSystem() {
  const { system } = useStore.getState();
  if (system === null || warp.active) return;
  useStore.getState().set({ selection: null, highlight: null });
  startWarp(null, [0, 0, 0], -1);
}

/** Up one level: to the parent folder's system, or out to the galaxy from the top. */
export function warpUp() {
  const { model, system } = useStore.getState();
  if (!model || system === null) return;
  const parent = model.layout.tree.folders[system].parent;
  if (parent > 0) {
    if (warp.active) return;
    useStore.getState().set({ selection: null, highlight: null });
    startWarp(parent, [0, 0, 0], -1);
  } else exitSystem();
}
