import { useMemo } from 'react';
import { colorForLanguageName } from '../layout/color';
import { universeLabels } from '../render/universeLabels';
import { chartGalaxy, closeUniverse, expandFocus, toggleLanguage } from '../state/universeActions';
import { useStore } from '../state/store';
import { relativeTime } from './format';

const fmt = (n: number) =>
  n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString();

function focusOn(kind: 'galaxy' | 'person', index: number) {
  const u = useStore.getState().universe;
  if (u) useStore.getState().set({ universe: { ...u, focus: { kind, index } } });
}

/** Names floating on the galaxies and people. Each is a button that focuses its object. */
export function UniverseLabels() {
  const data = useStore((s) => s.universe?.data);
  if (!data) return null;
  return (
    <div className="sys-labels">
      {data.galaxies.map((g, i) => (
        <button
          key={g.key}
          type="button"
          className={`u-label u-label--galaxy${g.home ? ' is-home' : ''}`}
          ref={(el) => {
            if (el) universeLabels.galaxies[i] = el;
          }}
          onClick={() => focusOn('galaxy', i)}
        >
          <span className="mono">{g.fullName}</span>
          <span className="u-label__stars mono">★ {fmt(g.stars)}</span>
        </button>
      ))}
      {data.people.map((p, i) => (
        <button
          key={p.key}
          type="button"
          className={`u-label u-label--person${p.bridge ? ' is-bridge' : ''}`}
          ref={(el) => {
            if (el) universeLabels.people[i] = el;
          }}
          onClick={() => focusOn('person', i)}
        >
          <img
            src={`${p.avatar}${p.avatar.includes('?') ? '&' : '?'}s=40`}
            alt=""
            width={18}
            height={18}
            loading="lazy"
          />
          <span className="mono">{p.login}</span>
        </button>
      ))}
    </div>
  );
}

/** Languages present in the universe, most common first (for the filter chips). */
function useLanguages() {
  const data = useStore((s) => s.universe?.data);
  return useMemo(() => {
    const count = new Map<string, number>();
    for (const g of data?.galaxies ?? [])
      if (g.language) count.set(g.language, (count.get(g.language) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [data]);
}

/** The panel at the bottom of the universe: what you're looking at and what you can do. */
export function UniverseHud() {
  const u = useStore((s) => s.universe);
  const langs = useLanguages();
  if (!u) return null;

  if (u.status === 'loading') {
    return (
      <section className="universe-hud panel" aria-live="polite">
        <p className="universe-hud__title">Mapping the universe around {u.label}…</p>
        <div className="universe-hud__bar">
          <span style={{ transform: `scaleX(${u.total ? u.done / u.total : 0.05})` }} />
        </div>
        <div className="universe-hud__actions">
          <button type="button" className="btn btn--ghost" onClick={closeUniverse}>
            Cancel
          </button>
        </div>
      </section>
    );
  }

  const data = u.data!;
  const f = u.focus;
  const g = f?.kind === 'galaxy' ? data.galaxies[f.index] : null;
  const p = f?.kind === 'person' ? data.people[f.index] : null;
  const owned = p ? data.links.filter((l) => l.kind === 'owns' && l.person === f!.index).length : 0;
  const works = p
    ? data.links
        .filter((l) => l.kind === 'contributes' && l.person === f!.index)
        .map((l) => data.galaxies[l.galaxy].fullName)
    : [];
  const canExpand = g ? !g.expanded : p ? !p.expanded : false;

  return (
    <section className="universe-hud panel" aria-label="Universe">
      <div className="universe-hud__head">
        <p className="universe-hud__title">
          The universe around <span className="mono">{u.label}</span>
        </p>
        <button type="button" className="btn btn--accent" onClick={closeUniverse}>
          Back to the galaxy
        </button>
      </div>
      {(u.missing ?? 0) > 0 && (
        <p className="universe-hud__warn" role="status">
          Some of this universe couldn’t load
          {u.resetAt
            ? `. Try again after ${new Date(u.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
            : '.'}
        </p>
      )}
      {langs.length > 1 && (
        <div className="universe-hud__langs" role="group" aria-label="Show only these languages">
          {langs.map(([lang, n]) => (
            <button
              key={lang}
              type="button"
              className="lang-chip"
              aria-pressed={u.languages?.includes(lang) ?? false}
              onClick={() => toggleLanguage(lang)}
            >
              <span className="swatch" style={{ background: colorForLanguageName(lang) }} />
              {lang}
              <span className="lang-chip__n mono">{n}</span>
            </button>
          ))}
        </div>
      )}

      {g && (
        <div className="universe-card">
          <span className="swatch" style={{ background: colorForLanguageName(g.language) }} />
          <div className="universe-card__body">
            <p className="universe-card__name mono">{g.fullName}</p>
            <p className="universe-card__meta">
              ★ {g.stars.toLocaleString()}
              {g.language ? ` · ${g.language}` : ''}
              {g.pushedAt ? ` · pushed ${relativeTime(new Date(g.pushedAt).toISOString())}` : ''}
            </p>
            {g.description && <p className="universe-card__desc">{g.description}</p>}
          </div>
          <div className="universe-card__actions">
            {canExpand && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={u.busy}
                onClick={() => void expandFocus()}
              >
                {u.busy ? `Expanding ${u.done}/${u.total}` : 'Who builds it?'}
              </button>
            )}
            {!g.home && (
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => void chartGalaxy(g.fullName)}
              >
                Chart it
              </button>
            )}
            <a
              className="btn btn--ghost"
              href={`https://github.com/${g.fullName}`}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      )}
      {p && (
        <div className="universe-card">
          <img
            className="universe-card__avatar"
            src={`${p.avatar}${p.avatar.includes('?') ? '&' : '?'}s=80`}
            alt=""
            width={36}
            height={36}
          />
          <div className="universe-card__body">
            <p className="universe-card__name mono">
              {p.login}
              {p.bridge && <span className="bridge-tag">bridge</span>}
            </p>
            <p className="universe-card__meta">
              {p.contributions > 0 ? `${p.contributions.toLocaleString()} commits to ` : 'Builds '}
              {works.slice(0, 3).join(', ') || `${owned} projects of their own`}
              {works.length > 3 ? ` and ${works.length - 3} more` : ''}
            </p>
          </div>
          <div className="universe-card__actions">
            {canExpand && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={u.busy}
                onClick={() => void expandFocus()}
              >
                {u.busy ? `Expanding ${u.done}/${u.total}` : 'Their projects'}
              </button>
            )}
            <a
              className="btn btn--ghost"
              href={`https://github.com/${p.login}`}
              target="_blank"
              rel="noreferrer"
            >
              Profile
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
