/**
 * Screen-space picking: which star is under the cursor?
 *
 * Instead of casting a 3D ray, we project every star to the screen with the camera's
 * view-projection matrix and take the nearest one within `radiusPx`. For points this
 * is simpler and more forgiving than ray casting (small stars are still easy to hover),
 * and 50,000 stars take about a millisecond. See learn/concepts/picking.md.
 *
 * `m` is a column-major 4×4 matrix (three.js `Matrix4.elements`).
 */
export function pickNearest(
  positions: ArrayLike<number>,
  count: number,
  m: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
  radiusPx: number,
  filter?: (i: number) => boolean,
): number {
  const r2 = radiusPx * radiusPx;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < count; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const w = m[3] * px + m[7] * py + m[11] * pz + m[15];
    if (w <= 1e-6) continue; // behind the camera
    const cx = (m[0] * px + m[4] * py + m[8] * pz + m[12]) / w;
    const cy = (m[1] * px + m[5] * py + m[9] * pz + m[13]) / w;
    const sx = (cx * 0.5 + 0.5) * width;
    const sy = (0.5 - cy * 0.5) * height;
    const dx = sx - x;
    const dy = sy - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (filter && !filter(i)) continue;
    // Prefer the nearest on screen; among near-ties, the one closer to the camera.
    const score = d2 + w * 0.01;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
