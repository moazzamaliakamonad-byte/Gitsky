/**
 * FNV-1a, 32-bit. A tiny, fast, well-distributed string hash. Not cryptographic;
 * we only need "same input, same number" for deterministic jitter and sampling.
 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
