import { hashString } from '../data/hash';
import type { FileEntry } from '../data/types';
import { gauss, rand } from './random';
import { buildFolderTree, type FolderTree } from './tree';

/**
 * Tree → 3D positions. The math is explained in learn/concepts/spiral-galaxy-layout-math.md.
 *
 * - The root's own files form the bright core (a squashed 3D gaussian "bulge").
 * - Top-level folders sit on K logarithmic spiral arms, r = a·e^(bθ). The largest
 *   folders take the inner positions; spacing along an arm follows cluster size so
 *   neighbours don't pile up.
 * - Each folder is a cluster: its files scatter around the folder centre, and its
 *   sub-folders orbit the centre at a distance set by their own size. Everything
 *   inside an arm is stretched along the arm's direction so clusters read as
 *   segments of the arm rather than blobs.
 * - All jitter is seeded by path hash: deterministic.
 */

export interface LayoutOptions {
  /** Spiral arms. 0 = choose from the number of top-level folders. */
  arms?: number;
  /** How far each arm winds, in radians. */
  armSweep?: number;
  /** Disk thickness relative to radius. */
  flatness?: number;
}

export interface Layout {
  tree: FolderTree;
  /** xyz per file. */
  positions: Float32Array;
  /** xyz per folder (the centre of its cluster). */
  folderCenters: Float32Array;
  /** Rough radius of each folder's own cluster. */
  folderRadii: Float32Array;
  /** Distance from the core to the farthest star. */
  radius: number;
  /** The spiral parameters actually used, for learning/debug UI. */
  spiral: { arms: number; a: number; b: number; sweep: number };
}

export const CORE_RADIUS = 6;

/** r(θ) = a·e^(bθ): a logarithmic spiral. Each turn multiplies the radius by e^(2πb). */
export function spiralRadius(a: number, b: number, theta: number): number {
  return a * Math.exp(b * theta);
}

/** Cluster size grows sub-linearly with file count, so huge folders don't swallow the sky. */
export function clusterRadius(fileCount: number): number {
  return 1.1 * Math.pow(Math.max(1, fileCount), 0.42);
}

export function computeLayout(files: FileEntry[], opts: LayoutOptions = {}): Layout {
  const tree = buildFolderTree(files);
  const { folders } = tree;
  const n = files.length;
  const positions = new Float32Array(n * 3);
  const folderCenters = new Float32Array(folders.length * 3);
  const folderRadii = new Float32Array(folders.length);
  for (const f of folders) folderRadii[f.index] = clusterRadius(f.files.length);

  // Galaxy scale grows slowly with repo size.
  const outer = 34 + 16 * Math.log10(n + 10);
  const flat = opts.flatness ?? 0.06;

  const tops = folders[0].children
    .map((i) => folders[i])
    .sort((x, y) => y.totalFiles - x.totalFiles || (x.path < y.path ? -1 : 1));

  const arms =
    opts.arms && opts.arms > 0 ? opts.arms : Math.min(4, Math.max(2, Math.ceil(tops.length / 6)));
  const sweep = opts.armSweep ?? Math.PI * 1.55;
  const a = CORE_RADIUS * 1.9;
  const b = Math.log(Math.max(outer / a, 1.01)) / sweep;

  // Space folders along the spiral by cumulative √(size) in global size order, so rank 0
  // (the biggest) sits nearest the core and bigger clusters get more room. Arms are
  // assigned round-robin by rank, which keeps every arm populated from core to rim.
  const weights = tops.map((f) => Math.sqrt(f.totalFiles));
  const total = weights.reduce((s, w) => s + w, 0) || 1;

  // tangent (unit, in xz) of the arm at each top-level folder; inherited by descendants
  const tangentX = new Float32Array(folders.length);
  const tangentZ = new Float32Array(folders.length);

  /** Place a folder centre on arm `arm` at spiral parameter t ∈ [0,1], and record the tangent. */
  const placeOnArm = (index: number, t: number, arm: number, lateral: number) => {
    const theta = t * sweep;
    const r = spiralRadius(a, b, theta);
    const phi = theta + (arm * 2 * Math.PI) / arms;
    const seed = hashString(folders[index].path);
    // Derivative of (r cosφ, r sinφ) with dr/dθ = b·r, normalised.
    const dx = b * Math.cos(phi) - Math.sin(phi);
    const dz = b * Math.sin(phi) + Math.cos(phi);
    const len = Math.hypot(dx, dz) || 1;
    const tx = dx / len;
    const tz = dz / len;
    // Arms widen with radius, like real ones; `lateral` pushes across the arm.
    const across = lateral * (1.2 + r * 0.05);
    const i3 = index * 3;
    folderCenters[i3] = r * Math.cos(phi) - across * tz + gauss(seed, 0) * 0.8;
    folderCenters[i3 + 1] = gauss(seed, 2) * r * flat * 0.5;
    folderCenters[i3 + 2] = r * Math.sin(phi) + across * tx + gauss(seed, 4) * 0.8;
    tangentX[index] = tx;
    tangentZ[index] = tz;
  };

  // Each top-level folder owns a segment of its arm, centred on its slot t and as wide as
  // its share of the weight times the arm count, so segments on one arm roughly tile it.
  // Its direct sub-folders are strung along that segment (biggest at the inner end),
  // which turns a handful of top-level folders into continuous streams of clusters.
  let cum = 0;
  const placed = new Uint8Array(folders.length);
  tops.forEach((f, rank) => {
    const t = (cum + weights[rank] * 0.5) / total;
    const half = Math.min(0.5, (weights[rank] / total) * arms * 0.45);
    cum += weights[rank];
    const arm = rank % arms;
    placeOnArm(f.index, t, arm, 0);
    placed[f.index] = 1;

    const kids = f.children
      .map((i) => folders[i])
      .sort((x, y) => y.totalFiles - x.totalFiles || (x.path < y.path ? -1 : 1));
    if (kids.length === 0) return;
    const kw = kids.map((k) => Math.sqrt(k.totalFiles));
    const ktotal = kw.reduce((s, w) => s + w, 0) || 1;
    let kc = 0;
    const t0 = Math.max(0.02, t - half);
    const t1 = Math.min(1, t + half);
    kids.forEach((k, j) => {
      const u = (kc + kw[j] * 0.5) / ktotal;
      kc += kw[j];
      const lateral = gauss(hashString(k.path), 7) * 0.9;
      placeOnArm(k.index, t0 + (t1 - t0) * u, arm, lateral);
      placed[k.index] = 1;
    });
  });

  // Sub-folders orbit their parent. Parents precede children in `folders`, so one
  // forward sweep places everything.
  for (let i = 1; i < folders.length; i++) {
    const f = folders[i];
    if (placed[i]) continue;
    const p = f.parent;
    tangentX[i] = tangentX[p];
    tangentZ[i] = tangentZ[p];
    const seed = hashString(f.path);
    const parentOwn = folderRadii[p];
    const dist = parentOwn * 0.8 + clusterRadius(f.totalFiles) * 0.9 + 0.8;
    const ang = rand(seed, 0) * Math.PI * 2;
    // Stretch along the arm tangent: orbit in an ellipse whose long axis follows the arm.
    const along = Math.cos(ang) * dist * 1.5;
    const across = Math.sin(ang) * dist * 0.75;
    const tx = tangentX[i];
    const tz = tangentZ[i];
    const p3 = p * 3;
    const i3 = i * 3;
    folderCenters[i3] = folderCenters[p3] + along * tx - across * tz;
    folderCenters[i3 + 1] = folderCenters[p3 + 1] + gauss(seed, 1) * dist * 0.15;
    folderCenters[i3 + 2] = folderCenters[p3 + 2] + along * tz + across * tx;
  }

  // Files: a squashed gaussian around their folder centre, stretched along the arm.
  // The root's files are the core bulge instead.
  let maxR2 = 0;
  for (let i = 0; i < n; i++) {
    const f = tree.fileFolder[i];
    const seed = hashString(files[i].path);
    const g1 = gauss(seed, 0);
    const g2 = gauss(seed, 2);
    const g3 = gauss(seed, 4);
    let x: number;
    let y: number;
    let z: number;
    if (f === 0) {
      const s = CORE_RADIUS * 0.45;
      x = g1 * s;
      y = g2 * s * 0.55;
      z = g3 * s;
    } else {
      const s = folderRadii[f] * 0.5;
      const along = g1 * s * 1.6;
      const across = g3 * s * 0.8;
      const tx = tangentX[f];
      const tz = tangentZ[f];
      const f3 = f * 3;
      x = folderCenters[f3] + along * tx - across * tz;
      y = folderCenters[f3 + 1] + g2 * s * 0.3;
      z = folderCenters[f3 + 2] + along * tz + across * tx;
    }
    const i3 = i * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    // Measure the stored (float32-rounded) values, so the radius truly bounds them.
    const r2 = positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2;
    if (r2 > maxR2) maxR2 = r2;
  }

  return {
    tree,
    positions,
    folderCenters,
    folderRadii,
    radius: Math.max(Math.sqrt(maxR2), CORE_RADIUS),
    spiral: { arms, a, b, sweep },
  };
}
