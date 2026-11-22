import { useMemo, useState } from 'react';
import { peopleOf } from '../layout/constellation';
import { authorColor } from '../render/cometMath';
import { showPerson } from '../state/people';
import { useStore } from '../state/store';

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** A GitHub avatar when the name is a login; the person's colour and initial otherwise. */
function Avatar({ name }: { name: string }) {
  const [broken, setBroken] = useState(false);
  const color = authorColor(name);
  if (!LOGIN.test(name) || broken)
    return (
      <span
        className="people__avatar people__avatar--initial"
        style={{ borderColor: color, color }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  return (
    <img
      className="people__avatar"
      style={{ borderColor: color }}
      src={`https://github.com/${name}.png?size=56`}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

/** Everyone in the sampled commits. Pick one to draw their constellation. */
export function PeoplePanel() {
  const model = useStore((s) => s.model);
  const person = useStore((s) => s.highlight?.person ?? null);
  const people = useMemo(() => (model ? peopleOf(model.data.commits) : []), [model]);
  if (!model) return null;
  const close = () => useStore.getState().set({ panel: 'none' });

  return (
    <aside className="people panel" aria-labelledby="people-title">
      <header className="insights__head">
        <h2 id="people-title">Constellations</h2>
        <button type="button" className="detail__close" aria-label="Close" onClick={close}>
          &times;
        </button>
      </header>
      {people.length === 0 ? (
        <p className="people__empty">No commits to trace in this sky.</p>
      ) : (
        <ul className="people__list">
          {people.map((p) => (
            <li key={p.name}>
              <button
                type="button"
                aria-pressed={person === p.name}
                onClick={() => showPerson(p.name)}
              >
                <Avatar name={p.name} />
                <span className="people__name mono">{p.name}</span>
                <span className="people__meta">
                  <span>
                    {p.commits} commit{p.commits === 1 ? '' : 's'}
                  </span>
                  <span>
                    {p.files.length} star{p.files.length === 1 ? '' : 's'}
                  </span>
                </span>
                <span
                  className="people__line"
                  style={{ background: authorColor(p.name) }}
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
