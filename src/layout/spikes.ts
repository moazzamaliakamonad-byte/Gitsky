/**
 * Which stars get diffraction spikes. Spikes are the most eye-catching mark in the sky,
 * so they must stay rare to mean anything: the hottest files in the sample (strongest)
 * and the very largest files by bytes (fainter). At most ~40 per sky.
 * Returns a strength 0..1 per file for the `aSpike` attribute.
 */
export function computeSpikes(sizes: ArrayLike<number>, counts: ArrayLike<number>): Float32Array {
  const n = sizes.length;
  const out = new Float32Array(n);
  if (n === 0) return out;
  const idx = Array.from({ length: n }, (_, i) => i);

  // Largest files: the top 0.3%, between 1 and 24 of them.
  const k = Math.min(24, Math.max(1, Math.round(n * 0.003)));
  idx.sort((a, b) => sizes[b] - sizes[a] || a - b);
  for (let r = 0; r < k; r++) if (sizes[idx[r]] > 0) out[idx[r]] = 0.55;

  // Hottest files: every file tied for the maximum, plus others touched at least twice.
  let max = 0;
  for (let i = 0; i < n; i++) if (counts[i] > max) max = counts[i];
  if (max > 0) {
    idx.sort((a, b) => counts[b] - counts[a] || a - b);
    for (let r = 0; r < Math.min(n, 12); r++) {
      const c = counts[idx[r]];
      if (c === max) out[idx[r]] = 1;
      else if (c >= 2) out[idx[r]] = Math.max(out[idx[r]], 0.8);
    }
  }
  return out;
}
