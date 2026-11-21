import { useEffect, useRef, useState } from 'react';
import { openBundled, openRepoInput } from '../state/actions';
import { useStore, type AppError } from '../state/store';

/** A small constellation per kind of trouble, drawn in the sky's own language. */
function Glyph({ kind, progress }: { kind: AppError['kind']; progress?: number }) {
  const star = (x: number, y: number, r = 2.2, cls = '') => (
    <circle cx={x} cy={y} r={r} className={cls} />
  );
  switch (kind) {
    case 'not_found':
      // An orbit with nothing at its centre: the star you asked for isn't there.
      return (
        <svg viewBox="0 0 64 64" className="glyph" aria-hidden="true">
          <circle cx="32" cy="32" r="20" className="glyph__orbit glyph__dash" />
          <circle cx="32" cy="32" r="5" className="glyph__hollow" />
          {star(52, 32, 2.4, 'glyph__accent')}
          {star(14, 20)}
          {star(20, 50, 1.6)}
        </svg>
      );
    case 'rate_limited':
      // A dial that fills as the reset approaches.
      return (
        <svg viewBox="0 0 64 64" className="glyph" aria-hidden="true">
          <circle cx="32" cy="32" r="20" className="glyph__orbit" />
          <circle
            cx="32"
            cy="32"
            r="20"
            className="glyph__progress"
            pathLength={100}
            strokeDasharray={`${Math.round((progress ?? 0) * 100)} 100`}
            transform="rotate(-90 32 32)"
          />
          {star(32, 32, 3, 'glyph__accent')}
        </svg>
      );
    case 'network':
      // Two stars whose link is broken.
      return (
        <svg viewBox="0 0 64 64" className="glyph" aria-hidden="true">
          <path d="M14 42 L27 33" className="glyph__line" />
          <path d="M37 27 L50 18" className="glyph__line" />
          {star(14, 42, 3)}
          {star(50, 18, 3, 'glyph__accent')}
          {star(32, 52, 1.5)}
        </svg>
      );
    case 'empty':
      return (
        <svg viewBox="0 0 64 64" className="glyph" aria-hidden="true">
          <circle cx="32" cy="32" r="22" className="glyph__orbit glyph__dash" />
          <circle cx="32" cy="32" r="12" className="glyph__orbit glyph__dash" />
          {star(32, 32, 2, 'glyph__accent')}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" className="glyph" aria-hidden="true">
          <path d="M16 44 L30 24 L48 36" className="glyph__line" />
          {star(16, 44)}
          {star(30, 24, 3, 'glyph__accent')}
          {star(48, 36)}
        </svg>
      );
  }
}

function useCountdown(resetAt?: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!resetAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resetAt]);
  if (!resetAt) return null;
  const left = Math.max(0, resetAt - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return {
    left,
    text:
      left === 0
        ? 'The limit has reset. Try again.'
        : `Resets in ${m}:${String(s).padStart(2, '0')}`,
    at: new Date(resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    progress: 1 - Math.min(1, left / 3_600_000),
  };
}

export function ErrorCard() {
  const error = useStore((s) => s.error);
  const bundled = useStore((s) => s.bundled);
  const ref = useRef<HTMLDivElement>(null);
  const countdown = useCountdown(error?.kind === 'rate_limited' ? error.resetAt : undefined);

  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);

  if (!error) return null;
  const dismiss = () => useStore.getState().set({ error: null });
  const retry = () => {
    dismiss();
    void openRepoInput(error.repo ?? '');
  };

  return (
    <div className="modal-backdrop" onClick={dismiss}>
      <div
        className="error-card panel"
        role="alertdialog"
        aria-labelledby="error-title"
        aria-describedby="error-msg"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && dismiss()}
      >
        <Glyph kind={error.kind} progress={countdown?.progress} />
        <h2 id="error-title">{error.title}</h2>
        <p id="error-msg">{error.message}</p>
        {error.repo && error.kind !== 'parse' && (
          <p className="error-card__repo mono">{error.repo}</p>
        )}
        {countdown && (
          <p className="error-card__reset mono" aria-live="polite">
            {countdown.text} <span>({countdown.at})</span>
          </p>
        )}
        <div className="error-card__actions">
          {(error.kind === 'rate_limited' || error.kind === 'bad_token') && (
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => useStore.getState().set({ error: null, panel: 'token' })}
            >
              {error.kind === 'bad_token' ? 'Change token' : 'Add a token'}
            </button>
          )}
          {(error.kind === 'network' || (error.kind === 'rate_limited' && countdown?.left === 0)) &&
            error.repo && (
              <button type="button" className="btn btn--accent" onClick={retry}>
                Try again
              </button>
            )}
          {bundled[0] && error.kind !== 'parse' && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                dismiss();
                void openBundled(bundled[0]);
              }}
            >
              Show {bundled[0].fullName} instead
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={dismiss}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
