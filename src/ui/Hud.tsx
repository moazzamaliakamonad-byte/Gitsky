import { useEffect, useMemo, useRef, useState } from 'react';
import { spectrumOf } from '../layout/color';
import { openBundled } from '../state/actions';
import { endCollision, startCollision } from '../state/collisionActions';
import { useStore, type Quality } from '../state/store';
import logoUrl from './logo.svg';
import { RepoInput } from './RepoInput';
import { SearchBox } from './SearchBox';
import { Spectrum } from './Spectrum';
import { Wordmark } from './Wordmark';
import { Credit } from './Credit';
import { focusGalaxy } from './focus';
import { closeUniverse, openUniverse } from '../state/universeActions';
import { startTour } from '../state/tour';

const ICONS = {
  insights: 'M3.5 16.5v-5M8.5 16.5v-9M13.5 16.5V9.5M17 4.5l-4 3-3.5-2.5L3 9',
  list: 'M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01',
  open: 'M10 4.5v11M4.5 10h11',
  share: 'M10 12.5V3.5M6.5 7 10 3.5 13.5 7M4.5 11v4.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11',
  collide: 'M2.5 10a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0M8.5 10a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0',
  overview: 'M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4M10 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
  tour: 'M10 2.8a7.2 7.2 0 1 0 0.01 0M8.3 7v6l5-3z',
  universe:
    'M10 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 5.5a1.2 1.2 0 1 0 0.01 0M16 4.5a1.2 1.2 0 1 0 0.01 0M15.5 15.5a1.2 1.2 0 1 0 0.01 0M4.5 15a1.2 1.2 0 1 0 0.01 0M8.4 8.6 5 6.3M11.6 8.6 15 5.4M11.7 11.3l3 3.3M8.3 11.4 5.4 14',
};

/** A HUD button: icon always, text label on wide screens (aria-label keeps it named). */
function HudButton({
  icon,
  label,
  accent,
  ...props
}: {
  icon: keyof typeof ICONS;
  label: string;
  accent?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`btn ${accent ? 'btn--accent' : 'btn--ghost'} btn--hud`}
      aria-label={label}
      title={label}
      {...props}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d={ICONS[icon]} />
      </svg>
      <span className="btn__label">{label}</span>
    </button>
  );
}

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
      <HudButton
        icon="open"
        label="Open repo"
        aria-expanded={open}
        aria-controls="open-repo-pop"
        onClick={() => setOpen((o) => !o)}
      />
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

/** "Collide with another repo": pick the second galaxy. */
function Collide() {
  const [open, setOpen] = useState(false);
  const bundled = useStore((s) => s.bundled);
  const model = useStore((s) => s.model);
  const other = useStore((s) => s.collision);
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
  useEffect(() => setOpen(false), [other]);

  if (!model) return null;
  const me = model.data.meta.fullName;
  return (
    <div className="open-repo" ref={ref}>
      <HudButton
        icon="collide"
        label={other ? 'End collision' : 'Collide'}
        aria-pressed={Boolean(other)}
        aria-expanded={other ? undefined : open}
        aria-controls="collide-pop"
        onClick={() => (other ? endCollision() : setOpen((o) => !o))}
      />
      {open && !other && (
        <div className="open-repo__pop panel" id="collide-pop">
          <p className="open-repo__lead">
            Crash <span className="mono">{me}</span> into another repo and watch gravity do the
            rest.
          </p>
          <RepoInput
            size="compact"
            id="collide-input"
            cta="Collide"
            placeholder="owner/repo to collide with"
            autoFocus
            onSubmitValue={startCollision}
          />
          <p className="open-repo__hint">Or a bundled sky, which costs no API calls:</p>
          <ul className="open-repo__list">
            {bundled
              .filter((b) => b.fullName !== me)
              .map((b) => (
                <li key={b.fullName}>
                  <button type="button" onClick={() => void startCollision(b.fullName)}>
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
            <span>Quality</span>
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
            <span>GitHub token</span>
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
            <span>
              <kbd>Home</kbd> whole galaxy
            </span>
          </div>
          <Credit />
        </div>
      )}
    </div>
  );
}

/** Compact chrome once the hero is dismissed: brand, current repo, search, controls. */
export function Hud() {
  const inUniverse = useStore((s) => s.universe !== null);
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
            </span>
          </div>
        )}
      </div>

      <div className="hud__center">
        <SearchBox />
      </div>

      <div className="hud__actions">
        <HudButton icon="overview" label="Whole galaxy" onClick={focusGalaxy} />
        <HudButton icon="tour" label="Tour" onClick={startTour} />
        <HudButton
          icon="universe"
          label="Universe"
          aria-pressed={inUniverse}
          onClick={() => (inUniverse ? closeUniverse() : void openUniverse())}
        />
        <HudButton
          icon="insights"
          label="Insights"
          aria-pressed={panel === 'insights'}
          onClick={() => toggle('insights')}
        />
        <HudButton
          icon="list"
          label="List view"
          aria-pressed={panel === 'list'}
          onClick={() => toggle('list')}
        />
        <OpenRepo />
        <Collide />
        <HudButton
          icon="share"
          label="Share"
          accent
          onClick={() => useStore.getState().set({ panel: 'share' })}
        />
        <Settings />
      </div>
    </header>
  );
}
