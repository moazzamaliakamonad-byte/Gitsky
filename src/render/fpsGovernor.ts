/**
 * Automatic quality downgrade.
 *
 * Every frame we add the frame time to a 1-second window. At the end of each window we
 * compute the average FPS. Two low windows in a row means a real problem, not a hiccup
 * (a GC pause, a tab switch), so we step down one notch: first the device-pixel ratio
 * (fewer pixels to shade), then, at the lowest DPR, switch bloom off. After each step
 * we wait two windows so the change has time to show up in the numbers.
 *
 * We never step back up automatically: flip-flopping quality is more distracting than
 * staying a notch lower. The user can always choose High again.
 */

export type GovernorAction = { kind: 'dpr'; dpr: number } | { kind: 'quality'; quality: 'low' };

export interface GovernorOptions {
  dprLevels: number[];
  startDpr: number;
  lowFps?: number;
  allowQualityDrop?: boolean;
}

const WINDOW_MS = 1000;
const NEEDED_LOW_WINDOWS = 2;
const COOLDOWN_WINDOWS = 2;
const MAX_FRAME_MS = 250;

export class FpsGovernor {
  private levels: number[];
  private level: number;
  private lowFps: number;
  private allowQualityDrop: boolean;
  private elapsed = 0;
  private frames = 0;
  private lowStreak = 0;
  private cooldown = 0;
  private done = false;

  constructor(opts: GovernorOptions) {
    this.levels = [...opts.dprLevels].sort((a, b) => b - a);
    const i = this.levels.findIndex((l) => l <= opts.startDpr);
    this.level = i < 0 ? this.levels.length - 1 : i;
    this.lowFps = opts.lowFps ?? 45;
    this.allowQualityDrop = opts.allowQualityDrop ?? true;
  }

  frame(dtMs: number): GovernorAction | null {
    if (this.done) return null;
    if (dtMs > MAX_FRAME_MS) {
      // The tab was hidden or the main thread was blocked: not a rendering problem.
      this.elapsed = 0;
      this.frames = 0;
      return null;
    }
    this.elapsed += dtMs;
    this.frames++;
    if (this.elapsed < WINDOW_MS) return null;

    const fps = (this.frames * 1000) / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;

    if (this.cooldown > 0) {
      this.cooldown--;
      return null;
    }
    this.lowStreak = fps < this.lowFps ? this.lowStreak + 1 : 0;
    if (this.lowStreak < NEEDED_LOW_WINDOWS) return null;

    this.lowStreak = 0;
    this.cooldown = COOLDOWN_WINDOWS;
    if (this.level < this.levels.length - 1) {
      this.level++;
      return { kind: 'dpr', dpr: this.levels[this.level] };
    }
    this.done = true;
    return this.allowQualityDrop ? { kind: 'quality', quality: 'low' } : null;
  }
}
