import type { SkyModel } from '../state/model';
import { spectrumOf } from './color';
import type { FolderTree } from './tree';

/** Every file index under a folder, recursively. */
export function subtreeFiles(tree: FolderTree, folder: number): number[] {
  const out: number[] = [];
  const stack = [folder];
  while (stack.length) {
    const f = tree.folders[stack.pop()!];
    for (const i of f.files) out.push(i);
    for (const c of f.children) stack.push(c);
  }
  return out;
}

const sortedSizes = new WeakMap<SkyModel, Float64Array>();

function sizesSorted(model: SkyModel): Float64Array {
  let s = sortedSizes.get(model);
  if (!s) {
    s = Float64Array.from(model.data.files, (f) => f.size).sort();
    sortedSizes.set(model, s);
  }
  return s;
}

/** Number of values ≤ x in a sorted array (binary search). */
function countAtMost(sorted: Float64Array, x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function githubFileUrl(model: SkyModel, index: number): string {
  const { htmlUrl } = model.data.meta;
  const path = model.data.files[index].path.split('/').map(encodeURIComponent).join('/');
  return `${htmlUrl}/blob/${encodeURIComponent(model.data.branch)}/${path}`;
}

export interface FileDetail {
  /** Indices into model.data.commits that touched this file, newest first. */
  touches: number[];
  /** % of files in the repo at or below this file's size. */
  sizePercentile: number;
  githubUrl: string;
}

export function fileDetail(model: SkyModel, index: number): FileDetail {
  const touches: number[] = [];
  const { commits } = model.data;
  for (let c = commits.length - 1; c >= 0; c--) {
    if (commits[c].files.includes(index)) touches.push(c);
  }
  const sorted = sizesSorted(model);
  const size = model.data.files[index].size;
  return {
    touches,
    sizePercentile: Math.round((countAtMost(sorted, size) / sorted.length) * 100),
    githubUrl: githubFileUrl(model, index),
  };
}

export interface FolderStats {
  files: number;
  bytes: number;
  touchedFiles: number;
  hottest: { index: number; count: number }[];
  largest: number[];
  authors: { name: string; commits: number }[];
  subfolders: { index: number; files: number }[];
  spectrum: [string, number][];
  members: number[];
}

export function folderStats(model: SkyModel, folder: number): FolderStats {
  const { tree } = model.layout;
  const f = tree.folders[folder];
  const members = subtreeFiles(tree, folder);
  const inside = new Set(members);
  const counts = model.churn.counts;

  const hottest = members
    .filter((i) => counts[i] > 0)
    .sort((a, b) => counts[b] - counts[a] || a - b)
    .slice(0, 5)
    .map((index) => ({ index, count: counts[index] }));

  const files = model.data.files;
  const largest = [...members].sort((a, b) => files[b].size - files[a].size || a - b).slice(0, 5);

  const byAuthor = new Map<string, number>();
  for (const c of model.data.commits) {
    if (c.files.some((i) => inside.has(i)))
      byAuthor.set(c.author, (byAuthor.get(c.author) ?? 0) + 1);
  }

  return {
    files: f.totalFiles,
    bytes: f.totalBytes,
    touchedFiles: members.filter((i) => counts[i] > 0).length,
    hottest,
    largest,
    authors: [...byAuthor.entries()]
      .map(([name, commits]) => ({ name, commits }))
      .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name))
      .slice(0, 5),
    subfolders: f.children
      .map((index) => ({ index, files: tree.folders[index].totalFiles }))
      .sort((a, b) => b.files - a.files || a.index - b.index),
    spectrum: spectrumOf(members.map((i) => files[i])),
    members,
  };
}
