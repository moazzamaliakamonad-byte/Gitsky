import { useEffect, useState } from 'react';
import { stopDrift } from '../state/drift';
import { useStore } from '../state/store';

/**
 * Drift mode's only interface: the name of the sky drifting past, and for the first few
 * seconds, how to get back. It also catches the click or key that ends drift mode.
 */
export function DriftOverlay() {
  const model = useStore((s) => s.model);
  const bundled = useStore((s) => s.bundled);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setHint(false), 3500);
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stopDrift();
    };
    // Esc in full screen leaves full screen without a key event reaching the page.
    const onFull = () => {
      if (!document.fullscreenElement) stopDrift();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey, { capture: true });
      document.removeEventListener('fullscreenchange', onFull);
    };
  }, []);

  const meta = model?.data.meta;
  const blurb = bundled.find((b) => b.fullName === meta?.fullName)?.blurb;

  return (
    <div className="drift" onPointerDown={stopDrift} role="presentation">
      <p className={`drift__hint${hint ? ' is-on' : ''}`}>Press any key to return</p>
      {meta && (
        <p className="drift__name" key={meta.fullName}>
          <span className="mono">{meta.fullName}</span>
          {blurb && <span className="drift__blurb">{blurb}</span>}
        </p>
      )}
    </div>
  );
}
