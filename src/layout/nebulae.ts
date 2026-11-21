import type { FileEntry } from '../data/types';
import { hexToRgb, LANGUAGES, languageOf } from './color';
import type { Layout } from './galaxy';
import type { FolderTree } from './tree';

/**
 * Nebulae: one soft gas cloud per sizeable folder. Data, not decoration:
 *   position = the folder's cluster centre
 *   size     = the cluster's extent
 *   colour   = the folder's dominant language
 *   glow     = how much of the folder changed in the sampled commits
 */
export interface Nebulae {
  count: number;
  folders: number[];
  centers: Float32Array;
  radii: Float32Array;
  colors: Float32Array;
  intensity: Float32Array;
}

/** For each folder, the language id with the most files in its whole subtree. */
export function dominantLanguages(files: FileEntry[], tree: FolderTree): Uint8Array {
  const L = LANGUAGES.length;
  const F = tree.folders.length;
  const counts = new Uint32Array(F * L);
  for (let i = 0; i < files.length; i++) {
    counts[tree.fileFolder[i] * L + languageOf(files[i].path).id]++;
  }
  // Children have larger indices than parents: a reverse sweep accumulates subtrees.
  for (let f = F - 1; f > 0; f--) {
    const p = tree.folders[f].parent;
    for (let l = 0; l < L; l++) counts[p * L + l] += counts[f * L + l];
  }
  const out = new Uint8Array(F);
  for (let f = 0; f < F; f++) {
    let best = 0;
    for (let l = 1; l < L; l++) if (counts[f * L + l] > counts[f * L + best]) best = l;
    out[f] = best;
  }
  return out;
}

export function computeNebulae(
  files: FileEntry[],
  layout: Layout,
  touchCounts: Uint16Array,
  opts: { minFiles?: number; max?: number } = {},
): Nebulae {
  const { tree } = layout;
  const minFiles = opts.minFiles ?? Math.max(6, Math.round(files.length / 400));
  const max = opts.max ?? 140;

  // Touched-file fraction per folder subtree.
  const F = tree.folders.length;
  const touched = new Uint32Array(F);
  for (let i = 0; i < files.length; i++) if (touchCounts[i] > 0) touched[tree.fileFolder[i]]++;
  for (let f = F - 1; f > 0; f--) touched[tree.folders[f].parent] += touched[f];

  const chosen = tree.folders
    .filter((f) => f.index !== 0 && f.totalFiles >= minFiles)
    .sort((a, b) => b.totalFiles - a.totalFiles || a.index - b.index)
    .slice(0, max);

  const dom = dominantLanguages(files, tree);
  const n = chosen.length;
  const centers = new Float32Array(n * 3);
  const radii = new Float32Array(n);
  const colors = new Float32Array(n * 3);
  const intensity = new Float32Array(n);

  chosen.forEach((f, k) => {
    centers[k * 3] = layout.folderCenters[f.index * 3];
    centers[k * 3 + 1] = layout.folderCenters[f.index * 3 + 1];
    centers[k * 3 + 2] = layout.folderCenters[f.index * 3 + 2];
    // Own cluster spread, plus a little room for the sub-folders orbiting it.
    radii[k] = layout.folderRadii[f.index] * 1.6 + Math.pow(f.totalFiles, 0.38) * 0.9;
    const [r, g, b] = hexToRgb(LANGUAGES[dom[f.index]].color);
    colors[k * 3] = r;
    colors[k * 3 + 1] = g;
    colors[k * 3 + 2] = b;
    const heat = touched[f.index] / f.totalFiles;
    // Deeper folders overlap their parents' clouds, so they glow a little less.
    intensity[k] = (0.55 + 1.6 * Math.sqrt(heat)) * (f.depth === 1 ? 1 : 0.7);
  });

  return { count: n, folders: chosen.map((f) => f.index), centers, radii, colors, intensity };
}
