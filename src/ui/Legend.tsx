import { useState } from 'react';
import { useStore } from '../state/store';

export function Legend() {
  const model = useStore((s) => s.model);
  const [open, setOpen] = useState(true);
  if (!model) return null;

  return (
    <aside className={`legend panel ${open ? '' : 'is-collapsed'}`} aria-label="Colour legend">
      <button
        type="button"
        className="panel__toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Star colours
      </button>
      {open && (
        <ul className="legend__list">
          {model.legend.map((l) => (
            <li key={l.id}>
              <span className="swatch" style={{ background: l.color, color: l.color }} />
              <span className="legend__name">{l.name}</span>
              <span className="legend__count mono">{l.count.toLocaleString()}</span>
            </li>
          ))}
          <li className="legend__note">
            Size is file size in bytes. Brightness is how often a file changed in the sampled
            commits.
            {model.supernova && ' The most-changed file goes supernova during playback.'}
          </li>
        </ul>
      )}
    </aside>
  );
}
