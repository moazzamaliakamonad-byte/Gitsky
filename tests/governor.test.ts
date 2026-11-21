import { describe, expect, it } from 'vitest';
import { FpsGovernor } from '../src/render/fpsGovernor';

/** Feed `seconds` worth of frames at `fps`, collecting the actions the governor takes. */
function run(g: FpsGovernor, fps: number, seconds: number) {
  const actions: string[] = [];
  const dt = 1000 / fps;
  for (let t = 0; t < seconds * 1000; t += dt) {
    const a = g.frame(dt);
    if (a) actions.push(a.kind === 'dpr' ? `dpr:${a.dpr}` : `quality:${a.quality}`);
  }
  return actions;
}

describe('FpsGovernor', () => {
  it('does nothing while frames are smooth', () => {
    const g = new FpsGovernor({ dprLevels: [1.5, 1.25, 1], startDpr: 1.5 });
    expect(run(g, 60, 10)).toEqual([]);
  });

  it('steps DPR down one level at a time when FPS stays low', () => {
    const g = new FpsGovernor({ dprLevels: [1.5, 1.25, 1], startDpr: 1.5 });
    const actions = run(g, 30, 12);
    expect(actions[0]).toBe('dpr:1.25');
    expect(actions[1]).toBe('dpr:1');
  });

  it('switches to low quality after the lowest DPR still struggles', () => {
    const g = new FpsGovernor({ dprLevels: [1.5, 1], startDpr: 1.5 });
    expect(run(g, 25, 20)).toEqual(['dpr:1', 'quality:low']);
  });

  it('ignores a single hiccup (needs a sustained drop)', () => {
    const g = new FpsGovernor({ dprLevels: [1.5, 1], startDpr: 1.5 });
    const actions = [...run(g, 60, 3), ...run(g, 20, 1.2), ...run(g, 60, 5)];
    expect(actions).toEqual([]);
  });

  it('ignores huge frame gaps (tab was hidden)', () => {
    const g = new FpsGovernor({ dprLevels: [1.5, 1], startDpr: 1.5 });
    for (let i = 0; i < 20; i++) expect(g.frame(5000)).toBeNull();
  });

  it('stops after reaching the floor', () => {
    const g = new FpsGovernor({ dprLevels: [1], startDpr: 1, allowQualityDrop: false });
    expect(run(g, 10, 30)).toEqual([]);
  });
});
