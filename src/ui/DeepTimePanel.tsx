import { useEffect, useMemo, useRef } from 'react';
import { deepClock } from '../render/deepClock';
import { closeDeepTime, seekDeep, toggleDeepPlay } from '../state/deepActions';
import { useStore } from '../state/store';

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

/**
 * Deep time's controls, in the commit timeline's place: the moment on screen, how many
 * files existed then, and a slider across the repo's life from the first commit to today.
 */
export function DeepTimePanel() {
  const deep = useStore((s) => s.deep);
  const model = useStore((s) => s.model);
  const trackRef = useRef<HTMLDivElement>(null);
  const history = deep?.history;
  const last = history?.epochs.length ?? 0;

  const today = model ? (model.data.capped?.originalFileCount ?? model.data.files.length) : 0;
  const ticks = useMemo(() => {
    if (!history) return [];
    const counts = [...history.epochs.map((e) => e.count), today];
    const max = Math.max(1, ...counts);
    return counts.map((c) => 0.18 + 0.82 * (Math.log1p(c) / Math.log1p(max)));
  }, [history, today]);

  // Glide the playhead marker every frame without re-rendering React.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = trackRef.current;
      if (el && last > 0)
        el.style.setProperty('--p', Math.min(1, (deepClock.epoch + 0.5) / (last + 1)).toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [last]);

  if (!deep || !model) return null;

  if (!history) {
    const pct = deep.total ? Math.round((deep.done / deep.total) * 100) : 0;
    return (
      <section className="timeline deep panel" aria-label="Deep time" aria-busy="true">
        <div className="timeline__head">
          <p className="timeline__title">Reading the history&hellip;</p>
          <span className="timeline__pos mono">
            {deep.total ? `${deep.done}/${deep.total}` : ''}
          </span>
          <button
            type="button"
            className="deep__close"
            aria-label="Close deep time"
            onClick={closeDeepTime}
          >
            &times;
          </button>
        </div>
        <div className="deep__progress" aria-hidden="true">
          <span style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
      </section>
    );
  }

  const k = deep.epoch;
  const atToday = k >= last;
  const when = atToday ? 'Today' : monthYear(history.epochs[k].date);
  const count = atToday ? today : history.epochs[k].count;

  return (
    <section className="timeline deep panel" aria-label="Deep time">
      <div className="timeline__head">
        <button
          type="button"
          className="timeline__play"
          aria-label={deep.playing ? 'Pause' : 'Play the history'}
          onClick={toggleDeepPlay}
        >
          {deep.playing ? (
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
        <p className="timeline__title deep__when" aria-live="polite">
          {when}
        </p>
        <span className="deep__count mono">{count.toLocaleString()} files</span>
        <button
          type="button"
          className="deep__close"
          aria-label="Back to today"
          onClick={closeDeepTime}
        >
          &times;
        </button>
      </div>

      <div className="timeline__track deep__track" ref={trackRef}>
        <div className="timeline__ticks" aria-hidden="true">
          {ticks.map((h, i) => (
            <span
              key={i}
              className={i <= k ? (i === k ? 'is-now' : 'is-past') : undefined}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
        </div>
        <span className="timeline__head-marker" aria-hidden="true" />
        <input
          type="range"
          className="timeline__range"
          min={0}
          max={last}
          step={1}
          value={k}
          aria-label="Moment in the repo's history"
          aria-valuetext={`${when}: ${count.toLocaleString()} files`}
          onChange={(e) => seekDeep(Number(e.target.value))}
        />
      </div>

      <div className="deep__ends">
        <span>{monthYear(history.epochs[0].date)}</span>
        <span>{history.totalCommits.toLocaleString()} commits</span>
        <span>Today</span>
      </div>
    </section>
  );
}
