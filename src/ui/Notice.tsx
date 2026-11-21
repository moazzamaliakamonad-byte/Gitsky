import { useEffect } from 'react';
import { useStore } from '../state/store';

/** A quiet one-line toast for things worth knowing but not worth interrupting for. */
export function Notice() {
  const notice = useStore((s) => s.notice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useStore.getState().set({ notice: null }), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div className="notice-slot" role="status" aria-live="polite">
      {notice && (
        <div className="notice">
          <span>{notice}</span>
          <button
            type="button"
            className="notice__close"
            aria-label="Dismiss"
            onClick={() => useStore.getState().set({ notice: null })}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
