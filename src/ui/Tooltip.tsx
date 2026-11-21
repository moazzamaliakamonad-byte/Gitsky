import { useLayoutEffect, useRef, useState } from 'react';
import { languageOf } from '../layout/color';
import { useStore } from '../state/store';
import { formatBytes, splitPath } from './format';

/** Hover card for a star: name, folder, language, size, and how busy it is. */
export function Tooltip() {
  const hovered = useStore((s) => s.hovered);
  const model = useStore((s) => s.model);
  const pointer = useStore((s) => s.pointer);
  useStore((s) => s.selection); // re-render when the selection changes
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState({ x: false, y: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFlip({
      x: pointer.x + 18 + r.width > window.innerWidth - 8,
      y: pointer.y + 18 + r.height > window.innerHeight - 8,
    });
  }, [pointer, hovered]);

  const selection = useStore.getState().selection;
  if (!model || hovered < 0 || hovered >= model.data.files.length) return null;
  // The selected star's details are already in the panel.
  if (selection?.kind === 'file' && selection.index === hovered) return null;
  const file = model.data.files[hovered];
  const { dir, name } = splitPath(file.path);
  const lang = languageOf(file.path);
  const touches = model.churn.counts[hovered];
  const sampled = model.data.commits.length;

  return (
    <div
      ref={ref}
      className="tooltip"
      role="tooltip"
      style={{
        left: pointer.x,
        top: pointer.y,
        transform: `translate(${flip.x ? 'calc(-100% - 16px)' : '16px'}, ${flip.y ? 'calc(-100% - 16px)' : '16px'})`,
      }}
    >
      <p className="tooltip__name mono">{name}</p>
      {dir && <p className="tooltip__dir mono">{dir}</p>}
      <p className="tooltip__meta">
        <span className="swatch" style={{ background: lang.color, color: lang.color }} />
        <span>{lang.name}</span>
        <span className="mono">{formatBytes(file.size)}</span>
      </p>
      {sampled > 0 && (
        <p className={`tooltip__churn ${touches > 0 ? 'is-hot' : ''}`}>
          {touches > 0
            ? `Changed in ${touches} of the last ${sampled} commits`
            : `Unchanged in the last ${sampled} commits`}
        </p>
      )}
    </div>
  );
}
