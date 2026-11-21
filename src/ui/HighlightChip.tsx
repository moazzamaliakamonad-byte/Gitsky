import { setHighlight } from '../state/selection';
import { useStore } from '../state/store';

/** Says what the sky is currently emphasising (a language, an author), with a way out. */
export function HighlightChip() {
  const highlight = useStore((s) => s.highlight);
  if (!highlight || highlight.reason === 'search' || highlight.reason === 'folder') return null;
  return (
    <div className="hl-chip" role="status">
      <span>
        {highlight.label}: <span className="mono">{highlight.indices.length.toLocaleString()}</span>
      </span>
      <button type="button" aria-label="Clear highlight" onClick={() => setHighlight(null)}>
        &times;
      </button>
    </div>
  );
}
