import { create } from 'zustand';
import type { GitHubErrorKind } from '../data/github';
import type { BundledEntry, Progress } from '../data/types';
import type { SkyModel } from './model';
import type { FileSymbol } from '../layout/outline';
import type { UGraph, Universe, Vec3 } from '../layout/universeGraph';

export interface UniverseState {
  status: 'loading' | 'ready';
  /** Requests done / planned while loading or expanding. */
  done: number;
  total: number;
  /** What the universe is centred on: a repo (`owner/name`) or a person (`@login`). */
  label: string;
  graph?: UGraph;
  layout?: Map<string, Vec3>;
  data?: Universe;
  /** What's selected in the universe. */
  focus: { kind: 'galaxy' | 'person'; index: number } | null;
  /** An expansion is in flight. */
  busy: boolean;
  /** Only galaxies in these languages are lit (null: all). */
  languages: string[] | null;
  /** Branches the request budget cut from the last expansion, and when it resets. */
  missing?: number;
  resetAt?: number;
}
export interface ContentState {
  file: number;
  status: 'loading' | 'ready' | 'binary' | 'too-big' | 'unavailable' | 'error';
  text?: string;
  outline?: FileSymbol[];
  message?: string;
}

export type Quality = 'low' | 'high';

export type Selection = { kind: 'file'; index: number } | { kind: 'folder'; index: number } | null;

/** A set of stars to emphasise; everything else dims. */
export interface Highlight {
  reason: 'search' | 'folder' | 'language' | 'author' | 'insight';
  label: string;
  indices: number[];
}

export interface AppError {
  kind: GitHubErrorKind | 'parse' | 'snapshot';
  title: string;
  message: string;
  resetAt?: number;
  repo?: string;
}

export interface FlyRequest {
  target: [number, number, number];
  /** Camera distance from the target when it arrives. */
  distance: number;
  id: number;
}

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const reduced =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface AppState {
  model: SkyModel | null;
  modelId: number;
  bundled: BundledEntry[];
  status: 'booting' | 'loading' | 'ready' | 'error';
  progress: Progress | null;
  loadingRepo: string | null;
  error: AppError | null;
  notice: string | null;

  quality: Quality;
  /** The user picked a quality themselves: the governor must not override it. */
  qualityLocked: boolean;
  dpr: number;
  reducedMotion: boolean;
  isTouch: boolean;

  heroOpen: boolean;
  interacted: boolean;
  hovered: number;
  pointer: { x: number; y: number };
  selection: Selection;
  highlight: Highlight | null;
  flyTo: FlyRequest | null;

  /** The whole commit the timeline is on (-1 before the first). The fractional playhead
   *  lives in render/timelineClock.ts because it changes every frame. */
  commitIndex: number;
  playing: boolean;

  panel: 'none' | 'insights' | 'list' | 'token' | 'share';
  hasToken: boolean;

  /** The folder being viewed up close as a solar system, or null for the galaxy. */
  system: number | null;
  /** A warp between views is in progress: the UI steps aside. */
  warping: boolean;
  /** The other galaxy in a collision, or null. */
  collision: SkyModel | null;
  /** The selected file's text and outline (its planet system), or null. */
  content: ContentState | null;
  /** Index into content.outline of the symbol in focus (a planet), or -1. */
  symbol: number;
  /** The universe of related projects and people, or null. */
  universe: UniverseState | null;
  /** The guided tour in progress, or null. */
  tour: { step: number; total: number; caption: string; seconds: number } | null;
  /** Drift mode: no interface, a slow camera, the featured skies one after another. */
  drift: boolean;

  set: (p: Partial<AppState>) => void;
  setModel: (m: SkyModel) => void;
  fly: (target: [number, number, number], distance: number) => void;
}

let flyId = 0;

export const useStore = create<AppState>((set) => ({
  model: null,
  modelId: 0,
  bundled: [],
  status: 'booting',
  progress: null,
  loadingRepo: null,
  error: null,
  notice: null,

  quality: coarse ? 'low' : 'high',
  qualityLocked: false,
  dpr: Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, coarse ? 1 : 1.5),
  reducedMotion: reduced,
  isTouch: coarse,

  heroOpen: true,
  interacted: false,
  hovered: -1,
  pointer: { x: 0, y: 0 },
  selection: null,
  highlight: null,
  flyTo: null,

  commitIndex: -1,
  playing: !reduced,

  panel: 'none',
  hasToken: false,
  system: null,
  warping: false,
  collision: null,
  content: null,
  symbol: -1,
  universe: null,
  tour: null,
  drift: false,

  set: (p) => set(p),
  setModel: (m) =>
    set((s) => ({
      model: m,
      modelId: s.modelId + 1,
      status: 'ready',
      progress: null,
      loadingRepo: null,
      selection: null,
      highlight: null,
      hovered: -1,
      commitIndex: -1,
      flyTo: null,
      system: null,
      warping: false,
      collision: null,
      content: null,
      symbol: -1,
      universe: null,
    })),
  fly: (target, distance) => set({ flyTo: { target, distance, id: ++flyId } }),
}));

/** True when the home galaxy itself is on screen (not a system, collision or universe). */
export function inGalaxyView(s: Pick<AppState, 'system' | 'collision' | 'universe'>): boolean {
  return s.system === null && !s.collision && !s.universe;
}
