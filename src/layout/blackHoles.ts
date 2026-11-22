import { LANGUAGES } from './color';

/**
 * Black holes: the heaviest files nobody writes by hand. Lockfiles, bundles, minified
 * builds, source maps, generated code and binary assets are pure mass: they weigh a
 * lot and carry little meaning, so they bend the light of the sky around them.
 *
 * A file becomes a black hole only if it is one of those kinds AND it is genuinely
 * heavy: at least 192 KB and 40× the repo's median file. Usually there is just one;
 * a second or third appears only if it is truly enormous (8× the threshold), so a
 * black hole stays an event, never wallpaper.
 */
export type HoleKind = 'lockfile' | 'generated' | 'binary';

export interface BlackHole {
  index: number;
  kind: HoleKind;
  /** 0.45 … 1: how strongly it bends light, from how far it is over the threshold. */
  mass: number;
}

export const MAX_HOLES = 3;
const MIN_BYTES = 192 * 1024;
const MEDIAN_FACTOR = 40;
/** A second or third black hole must weigh this many times the threshold. */
const EXTRA_FACTOR = 8;

const LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'cargo.lock',
  'go.sum',
  'composer.lock',
  'gemfile.lock',
  'poetry.lock',
  'pipfile.lock',
  'podfile.lock',
  'mix.lock',
  'flake.lock',
  'packages.lock.json',
]);

const GENERATED_NAME = [
  /\.min\.(js|css|mjs)$/,
  /\.(js|css|mjs)\.map$/,
  /\.bundle\.js$/,
  /\.pb\.go$/,
  /_pb2\.py$/,
  /[._-]generated\.[a-z]+$/,
  /\.snap$/,
  /\.wasm$/,
];
const GENERATED_DIR =
  /(^|\/)(dist|build|vendor|third_party|generated|__generated__|node_modules)\//;

/** What kind of mass a file is, or null if a human probably wrote it. */
export function heavyKind(path: string, languageId: number): HoleKind | null {
  const lower = path.toLowerCase();
  const name = lower.slice(lower.lastIndexOf('/') + 1);
  if (LOCKFILES.has(name)) return 'lockfile';
  if (GENERATED_NAME.some((re) => re.test(name)) || GENERATED_DIR.test(lower)) return 'generated';
  if (LANGUAGES[languageId]?.family === 'assets') return 'binary';
  return null;
}

export function findBlackHoles(
  files: { path: string; size: number }[],
  languageIds: ArrayLike<number>,
): BlackHole[] {
  const n = files.length;
  if (n < 8) return [];
  const sorted = files.map((f) => f.size).sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)];
  const threshold = Math.max(MIN_BYTES, median * MEDIAN_FACTOR);

  const out: BlackHole[] = [];
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => files[b].size - files[a].size || a - b,
  );
  for (const i of order) {
    if (files[i].size < threshold || out.length >= MAX_HOLES) break;
    // The first hole only needs to clear the threshold; any more must be enormous.
    if (out.length > 0 && files[i].size < threshold * EXTRA_FACTOR) break;
    const kind = heavyKind(files[i].path, languageIds[i]);
    if (!kind) continue;
    const over = Math.log10(files[i].size / threshold); // 0 at threshold, 2 at 100×
    out.push({ index: i, kind, mass: 0.45 + 0.55 * Math.min(1, over / 2) });
  }
  return out;
}

/** Accretion-disk outer radius in world units, from the hole's mass (0.45…1). */
export const diskRadius = (mass: number) => 6 + 8 * mass;

export const HOLE_LABEL: Record<HoleKind, string> = {
  lockfile: 'a lockfile',
  generated: 'generated or built code',
  binary: 'a binary asset',
};
