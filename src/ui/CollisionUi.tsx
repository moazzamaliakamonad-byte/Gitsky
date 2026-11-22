import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { sharedPaths } from '../layout/collision';
import { spectrumOf } from '../layout/color';
import { formatBytes } from '../layout/size';
import { collisionClock } from '../render/collisionClock';
import { endCollision } from '../state/collisionActions';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import { Spectrum } from './Spectrum';

/** The four acts of a collision, read from how the core separation changes. */
const PHASES = [
  'The galaxies close in',
  'First pass: tides tear stars loose into tails',
  'Falling back together',
  'Merged into one galaxy',
] as const;

function usePhase() {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(collisionClock.playing);
  const track = useRef({ prev: Infinity, phase: 0, t: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = collisionClock;
      const k = track.current;
      if (c.t < k.t) Object.assign(k, { prev: Infinity, phase: 0 }); // replayed
      k.t = c.t;
      const d = c.separation;
      // Separation falls (0), rises after the first pass (1), falls again (2), then ~0 (3).
      if (k.phase === 0 && d > k.prev + 1e-4 && c.t > 1) k.phase = 1;
      else if (k.phase === 1 && d < k.prev - 1e-4) k.phase = 2;
      if (k.phase >= 1 && d < 0.1) k.phase = 3;
      k.prev = d;
      // React state changes only when something visible changes: the phase, a whole
      // percent of progress, or play/pause. Setting it every frame re-rendered the panel
      // 60 times a second and halved the frame rate.
      setPhase(k.phase);
      setProgress(Math.round(Math.min(1, c.t / 60) * 100) / 100);
      setPlaying(c.playing);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return { phase, progress, playing };
}

function mainLanguage(m: SkyModel) {
  const [top] = spectrumOf(m.data.files, 1);
  return top ? (m.legend.find((l) => l.color === top[0])?.name ?? '') : '';
}

const Side = memo(function Side({ m, i }: { m: SkyModel; i: 0 | 1 }) {
  const spectrum = useMemo(() => spectrumOf(m.data.files), [m]);
  const lang = useMemo(() => mainLanguage(m), [m]);
  const bytes = m.totalBytes;
  return (
    <div className={`collide-side collide-side--${i}`}>
      <a
        className="collide-side__name mono"
        href={m.data.meta.htmlUrl}
        target="_blank"
        rel="noreferrer"
      >
        {m.data.meta.fullName}
      </a>
      <Spectrum parts={spectrum} className="collide-side__spectrum" />
      <dl className="collide-side__facts">
        <div>
          <dt>Files</dt>
          <dd className="mono">{m.data.files.length.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd className="mono">{formatBytes(bytes)}</dd>
        </div>
        <div>
          <dt>Mostly</dt>
          <dd>{lang}</dd>
        </div>
      </dl>
    </div>
  );
});

/** Repo names riding on the two galaxy cores. */
export function CollisionLabels() {
  const model = useStore((s) => s.model);
  const other = useStore((s) => s.collision);
  if (!model || !other) return null;
  return (
    <div className="sys-labels">
      {[model, other].map((m, i) => (
        <span
          key={m.data.meta.fullName}
          ref={(el) => {
            collisionClock.labels[i] = el;
          }}
          className={`collide-label collide-label--${i} mono`}
        >
          {m.data.meta.fullName}
        </span>
      ))}
    </div>
  );
}

/** The collision panel: the two repos side by side, what's happening, and controls. */
export function CollisionHud() {
  const model = useStore((s) => s.model);
  const other = useStore((s) => s.collision);
  const { phase, progress, playing } = usePhase();
  const shared = useMemo(
    () => (model && other ? sharedPaths(model.data.files, other.data.files, 5000) : []),
    [model, other],
  );
  if (!model || !other) return null;
  const a = model.data.files.length;
  const b = other.data.files.length;
  const ratio = a >= b ? a / Math.max(1, b) : b / Math.max(1, a);
  const bigger = a >= b ? model : other;
  const smaller = a >= b ? other : model;
  const sample = shared.slice(0, 3).map(([i]) => model.data.files[i].path);

  return (
    <section className="collide-hud panel" aria-label="Galaxy collision">
      <div className="collide-hud__sides">
        <Side m={model} i={0} />
        <span className="collide-hud__vs" aria-hidden="true" />
        <Side m={other} i={1} />
      </div>
      <p className="collide-hud__story">
        {ratio >= 1.15
          ? `${bigger.data.meta.fullName} has ${ratio.toFixed(ratio < 10 ? 1 : 0)}× the files of ${smaller.data.meta.fullName}, so it has more pull.`
          : 'Evenly matched: both pull about equally.'}{' '}
        {shared.length > 0
          ? `They share ${shared.length.toLocaleString()} file ${shared.length === 1 ? 'path' : 'paths'} (${sample.join(', ')}${shared.length > 3 ? '…' : ''}), linked by threads of light as they pass.`
          : 'They share no file paths.'}
      </p>
      <div className="collide-hud__bar">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => (collisionClock.playing = !collisionClock.playing)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d={playing ? 'M7 5v10M13 5v10' : 'M7 4.5v11l9-5.5z'} />
          </svg>
        </button>
        <div className="collide-hud__phase">
          <span aria-live="polite">{PHASES[phase]}</span>
          <span className="collide-hud__track">
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            collisionClock.reset = true;
          }}
        >
          Replay
        </button>
        <button type="button" className="btn btn--accent" onClick={endCollision}>
          End collision
        </button>
      </div>
      <p className="collide-hud__note">
        A gravity simulation: mass comes from file count, and the motion is physics, not data.
      </p>
    </section>
  );
}
