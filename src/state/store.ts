import { create } from 'zustand';
import type { GitHubErrorKind } from '../data/github';
import type { BundledEntry, Progress } from '../data/types';
import type { SkyModel } from './model';

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

  /** Fractional index into model.data.commits. */
  playhead: number;
  playing: boolean;

  panel: 'none' | 'insights' | 'list' | 'token';
  hasToken: boolean;

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

  playhead: 0,
  playing: !reduced,

  panel: 'none',
  hasToken: false,

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
      playhead: 0,
      flyTo: null,
    })),
  fly: (target, distance) => set({ flyTo: { target, distance, id: ++flyId } }),
}));
