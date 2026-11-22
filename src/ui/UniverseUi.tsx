import { colorForLanguageName } from '../layout/color';
import { universeLabels } from '../render/universeLabels';
import { chartGalaxy, closeUniverse } from '../state/universeActions';
import { useStore } from '../state/store';

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
          key={g.fullName}
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
          key={p.login}
          type="button"
          className="u-label u-label--person"
          ref={(el) => {
            if (el) universeLabels.people[i] = el;
          }}
          onClick={() => focusOn('person', i)}
        >
          <img src={`${p.avatar}&s=40`} alt="" width={18} height={18} loading="lazy" />
          <span className="mono">{p.login}</span>
        </button>
      ))}
    </div>
  );
}

/** The panel at the bottom of the universe: what you're looking at and what you can do. */
export function UniverseHud() {
  const model = useStore((s) => s.model);
  const u = useStore((s) => s.universe);
  if (!model || !u) return null;
  const home = model.data.meta.fullName;

  if (u.status === 'loading') {
    return (
      <section className="universe-hud panel" aria-live="polite">
        <p className="universe-hud__title">Mapping the universe around {home}…</p>
        <p className="universe-hud__facts">
          {u.total > 0
            ? `Asked GitHub about ${u.done} of ${u.total}: the people who build it and what else they build.`
            : 'Finding the people who build it.'}
        </p>
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
  const owned = p ? data.galaxies.filter((x) => x.owner === f!.index) : [];

  return (
    <section className="universe-hud panel" aria-label="Universe">
      <div className="universe-hud__head">
        <p className="universe-hud__title">
          The universe around <span className="mono">{home}</span>
        </p>
        <button type="button" className="btn btn--accent" onClick={closeUniverse}>
          Back to the galaxy
        </button>
      </div>
      <p className="universe-hud__facts">
        {data.people.length === 0
          ? 'No other contributors to follow yet, so this galaxy is alone in its universe.'
          : `${data.people.length} of its top contributors, and ${data.galaxies.length - 1} other projects they build. Galaxy size is GitHub stars; colour is the main language; filaments are who connects them.`}
      </p>

      {g && (
        <div className="universe-card">
          <span className="swatch" style={{ background: colorForLanguageName(g.language) }} />
          <div className="universe-card__body">
            <p className="universe-card__name mono">{g.fullName}</p>
            <p className="universe-card__meta">
              ★ {g.stars.toLocaleString()}
              {g.language ? ` · ${g.language}` : ''}
              {!g.home && g.owner >= 0 ? ` · by ${data.people[g.owner].login}` : ''}
            </p>
            {g.description && <p className="universe-card__desc">{g.description}</p>}
          </div>
          <div className="universe-card__actions">
            {!g.home && (
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => void chartGalaxy(g.fullName)}
              >
                Chart this galaxy
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
            src={`${p.avatar}&s=80`}
            alt=""
            width={36}
            height={36}
          />
          <div className="universe-card__body">
            <p className="universe-card__name mono">{p.login}</p>
            <p className="universe-card__meta">
              {p.contributions.toLocaleString()} commits to {home}
              {owned.length ? ` · ${owned.length} projects of their own here` : ''}
            </p>
          </div>
          <div className="universe-card__actions">
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
