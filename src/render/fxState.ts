/**
 * Per-frame values the scene hands to the post-processing passes. Plain mutable data,
 * written in useFrame by Supernova and read by Effects in the same frame.
 */
export const fxState = {
  /** Supernova shock ripple: uv x, uv y, ring radius, amplitude. */
  shock: new Float32Array(4),
  /** Supernova flash 0..1, used to push bloom for a moment. */
  flash: 0,
};
