import { gauss, rand } from '../layout/random';
import type { SkyModel } from '../state/model';

/** How many glow points each real file gets, and the caps by quality. */
const PER_FILE = 4;
export const CAP = { high: 36000, low: 12000 } as const;

/**
 * Builds the unresolved-starlight cloud. Each point borrows a real file's position and
 * colour and is scattered around it within that file's folder cluster, so the glow is
 * exactly as dense as the data underneath it. Deterministic: same repo, same glow.
 */
export function buildGlow(model: SkyModel, cap: number) {
  const { positions, folderRadii, tree } = model.layout;
  const n = model.data.files.length;
  const count = Math.min(cap, n * PER_FILE);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const bright = new Float32Array(count);
  for (let j = 0; j < count; j++) {
    const i = Math.min(n - 1, Math.floor(rand(j, 0) * n));
    const sigma = Math.max(0.5, folderRadii[tree.fileFolder[i]] * 0.32);
    pos[j * 3] = positions[i * 3] + gauss(j, 1) * sigma;
    pos[j * 3 + 1] = positions[i * 3 + 1] + gauss(j, 3) * sigma * 0.35;
    pos[j * 3 + 2] = positions[i * 3 + 2] + gauss(j, 5) * sigma;
    // Unresolved light is a little whiter than any single star, but keeps the file's hue.
    for (let c = 0; c < 3; c++)
      col[j * 3 + c] = model.colors[i * 3 + c] * 0.7 + [0.3, 0.28, 0.26][c];
    // Two populations: fine grain (a granular texture of faint points) and soft
    // diffuse light (wide, very faint sprites that overlap into a smooth glow).
    const k = rand(j, 7);
    if (rand(j, 9) < 0.72) {
      size[j] = 0.35 + k * k * 0.9;
      bright[j] = 0.25 + rand(j, 8) * 0.75;
    } else {
      size[j] = 2.2 + k * 3.2;
      bright[j] = 0.1 + rand(j, 8) * 0.14;
    }
  }
  return { count, pos, col, size, bright };
}
