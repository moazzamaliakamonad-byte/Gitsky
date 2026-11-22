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
