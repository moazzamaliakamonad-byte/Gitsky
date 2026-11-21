import { useEffect, useRef } from 'react';
import { openBundled, openRepoInput } from '../state/actions';
import { useStore } from '../state/store';

function resetText(resetAt?: number): string | null {
  if (!resetAt) return null;
  const mins = Math.max(1, Math.ceil((resetAt - Date.now()) / 60000));
  const time = new Date(resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Resets at ${time}, in about ${mins} minute${mins === 1 ? '' : 's'}.`;
}

export function ErrorCard() {
  const error = useStore((s) => s.error);
  const bundled = useStore((s) => s.bundled);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);

  if (!error) return null;
  const dismiss = () => useStore.getState().set({ error: null });
  const reset = error.kind === 'rate_limited' ? resetText(error.resetAt) : null;

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
        <h2 id="error-title">{error.title}</h2>
        <p id="error-msg">{error.message}</p>
        {reset && <p className="mono error-card__reset">{reset}</p>}
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
          {error.kind === 'network' && error.repo && (
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => {
                dismiss();
                void openRepoInput(error.repo ?? '');
              }}
            >
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
