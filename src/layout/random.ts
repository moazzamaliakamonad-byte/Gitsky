/**
 * Stateless, seeded randomness. `rand(seed, k)` is "the k-th random number for this
 * seed", always the same. Seeds come from hashing a file's path, so the same repo
 * always produces the same sky, and adding one file doesn't reshuffle the others.
 */

/** A 32-bit integer mix (from the "lowbias32" family): small input changes scatter widely. */
function mix(x: number): number {
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Uniform in [0, 1). */
export function rand(seed: number, k: number): number {
  return mix((seed + Math.imul(k + 1, 0x9e3779b9)) | 0) / 4294967296;
}

/** Standard normal (mean 0, sd 1) via Box–Muller. Uses draws k and k+1. */
export function gauss(seed: number, k: number): number {
  const u = Math.max(rand(seed, k), 1e-9);
  const v = rand(seed, k + 1);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
