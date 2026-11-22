import { useStore } from '../state/store';

/** Fly the camera to a folder's cluster, framing it by its size. */
export function focusFolder(folderIndex: number) {
  const { model, fly, system } = useStore.getState();
  if (!model || system !== null) return;
  const c = model.layout.folderCenters;
  const f = model.layout.tree.folders[folderIndex];
  const size = model.layout.folderRadii[folderIndex] * 2 + Math.pow(f.totalFiles, 0.4) * 2.2;
  fly(
    [c[folderIndex * 3], c[folderIndex * 3 + 1], c[folderIndex * 3 + 2]],
    Math.max(14, size * 2.4),
  );
}

/** Fly the camera to one file's star. */
export function focusFile(fileIndex: number) {
  const { model, fly, system } = useStore.getState();
  if (!model || system !== null) return;
  const p = model.layout.positions;
  fly([p[fileIndex * 3], p[fileIndex * 3 + 1], p[fileIndex * 3 + 2]], 16);
}

/** Back to the whole galaxy: the overview framing, from wherever the camera is. */
export function focusGalaxy() {
  const { model, fly, system, collision, universe } = useStore.getState();
  if (!model || collision) return;
  if (universe) {
    void import('../state/universeActions').then((m) => m.closeUniverse());
    return;
  }
  if (system !== null) {
    void import('../state/systemActions').then((m) => m.exitSystem());
    return;
  }
  fly([0, 0, 0], model.layout.extent * 1.85 + 14);
}
