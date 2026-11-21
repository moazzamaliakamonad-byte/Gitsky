import type { FolderTree } from '../layout/tree';

/**
 * Which folders get a floating label: every top-level folder, plus big second-level
 * ones (≥ 3% of the repo), biggest first. Labels beyond `max` would only collide.
 */
export function pickLabelFolders(tree: FolderTree, max = 22): number[] {
  const total = tree.folders[0]?.totalFiles ?? 0;
  return tree.folders
    .filter((f) => f.depth === 1 || (f.depth === 2 && f.totalFiles >= Math.max(12, total * 0.03)))
    .sort((a, b) => b.totalFiles - a.totalFiles || a.index - b.index)
    .slice(0, max)
    .map((f) => f.index);
}

/** DOM elements the label layer rendered, in priority order. The canvas positions them. */
export const labelEls: { current: { folder: number; el: HTMLElement; w: number }[] } = {
  current: [],
};
