import { useEffect, useMemo, useRef } from 'react';
import { authorColor } from '../render/cometMath';
import { ARRIVE } from '../render/timeline';
import { timelineClock } from '../render/timelineClock';
import { useStore } from '../state/store';
import { relativeTime } from './format';

/**
 * The time slider: one tick per sampled commit (height = files changed, log scale,
 * colour = author), a playhead that glides with playback, the current commit's card,
 * and play/pause. A real <input type="range"> sits over the ticks for keyboard and
 * screen-reader scrubbing.
 */
export function Timeline() {
  const model = useStore((s) => s.model);
  const commitIndex = useStore((s) => s.commitIndex);
  const playing = useStore((s) => s.playing);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const trackRef = useRef<HTMLDivElement>(null);

  const commits = useMemo(() => model?.data.commits ?? [], [model]);
  const n = commits.length;

  const ticks = useMemo(() => {
    const max = Math.max(1, ...commits.map((c) => c.changedCount));
    return commits.map((c) => ({
      h: 0.22 + 0.78 * (Math.log1p(c.changedCount) / Math.log1p(max)),
      color: authorColor(c.author),
    }));
  }, [commits]);

  // Glide the playhead marker every frame without re-rendering React.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = trackRef.current;
      if (el && n > 0) {
        const p = Math.max(0, Math.min(1, (timelineClock.playhead + 0.5) / n));
        el.style.setProperty('--p', p.toFixed(4));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n]);

  if (!model || n === 0) return null;

  const current = commitIndex >= 0 ? commits[commitIndex] : null;
  const seek = (k: number) => {
    // With motion, restart the commit so its comets fly again; without, show it landed.
    timelineClock.playhead = reducedMotion ? k + ARRIVE + 0.05 : k + 0.001;
  };

  return (
    <section className="timeline panel" aria-label="Commit timeline">
      <div className="timeline__head">
        <button
          type="button"
          className="timeline__play"
          aria-label={playing ? 'Pause the replay' : 'Play the replay'}
          onClick={() => useStore.getState().set({ playing: !playing })}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="4" y="3" width="3" height="10" rx="1" />
              <rect x="9" y="3" width="3" height="10" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" />
            </svg>
          )}
        </button>
        <p className="timeline__title">Last {n} commits</p>
        {current && (
          <span className="timeline__pos mono">
            {commitIndex + 1}/{n}
          </span>
        )}
      </div>

      <div className="timeline__track" ref={trackRef}>
        <div className="timeline__ticks" aria-hidden="true">
          {ticks.map((t, i) => (
            <span
              key={i}
              className={i <= commitIndex ? (i === commitIndex ? 'is-now' : 'is-past') : undefined}
              style={{ height: `${Math.round(t.h * 100)}%`, color: t.color }}
            />
          ))}
        </div>
        <span className="timeline__head-marker" aria-hidden="true" />
        <input
          type="range"
          className="timeline__range"
          min={0}
          max={n - 1}
          step={1}
          value={Math.max(0, commitIndex)}
          aria-label="Commit"
          aria-valuetext={
            current ? `${commitIndex + 1} of ${n}: ${current.message}` : 'Before the first commit'
          }
          onChange={(e) => seek(Number(e.target.value))}
          onPointerDown={() => useStore.getState().set({ playing: false })}
        />
      </div>

      <div className="timeline__card" aria-live="polite">
        {current ? (
          <>
            <span
              className="swatch"
              style={{
                background: authorColor(current.author),
                color: authorColor(current.author),
              }}
            />
            <a
              className="timeline__msg"
              href={`${model.data.meta.htmlUrl}/commit/${current.sha}`}
              target="_blank"
              rel="noreferrer"
              title={current.message}
            >
              {current.message}
            </a>
            <span className="timeline__meta">
              <span className="mono">{current.author}</span>
              <span>{relativeTime(current.date)}</span>
              <span>
                {current.changedCount} file{current.changedCount === 1 ? '' : 's'}
              </span>
            </span>
          </>
        ) : (
          <span className="timeline__waiting">
            Comets arrive in the order the commits were made.
          </span>
        )}
      </div>
    </section>
  );
}
