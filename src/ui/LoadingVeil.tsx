import type { Progress } from '../data/types';
import { useStore } from '../state/store';

const STEPS: { label: string; steps: Progress['step'][] }[] = [
  { label: 'Checking for a saved copy', steps: ['cache', 'rate'] },
  { label: 'Finding the repo', steps: ['meta'] },
  { label: 'Reading recent commits', steps: ['commits'] },
  { label: 'Mapping every file', steps: ['tree'] },
  { label: 'Tracing what each commit touched', steps: ['details', 'done'] },
];

/**
 * The short "charting the sky…" moment: a checklist of the real steps, with the
 * commit-tracing step counting up. The previous sky keeps moving behind it.
 */
export function LoadingVeil() {
  const status = useStore((s) => s.status);
  const repo = useStore((s) => s.loadingRepo);
  const progress = useStore((s) => s.progress);
  // Bundled skies load in a blink and report no progress: no veil for them.
  if (status !== 'loading' || !progress) return null;

  const current = STEPS.findIndex((s) => s.steps.includes(progress.step));
  const tracing = progress.step === 'details' && progress.total ? progress : null;

  return (
    <div className="veil" role="status" aria-live="polite">
      <div className="veil__card">
        <p className="veil__title">Charting the sky&hellip;</p>
        {repo && <p className="veil__repo mono">{repo}</p>}
        <ol className="veil__steps">
          {STEPS.map((s, i) => (
            <li key={s.label} className={i < current ? 'is-done' : i === current ? 'is-now' : ''}>
              <span className="veil__mark" aria-hidden="true" />
              <span>
                {s.label}
                {i === current && tracing ? (
                  <span className="mono veil__count">
                    {' '}
                    {tracing.done}/{tracing.total}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
        {tracing && (
          <div className="veil__bar" aria-hidden="true">
            <span
              style={{
                width: `${Math.round(((tracing.done ?? 0) / (tracing.total ?? 1)) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
