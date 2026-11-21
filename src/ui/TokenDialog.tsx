import { useEffect, useRef, useState, type FormEvent } from 'react';
import { clearToken, getToken, setToken } from '../data/token';
import { useStore } from '../state/store';

export function TokenDialog() {
  const [value, setValue] = useState('');
  const hasToken = useStore((s) => s.hasToken);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => useStore.getState().set({ panel: 'none' });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function save(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setToken(value);
    useStore.getState().set({
      hasToken: Boolean(getToken()),
      panel: 'none',
      notice: 'Token added. New skies will sample up to 300 commits.',
    });
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <form
        className="token-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        onSubmit={save}
      >
        <h2 id="token-title">Deeper history with a token</h2>
        <p>
          Without a token, GitHub allows 60 requests an hour, enough to trace about 25 commits per
          repo. A token raises that to 5,000, so Gitsky can trace up to 300.
        </p>
        <p className="token-dialog__privacy">
          Your token stays in this browser tab (sessionStorage) and is sent only to api.github.com.
          Gitsky has no server. Create a{' '}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
          >
            fine-grained token
          </a>{' '}
          with public repository read access and no other permissions.
        </p>
        <label htmlFor="token-input">Personal access token</label>
        <input
          id="token-input"
          ref={inputRef}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={hasToken ? 'A token is saved for this tab' : 'github_pat_…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="error-card__actions">
          <button type="submit" className="btn btn--accent" disabled={!value.trim()}>
            Save token
          </button>
          {hasToken && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                clearToken();
                useStore
                  .getState()
                  .set({ hasToken: false, panel: 'none', notice: 'Token removed.' });
              }}
            >
              Remove token
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={close}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
