import type { EffectComposer } from 'postprocessing';
import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Plain mutable references into the live scene, for code outside React's render
 * (picking, capture, keyboard handlers). Writing these never triggers a re-render.
 */
export const starsRef: { current: THREE.Points | null } = { current: null };
export const controlsRef: { current: OrbitControls | null } = { current: null };
export const cameraRef: { current: THREE.PerspectiveCamera | null } = { current: null };
export const composerRef: { current: EffectComposer | null } = { current: null };

/**
 * Renders one frame right now (with bloom if it's on) and returns the canvas. Read the
 * canvas immediately, in the same task: without preserveDrawingBuffer the browser may
 * clear it once control returns to the event loop.
 */
export const captureRef: { current: (() => HTMLCanvasElement) | null } = { current: null };
