import { useEffect, useMemo, useRef, useState } from 'react';
import { spectrumOf } from '../layout/color';
import { openBundled } from '../state/actions';
import { useStore, type Quality } from '../state/store';
import logoUrl from './logo.svg';
import { RepoInput } from './RepoInput';
import { SearchBox } from './SearchBox';
import { Spectrum } from './Spectrum';
import { Wordmark } from './Wordmark';

/** "Open another repo": the paste field and the bundled skies, in a small popover. */
function OpenRepo() {
  const [open, setOpen] = useState(false);
  const bundled = useStore((s) => s.bundled);
  const model = useStore((s) => s.model);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Close once a new sky starts loading.
  useEffect(() => setOpen(false), [model]);

  return (
    <div className="open-repo" ref={ref}>
      <button
        type="button"
        className="btn btn--ghost"
        aria-expanded={open}
        aria-controls="open-repo-pop"
        onClick={() => setOpen((o) => !o)}
      >
        Open repo
      </button>
      {open && (
        <div className="open-repo__pop panel" id="open-repo-pop">
          <RepoInput size="compact" autoFocus />
          <p className="open-repo__hint">Or one of the bundled skies, which cost no API calls:</p>
          <ul className="open-repo__list">
            {bundled.map((b) => (
              <li key={b.fullName}>
                <button
                  type="button"
                  aria-pressed={model?.data.meta.fullName === b.fullName}
                  onClick={() => void openBundled(b)}
                >
                  <span className="mono">{b.fullName}</span>
                  <span className="open-repo__blurb">{b.blurb}</span>
                  {b.spectrum && <Spectrum parts={b.spectrum} className="open-repo__spectrum" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Render quality and the API token, tucked behind one button. */
function Settings() {
  const [open, setOpen] = useState(false);
  const quality = useStore((s) => s.quality);
  const hasToken = useStore((s) => s.hasToken);
  const dpr = useStore((s) => s.dpr);
  const ref = useRef<HTMLDivElement>(null);
  const setQuality = (q: Quality) => useStore.getState().set({ quality: q, qualityLocked: true });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="open-repo" ref={ref}>
      <button
        type="button"
        className="btn btn--ghost btn--icon"
        aria-label="Settings"
        aria-expanded={open}
        aria-controls="settings-pop"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="2.6" />
          <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" />
        </svg>
      </button>
      {open && (
        <div className="open-repo__pop settings panel" id="settings-pop">
          <div className="settings__row">
            <span>
              Render quality
              <span className="settings__hint">
                High adds bloom. Gitsky lowers it on its own if frames drop. Now at {dpr}× pixel
                density.
              </span>
            </span>
            <div className="segmented" role="group" aria-label="Render quality">
              {(['low', 'high'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  aria-pressed={quality === q}
                  onClick={() => setQuality(q)}
                >
                  {q === 'low' ? 'Low' : 'High'}
                </button>
              ))}
            </div>
          </div>
          <div className="settings__row">
            <span>
              GitHub token
              <span className="settings__hint">
                {hasToken
                  ? 'Added for this tab: up to 300 commits per repo.'
                  : 'Optional. Raises the limit from 60 to 5,000 requests an hour.'}
              </span>
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => useStore.getState().set({ panel: 'token' })}
            >
              {hasToken ? 'Manage' : 'Add token'}
            </button>
          </div>
          <div className="settings__keys">
            <span>
              <kbd>/</kbd> search
            </span>
            <span>
              <kbd>Esc</kbd> back
            </span>
            <span>Drag to orbit, scroll to zoom, double-click a star to fly to it</span>
          </div>
        </div>
      )}
    </div>
  );
}

const SOURCE_LABEL = {
  bundled: 'Bundled snapshot',
  network: 'Live from GitHub',
  cache: 'Saved copy, under an hour old',
  'stale-cache': 'Saved copy (GitHub unreachable)',
} as const;

/** Compact chrome once the hero is dismissed: brand, current repo, search, controls. */
export function Hud() {
  const model = useStore((s) => s.model);
  const panel = useStore((s) => s.panel);
  const toggle = (p: 'insights' | 'list') =>
    useStore.getState().set({ panel: panel === p ? 'none' : p });
  const meta = model?.data.meta;
  const spectrum = useMemo(() => (model ? spectrumOf(model.data.files) : []), [model]);

  return (
    <header className="hud">
      <div className="hud__brand">
        <button
          type="button"
          className="brand"
          onClick={() => useStore.getState().set({ heroOpen: true, selection: null })}
          aria-label="Gitsky home"
        >
          <img src={logoUrl} alt="" width={28} height={28} />
          <Wordmark as="span" />
        </button>
        {meta && model && (
          <div className="repo-tag">
            <a className="repo-tag__name mono" href={meta.htmlUrl} target="_blank" rel="noreferrer">
              {meta.fullName}
            </a>
            <Spectrum parts={spectrum} className="repo-tag__spectrum" />
            <span className="repo-tag__stats">
              <span>{model.data.files.length.toLocaleString()} files</span>
              <span>{meta.stars.toLocaleString()} stars on GitHub</span>
              <span title={`Fetched ${new Date(model.data.fetchedAt).toLocaleString()}`}>
                {SOURCE_LABEL[model.source]}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="hud__center">
        <SearchBox />
      </div>

      <div className="hud__actions">
        <button
          type="button"
          className="btn btn--ghost"
          aria-pressed={panel === 'insights'}
          onClick={() => toggle('insights')}
        >
          Insights
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          aria-pressed={panel === 'list'}
          onClick={() => toggle('list')}
        >
          List view
        </button>
        <OpenRepo />
        <Settings />
      </div>
    </header>
  );
}
