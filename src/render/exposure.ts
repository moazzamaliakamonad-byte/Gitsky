/**
 * Dense skies add up to white under additive blending, so both the stars and the glow
 * beneath them are dimmed as the file count grows: 1 up to 2,500 files, then falling
 * with 1/sqrt(n) to a floor of 0.26 (reached near 37,000 files).
 */
export function densityExposure(files: number): number {
  return Math.min(1, Math.max(0.26, Math.sqrt(2500 / Math.max(1, files))));
}
