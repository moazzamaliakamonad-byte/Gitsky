import { hashString } from './hash';
import { gauss } from '../layout/random';
import type { FolderTree } from '../layout/tree';

/**
 * Deep time: the repo's whole life, not just its last commits.
 *
 * We take a handful of moments spread evenly through the commit history (by commit count,
 * so busy years get more moments than quiet ones) and read the full file list at each.
 * From those we know when each of today's files was born, and which files lived and died
 * along the way ("ghosts"). Cost: 1 request for the commit count, then 2 per moment.
 */

/** "Born after the last sampled moment": the file only exists today. */
export const NOW = 255;

export interface EpochInfo {
  sha: string;
  /** ISO date of the commit the moment was read at. */
  date: string;
  /** Files in the tree at that moment. */
  count: number;
}

export interface Ghost {
  path: string;
  /** Moment it first appears. */
  born: number;
  /** First moment it's gone again (NOW: it was still there at the last moment). */
  died: number;
}

export interface DeepHistory {
  /** Oldest first. The present (today's tree) comes after the last one. */
  epochs: EpochInfo[];
  totalCommits: number;
  /** Per current file: the moment it first exists, or NOW. */
  born: Uint8Array;
  ghosts: Ghost[];
}

/** Total commits, from the Link header of `commits?per_page=1` (its last page number). */
export function lastPageOf(link: string | null): number {
  if (!link) return 1;
  const m = /[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(link);
  return m ? Number(m[1]) : 1;
}

/**
 * Which pages of a newest-first, one-per-page commit listing to read: page `total` is the
 * very first commit; later moments are spaced evenly by commit count. Never page 1, which
 * is the present we already have.
 */
export function planEpochPages(total: number, count: number): number[] {
  if (total < 2) return [];
  const n = Math.min(count, total - 1);
  const pages: number[] = [];
  for (let k = 0; k < n; k++) pages.push(total - Math.floor((k / n) * total));
  return pages;
}

export function buildHistory(
  currentPaths: string[],
  epochs: { sha: string; date: string; paths: string[] }[],
  maxGhosts: number,
  /** Every path in today's tree, when `currentPaths` was capped for a snapshot. */
  fullCurrent: Set<string> = new Set(currentPaths),
  totalCommits = 0,
): DeepHistory {
  const index = new Map<string, number>();
  currentPaths.forEach((p, i) => index.set(p, i));
  const born = new Uint8Array(currentPaths.length).fill(NOW);
  const life = new Map<string, Ghost>();

  epochs.forEach((e, k) => {
    const present = new Set(e.paths);
    for (const p of e.paths) {
      const i = index.get(p);
      if (i !== undefined) {
        if (born[i] === NOW) born[i] = k;
      } else if (!fullCurrent.has(p) && !life.has(p)) {
        life.set(p, { path: p, born: k, died: NOW });
      }
    }
    // A ghost dies at the first moment it's missing (only its first life counts).
    for (const g of life.values())
      if (g.died === NOW && g.born < k && !present.has(g.path)) g.died = k;
  });

  const span = (g: Ghost) => (g.died === NOW ? epochs.length : g.died) - g.born;
  const ghosts = [...life.values()]
    .sort((a, b) => span(b) - span(a) || a.born - b.born || (a.path < b.path ? -1 : 1))
    .slice(0, maxGhosts)
    .sort((a, b) => a.born - b.born || (a.path < b.path ? -1 : 1));

  return {
    epochs: epochs.map((e) => ({ sha: e.sha, date: e.date, count: e.paths.length })),
    totalCommits,
    born,
    ghosts,
  };
}

/** The moment each folder appears: the earliest birth anywhere inside it. */
export function folderBirths(tree: FolderTree, born: Uint8Array): Uint8Array {
  const out = new Uint8Array(tree.folders.length).fill(NOW);
  for (let i = 0; i < born.length; i++) {
    const f = tree.fileFolder[i];
    if (born[i] < out[f]) out[f] = born[i];
  }
  // Parents come before children, so walk backwards to push births upward.
  for (let f = tree.folders.length - 1; f > 0; f--) {
    const p = tree.folders[f].parent;
    if (p >= 0 && out[f] < out[p]) out[p] = out[f];
  }
  return out;
}

/**
 * Where a ghost shines: inside the deepest folder of its path that still exists today,
 * scattered like that folder's own stars. Deterministic per path.
 */
export function placeGhosts(
  ghosts: Ghost[],
  tree: FolderTree,
  centers: Float32Array,
  radii: Float32Array,
): Float32Array {
  const out = new Float32Array(ghosts.length * 3);
  ghosts.forEach((g, j) => {
    let dir = g.path.includes('/') ? g.path.slice(0, g.path.lastIndexOf('/')) : '';
    let f = tree.byPath.get(dir);
    while (f === undefined && dir) {
      dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
      f = tree.byPath.get(dir);
    }
    const folder = f ?? 0;
    const seed = hashString(g.path);
    const s = Math.max(0.6, radii[folder] * 0.55);
    out[j * 3] = centers[folder * 3] + gauss(seed, 1) * s;
    out[j * 3 + 1] = centers[folder * 3 + 1] + gauss(seed, 2) * s * 0.3;
    out[j * 3 + 2] = centers[folder * 3 + 2] + gauss(seed, 3) * s;
  });
  return out;
}

/** Compact JSON form, for the local cache and bundled `.deep.json` files. */
export interface EncodedHistory {
  v: 1;
  epochs: EpochInfo[];
  totalCommits: number;
  born: number[];
  ghosts: [string, number, number][];
}

export function encodeHistory(h: DeepHistory): EncodedHistory {
  return {
    v: 1,
    epochs: h.epochs,
    totalCommits: h.totalCommits,
    born: [...h.born],
    ghosts: h.ghosts.map((g) => [g.path, g.born, g.died]),
  };
}

export function decodeHistory(raw: unknown): DeepHistory {
  const e = raw as Partial<EncodedHistory> | null;
  if (
    !e ||
    e.v !== 1 ||
    !Array.isArray(e.epochs) ||
    !Array.isArray(e.born) ||
    !Array.isArray(e.ghosts)
  )
    throw new Error('Unrecognised deep-time data');
  return {
    epochs: e.epochs.map((x) => ({
      sha: String(x.sha),
      date: String(x.date),
      count: Number(x.count),
    })),
    totalCommits: Number(e.totalCommits) || 0,
    born: Uint8Array.from(e.born),
    ghosts: e.ghosts.map(([path, born, died]) => ({ path, born, died })),
  };
}

/** The `.deep.json` next to a featured sky's snapshot, if one was built. */
export function deepFileOf(entry: { file: string }): string {
  return entry.file.replace(/\.json$/, '.deep.json');
}
