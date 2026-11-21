import logoUrl from './logo.svg';
import { useStore, type Quality } from '../state/store';
import { RepoInput } from './RepoInput';
import { Spectrum } from './Spectrum';
import { spectrumOf } from '../layout/color';
import { useMemo } from 'react';
import { Wordmark } from './Wordmark';

/** Compact chrome once the hero is dismissed: brand, current repo, input, controls. */
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
          onClick={() => useStore.getState().set({ heroOpen: true })}
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
        <RepoInput size="compact" />
      </div>

      <div className="hud__actions">
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
