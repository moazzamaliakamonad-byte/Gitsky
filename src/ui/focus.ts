import { diskRadius } from '../layout/blackHoles';
import { useStore } from '../state/store';

/** Fly the camera to a folder's cluster, framing it by its size. */
export function focusFolder(folderIndex: number) {
  const { model, fly } = useStore.getState();
  if (!model) return;
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
  const { model, fly } = useStore.getState();
  if (!model) return;
  const p = model.layout.positions;
  // A black hole is framed by its accretion disk, not by a star's glow.
  const hole = model.holes.find((h) => h.index === fileIndex);
  const distance = hole ? diskRadius(hole.mass) * 5.5 : 16;
  fly([p[fileIndex * 3], p[fileIndex * 3 + 1], p[fileIndex * 3 + 2]], distance);
}
