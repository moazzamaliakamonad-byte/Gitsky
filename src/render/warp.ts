import * as THREE from 'three';
import { useStore } from '../state/store';

/**
 * The warp between the galaxy and a folder's solar system (and between systems).
 * A plain mutable object, advanced by WarpDriver in useFrame; React only hears about
 * the start, the switch (store.system) and the end.
 *
 * Timeline: ACCEL seconds speeding toward the target (FOV widens, streaks grow), a
 * flash that hides the switch, then ARRIVE seconds decelerating into the new view.
 */
export const ACCEL = 1.0;
export const ARRIVE = 1.15;

export interface WarpState {
  active: boolean;
  t: number;
  /** +1 forward (into a system), -1 backward (out to the galaxy). */
  dir: 1 | -1;
  /** What store.system becomes at the switch. */
  next: number | null;
  /** Where to dive toward (or away from) before the switch. */
  aim: THREE.Vector3;
  switched: boolean;
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  arriveFrom: THREE.Vector3;
  arriveTo: THREE.Vector3;
  arriveTarget: THREE.Vector3;
  /** 0 … 1: streak strength this frame (read by WarpStreaks). */
  speed: number;
  /** 0 … 1: white-out strength this frame (read by the DOM flash). */
  flash: number;
}

export const warp: WarpState = {
  active: false,
  t: 0,
  dir: 1,
  next: null,
  aim: new THREE.Vector3(),
  switched: false,
  fromPos: new THREE.Vector3(),
  fromTarget: new THREE.Vector3(),
  arriveFrom: new THREE.Vector3(),
  arriveTo: new THREE.Vector3(),
  arriveTarget: new THREE.Vector3(),
  speed: 0,
  flash: 0,
};

/** Start a warp. `aim` is the world point to dive toward (forward) or pull away from. */
export function startWarp(next: number | null, aim: [number, number, number], dir: 1 | -1) {
  if (warp.active) return;
  warp.active = true;
  warp.t = 0;
  warp.dir = dir;
  warp.next = next;
  warp.aim.set(...aim);
  warp.switched = false;
  useStore.getState().set({ warping: true, hovered: -1 });
}
