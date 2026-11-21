import { hashString } from '../data/hash';
import type { Commit } from '../data/types';
import { ARRIVE } from './timeline';

/** At most this many comets per commit; a 400-file refactor shouldn't blot out the sky. */
export const MAX_PER_COMMIT = 14;
/** Comets don't all leave at once: launches spread over this fraction of the slot. */
const STAGGER = 0.22;

export interface CometState {
  /** Index into model.data.commits. */
  commit: number;
  /** File the comet flies to. */
  file: number;
  /** Which of the commit's comets (0-based). */
  j: number;
  /** 0..1 in flight, > 1 after arrival (an impact burst). */
  u: number;
}

/**
 * Which comets exist at a given playhead, and how far along each is. Pure and
 * stateless: the picture is a function of the playhead alone, so scrubbing backward
 * or jumping around needs no bookkeeping.
 */
export function cometsAt(commits: Commit[], playhead: number): CometState[] {
  const k = Math.floor(playhead);
  if (k < 0 || k >= commits.length) return [];
  const files = commits[k].files.slice(0, MAX_PER_COMMIT);
  const m = files.length;
  const out: CometState[] = [];
  for (let j = 0; j < m; j++) {
    const s = m > 1 ? (j / (m - 1)) * STAGGER : 0;
    const u = (playhead - k - s) / (ARRIVE - s);
    if (u < 0) continue;
    out.push({ commit: k, file: files[j], j, u });
  }
  return out;
}

export type Vec3 = [number, number, number];

/** Quadratic Bézier: from a, pulled toward control c, ending at b. */
export function bezier(a: Vec3, c: Vec3, b: Vec3, u: number): Vec3 {
  const v = 1 - u;
  return [
    v * v * a[0] + 2 * v * u * c[0] + u * u * b[0],
    v * v * a[1] + 2 * v * u * c[1] + u * u * b[1],
    v * v * a[2] + 2 * v * u * c[2] + u * u * b[2],
  ];
}

/**
 * Where a commit's comets come from: one point on a ring beyond the galaxy's edge,
 * chosen by the commit's SHA, so each commit arrives from its own direction.
 */
export function cometOrigin(sha: string, j: number, rim: number): Vec3 {
  const h = hashString(sha);
  const ang = (h / 4294967296) * Math.PI * 2 + j * 0.04;
  const lift = (hashString(sha + 'y') / 4294967296 - 0.5) * rim * 0.5;
  return [Math.cos(ang) * rim, lift, Math.sin(ang) * rim];
}

/** Control point: above the midpoint and swirled, so paths arc like orbits, not lines. */
export function cometControl(a: Vec3, b: Vec3): Vec3 {
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[2] + b[2]) / 2;
  const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const c = Math.cos(0.55);
  const s = Math.sin(0.55);
  return [mx * c - mz * s, (a[1] + b[1]) / 2 + d * 0.22, mx * s + mz * c];
}

/**
 * Each author gets a comet colour: warm, light hues that read as "events" against
 * the cooler language palette, stable per name.
 */
const AUTHOR_COLORS = [
  '#ffb35c',
  '#ff8f70',
  '#ffd480',
  '#ff9ec4',
  '#ffc2a1',
  '#f6e27a',
  '#ff7f9a',
  '#ffcf9e',
];

export function authorColor(author: string): string {
  return AUTHOR_COLORS[hashString(author) % AUTHOR_COLORS.length];
}
