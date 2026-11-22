import type { FolderTree } from './tree';
import { rand } from './random';

/**
 * A folder seen up close, as a solar system:
 * - the folder itself is the sun (size from its total bytes);
 * - files directly inside it are planets (size from bytes, colour from language),
 *   ordered so the most-changed files orbit closest and fastest;
 * - sub-folders are ringed gas giants (size from total bytes), with one moon per file
 *   up to a dozen, further out;
 * - direct files beyond the planet cap form an asteroid belt between the two.
 * Orbits follow Kepler's third law (angular speed ∝ r^-1.5). Deterministic.
 */
export const MAX_PLANETS = 24;
export const MAX_GIANTS = 8;
export const MAX_MOONS = 12;

export interface Orbit {
  /** Orbit radius in world units. */
  orbit: number;
  /** Angular speed, radians per second. */
  speed: number;
  /** Starting angle. */
  phase: number;
  /** Tilt of the orbit plane (radians) and the direction of its tilt axis. */
  incline: number;
  node: number;
}

export interface Planet extends Orbit {
  file: number;
  radius: number;
  /** 0 … 1: share of the sampled commits that touched it, relative to the busiest. */
  heat: number;
}

export interface Giant extends Orbit {
  folder: number;
  radius: number;
  moons: number;
  /** Ring plane tilt. */
  ringTilt: number;
}

export interface SystemLayout {
  folder: number;
  sunRadius: number;
  planets: Planet[];
  giants: Giant[];
  /** Direct files that didn't fit as planets, drawn as a belt of rocks. */
  belt: { files: number[]; inner: number; outer: number } | null;
  /** Sub-folders that didn't fit as giants (counted, not drawn). */
  hiddenFolders: number;
  extent: number;
}

const log = (b: number) => Math.log10(Math.max(0, b) + 1);
export const planetRadius = (bytes: number) => 0.6 + 0.48 * log(bytes);
export const giantRadius = (bytes: number) => 2.2 + 0.45 * log(bytes);
export const sunRadius = (bytes: number) => 2.5 + 0.42 * log(bytes);
/** Kepler: ω ∝ r^-1.5. */
export const orbitSpeed = (r: number) => 6 * Math.pow(Math.max(r, 1), -1.5);

function orbitFor(seed: number, orbit: number): Orbit {
  return {
    orbit,
    speed: orbitSpeed(orbit),
    phase: rand(seed, 11) * Math.PI * 2,
    incline: (rand(seed, 12) - 0.5) * 0.14,
    node: rand(seed, 13) * Math.PI * 2,
  };
}

export function layoutSystem(
  files: { path: string; size: number }[],
  tree: FolderTree,
  churn: ArrayLike<number>,
  folderIndex: number,
): SystemLayout {
  const folder = tree.folders[folderIndex];
  const sun = sunRadius(folder.totalBytes);

  const direct = [...folder.files].sort(
    (a, b) =>
      churn[b] - churn[a] ||
      files[b].size - files[a].size ||
      (files[a].path < files[b].path ? -1 : 1),
  );
  const planetFiles = direct.slice(0, MAX_PLANETS);
  const beltFiles = direct.slice(MAX_PLANETS);
  let maxChurn = 0;
  for (const f of planetFiles) maxChurn = Math.max(maxChurn, churn[f]);

  let r = sun * 2.2 + 2;
  let prev = 0;
  const planets: Planet[] = planetFiles.map((file) => {
    const radius = planetRadius(files[file].size);
    r += prev + radius * 1.4 + 1.2;
    prev = radius;
    return {
      file,
      radius,
      heat: maxChurn > 0 ? churn[file] / maxChurn : 0,
      ...orbitFor(file * 7 + 1, r),
    };
  });

  let belt: SystemLayout['belt'] = null;
  if (beltFiles.length > 0) {
    const inner = r + prev + 3;
    const outer = inner + 4 + Math.min(10, beltFiles.length * 0.02);
    belt = { files: beltFiles, inner, outer };
    r = outer;
    prev = 0;
  }

  const kids = [...folder.children].sort(
    (a, b) => tree.folders[b].totalBytes - tree.folders[a].totalBytes || a - b,
  );
  const shown = kids.slice(0, MAX_GIANTS);
  const giants: Giant[] = shown.map((fi) => {
    const sub = tree.folders[fi];
    const radius = giantRadius(sub.totalBytes);
    // Room for the rings and moons (out to ~2.6 radii) on both sides.
    r += prev + radius * 2.8 + 3;
    prev = radius * 1.6;
    return {
      folder: fi,
      radius,
      moons: Math.min(MAX_MOONS, sub.totalFiles),
      ringTilt: 0.25 + rand(fi, 14) * 0.5,
      ...orbitFor(fi * 13 + 5, r),
    };
  });

  const lastRadius = giants.length
    ? giants[giants.length - 1].radius * 2.6
    : planets.length
      ? planets[planets.length - 1].radius
      : 0;
  return {
    folder: folderIndex,
    sunRadius: sun,
    planets,
    giants,
    belt,
    hiddenFolders: kids.length - shown.length,
    extent: Math.max(r + lastRadius, belt ? belt.outer : 0, sun * 3),
  };
}

/** Where a body is at time t (seconds): a tilted circular orbit around the sun. */
export function orbitPosition(o: Orbit, t: number, out: [number, number, number]) {
  const a = o.phase + o.speed * t;
  const x = Math.cos(a) * o.orbit;
  const z = Math.sin(a) * o.orbit;
  // Tilt the orbit plane by `incline` around an axis at angle `node`.
  const nx = Math.cos(o.node);
  const nz = Math.sin(o.node);
  const along = x * nx + z * nz; // component along the tilt axis stays in the plane
  const across = -x * nz + z * nx; // the perpendicular component rises and falls
  out[0] = along * nx - across * Math.cos(o.incline) * nz;
  out[1] = across * Math.sin(o.incline);
  out[2] = along * nz + across * Math.cos(o.incline) * nx;
  return out;
}
