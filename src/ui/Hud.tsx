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

/** Compact chrome once the hero is dismissed: brand, current repo, search, controls. */
export function Hud() {
  const model = useStore((s) => s.model);
  const quality = useStore((s) => s.quality);
  const hasToken = useStore((s) => s.hasToken);
  const meta = model?.data.meta;
  const spectrum = useMemo(() => (model ? spectrumOf(model.data.files) : []), [model]);

  const setQuality = (q: Quality) => useStore.getState().set({ quality: q, qualityLocked: true });

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
            </span>
          </div>
        )}
      </div>

      <div className="hud__center">
        <SearchBox />
      </div>

      <div className="hud__actions">
        <OpenRepo />
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
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => useStore.getState().set({ panel: 'token' })}
        >
          {hasToken ? 'Token added' : 'Add token'}
        </button>
      </div>
    </header>
  );
}
