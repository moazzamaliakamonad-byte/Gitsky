import * as THREE from 'three';

/**
 * Drawn by the composer AFTER the lens pass, so it is neither bent nor shadowed:
 * the near half of each accretion disk, which passes in front of its black hole.
 */
export const overlayScene = new THREE.Scene();

/**
 * Per-frame values the scene hands to the post-processing passes. Plain mutable data,
 * written in useFrame by BlackHoles / Supernova and read by Effects in the same frame.
 */
export const fxState = {
  /** Up to 3 holes × (uv x, uv y, Einstein radius in uv-height units, strength). */
  holes: new Float32Array(12),
  holeCount: 0,
  /** Supernova shock ripple: uv x, uv y, ring radius, amplitude. */
  shock: new Float32Array(4),
  /** Supernova flash 0..1, used to push bloom for a moment. */
  flash: 0,
};
