import { computeInsights } from '../layout/insights';
import { captureRef } from '../render/sceneRefs';
import type { SkyModel } from '../state/model';
import logoUrl from '../ui/logo.svg';
import { shareStats, shareUrl, wrapText } from './shareLayout';

export const CARD_W = 1200;
export const CARD_H = 630;

const UI = '"Instrument Sans", system-ui, sans-serif';
const MONO = '"Martian Mono", ui-monospace, Consolas, monospace';
const C = {
  void: '#04060d',
  abyss: '#0b1638',
  starlight: '#e7ecff',
  haze: '#8a95bd',
  dim: '#5f6a90',
  accent: '#ffb35c',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Grab the current frame of the galaxy. The capture function renders a fresh frame and
 * we copy it to our own canvas *in the same task*: without preserveDrawingBuffer the
 * browser may clear the WebGL canvas as soon as we yield.
 */
function snapshotGalaxy(): HTMLCanvasElement | null {
  const capture = captureRef.current;
  if (!capture) return null;
  const gl = capture();
  const copy = document.createElement('canvas');
  copy.width = gl.width;
  copy.height = gl.height;
  copy.getContext('2d')?.drawImage(gl, 0, 0);
  return copy;
}

/** Compose the 1200×630 share card: the live galaxy on the right, the repo's facts on the left. */
export interface CardOptions {
  /** Replace the deep-link footer (e.g. for the site's own preview image). */
  footer?: string;
  type?: 'image/png' | 'image/jpeg';
}

export async function renderShareCard(
  model: SkyModel,
  href: string,
  opts: CardOptions = {},
): Promise<Blob> {
  const galaxy = snapshotGalaxy();
  await Promise.all([
    document.fonts.load(`400 64px ${UI}`),
    document.fonts.load(`500 20px ${UI}`),
    document.fonts.load(`400 20px ${MONO}`),
  ]).catch(() => undefined); // fall back to system fonts if offline
  const logo = await loadImage(logoUrl).catch(() => null);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  // Background: the same deep-space gradient as the app.
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(820, 315, 0, 820, 315, 620);
  glow.addColorStop(0, C.abyss);
  glow.addColorStop(1, C.void);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // The galaxy, cover-cropped into the right 880 px, then faded into the text side.
  if (galaxy) {
    const dx = 320;
    const dw = CARD_W - dx;
    const aspect = dw / CARD_H;
    let sw = galaxy.width;
    let sh = sw / aspect;
    if (sh > galaxy.height) {
      sh = galaxy.height;
      sw = sh * aspect;
    }
    const sx = (galaxy.width - sw) / 2;
    const sy = (galaxy.height - sh) / 2;
    ctx.globalCompositeOperation = 'lighter'; // light adds to the background, like the app
    ctx.drawImage(galaxy, sx, sy, sw, sh, dx, 0, dw, CARD_H);
    ctx.globalCompositeOperation = 'source-over';
    const fade = ctx.createLinearGradient(dx, 0, dx + 300, 0);
    fade.addColorStop(0, 'rgba(4, 6, 13, 1)');
    fade.addColorStop(1, 'rgba(4, 6, 13, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(dx - 1, 0, 301, CARD_H);
  }

  const { meta } = model.data;
  const X = 64;
  const W = 470;
  ctx.textBaseline = 'alphabetic';

  // Brand row.
  if (logo) ctx.drawImage(logo, X, 52, 30, 30);
  ctx.fillStyle = C.starlight;
  ctx.font = `400 22px ${UI}`;
  ctx.fillText('Gitsky', X + 42, 75);
  ctx.fillStyle = C.dim;
  ctx.font = `400 15px ${UI}`;
  ctx.fillText('Your repo’s night sky', X + 118, 75);

  // Owner and repo name.
  ctx.fillStyle = C.haze;
  ctx.font = `400 18px ${MONO}`;
  ctx.fillText(`${meta.owner} /`, X, 176);
  ctx.fillStyle = C.starlight;
  let size = 68;
  ctx.font = `400 ${size}px ${UI}`;
  while (ctx.measureText(meta.repo).width > W && size > 36) {
    size -= 4;
    ctx.font = `400 ${size}px ${UI}`;
  }
  ctx.fillText(meta.repo, X - 3, 176 + size * 0.95);
  let y = 176 + size * 0.95 + 44;

  // Description.
  if (meta.description) {
    ctx.fillStyle = C.haze;
    ctx.font = `400 19px ${UI}`;
    for (const line of wrapText(meta.description, W, 2, (s) => ctx.measureText(s).width)) {
      ctx.fillText(line, X, y);
      y += 28;
    }
    y += 10;
  }

  // Stats.
  const stats = shareStats({
    files: model.data.files.length,
    stars: meta.stars,
    commits: model.data.commits.length,
    capped: model.data.capped?.originalFileCount ?? null,
  });
  y = Math.max(y + 22, 410);
  let sx = X;
  for (const [value, label] of stats) {
    ctx.fillStyle = C.starlight;
    ctx.font = `400 26px ${MONO}`;
    ctx.fillText(value, sx, y);
    const vw = ctx.measureText(value).width;
    ctx.fillStyle = C.haze;
    ctx.font = `400 14px ${UI}`;
    ctx.fillText(label, sx, y + 24);
    sx += Math.max(vw, ctx.measureText(label).width) + 34;
  }

  // Language share by bytes, with the top three named: bar and labels from one ranking.
  const langs = computeInsights(model).languages;
  const spectrum = langs.map((l) => [l.color, l.share] as const);
  y += 62;
  let bx = X;
  const gap = 3;
  const usable = W - gap * (spectrum.length - 1);
  for (const [color, frac] of spectrum) {
    const w = Math.max(3, frac * usable);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, y, w, 6, 3);
    ctx.fill();
    bx += w + gap;
  }
  const legend = langs.filter((l) => l.name !== 'Other').slice(0, 3);
  let lx = X;
  ctx.font = `400 14px ${UI}`;
  for (const l of legend) {
    ctx.fillStyle = l.color;
    ctx.beginPath();
    ctx.arc(lx + 5, y + 30, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.haze;
    ctx.fillText(l.name, lx + 16, y + 35);
    lx += 16 + ctx.measureText(l.name).width + 22;
  }

  // Footer: where to see it live.
  const url = opts.footer ?? shareUrl(href, meta.fullName).replace(/^https?:\/\//, '');
  ctx.fillStyle = C.dim;
  ctx.font = `400 13px ${MONO}`;
  ctx.fillText(url.length > 60 ? `${url.slice(0, 59)}…` : url, X, CARD_H - 44);
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(X - 18, CARD_H - 48.5, 3.5, 0, Math.PI * 2);
  ctx.fill();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image export failed'))),
      opts.type ?? 'image/png',
      0.9,
    ),
  );
}
