/**
 * Star size from file size in bytes. Log scale: a 10× bigger file is a constant
 * step bigger, so a 2 MB bundle doesn't dwarf the sky and a 200-byte config still shows.
 * Returns a size in "point units" that the shader scales by distance and DPR.
 */
export const MIN_SIZE = 0.9;
export const MAX_SIZE = 4.6;

export function sizeFromBytes(bytes: number): number {
  const s = MIN_SIZE + 0.55 * Math.log10(Math.max(0, bytes) + 1);
  return Math.min(MAX_SIZE, s);
}

export function sizesFor(files: { size: number }[]): Float32Array {
  const out = new Float32Array(files.length);
  for (let i = 0; i < files.length; i++) out[i] = sizeFromBytes(files[i].size);
  return out;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[u]}`;
}
