import { useStore } from '../state/store';
import type { Progress } from '../data/types';

function describe(p: Progress | null): string {
  switch (p?.step) {
    case 'cache':
      return 'Checking for a saved copy';
    case 'rate':
      return 'Checking your GitHub allowance';
    case 'meta':
      return 'Finding the repo';
    case 'commits':
      return 'Reading recent commits';
    case 'tree':
      return 'Mapping every file';
    case 'details':
      return `Tracing commits ${p.done ?? 0} of ${p.total ?? 0}`;
    default:
      return 'Opening';
  }
}

/** The short "charting the sky…" moment. The previous sky keeps moving behind it. */
export function LoadingVeil() {
  const status = useStore((s) => s.status);
  const repo = useStore((s) => s.loadingRepo);
  const progress = useStore((s) => s.progress);
  // Bundled skies load in a blink and report no progress: no veil for them.
  if (status !== 'loading' || !progress) return null;

  const pct =
    progress?.step === 'details' && progress.total ? (progress.done ?? 0) / progress.total : null;

  return (
    <div className="veil" role="status" aria-live="polite">
      <div className="veil__card">
        <p className="veil__title">Charting the sky&hellip;</p>
        {repo && <p className="veil__repo mono">{repo}</p>}
        <p className="veil__step">{describe(progress)}</p>
        <div className="veil__bar" aria-hidden="true">
          <span
            style={pct === null ? undefined : { width: `${Math.round(pct * 100)}%` }}
            className={pct === null ? 'is-indeterminate' : ''}
          />
        </div>
      </div>
    </div>
  );
}
