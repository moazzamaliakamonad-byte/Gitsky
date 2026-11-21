import { useEffect, useRef } from 'react';
import { anchors } from '../render/anchors';
import { useStore } from '../state/store';

function starPos(index: number): [number, number, number] | null {
  const { model } = useStore.getState();
  if (!model || index < 0 || index >= model.data.files.length) return null;
  const p = model.layout.positions;
  return [p[index * 3], p[index * 3 + 1], p[index * 3 + 2]];
}

/**
 * Targeting brackets around the hovered star (thin, white) and the selected one
 * (amber, slowly rotating). Positioned every frame by the canvas via `anchors`.
 */
export function Reticles() {
  const hoverEl = useRef<HTMLDivElement>(null);
  const selectEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hoverEl.current) {
      anchors.set('hover', {
        el: hoverEl.current,
        pos: () => {
          const { hovered, selection } = useStore.getState();
          if (selection?.kind === 'file' && selection.index === hovered) return null;
          return starPos(hovered);
        },
      });
    }
    if (selectEl.current) {
      anchors.set('select', {
        el: selectEl.current,
        pos: () => {
          const { selection } = useStore.getState();
          return selection?.kind === 'file' ? starPos(selection.index) : null;
        },
      });
    }
    return () => {
      anchors.delete('hover');
      anchors.delete('select');
    };
  }, []);

  return (
    <div className="reticles" aria-hidden="true">
      <div ref={hoverEl} className="reticle reticle--hover">
        <span />
      </div>
      <div ref={selectEl} className="reticle reticle--select">
        <span />
      </div>
    </div>
  );
}
