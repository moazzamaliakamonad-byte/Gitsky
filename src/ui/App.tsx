import { useEffect } from 'react';
import { GalaxyCanvas } from '../render/GalaxyCanvas';
import { boot } from '../state/actions';
import { clearSelection, setHighlight } from '../state/selection';
import { useStore } from '../state/store';
import { DetailPanel } from './DetailPanel';
import { ErrorCard } from './ErrorCard';
import { FolderLabels } from './FolderLabels';
import { Hero } from './Hero';
import { Hud } from './Hud';
import { Legend } from './Legend';
import { LoadingVeil } from './LoadingVeil';
import { Notice } from './Notice';
import { Reticles } from './Reticles';
import { TokenDialog } from './TokenDialog';
import { Timeline } from './Timeline';
import { Tooltip } from './Tooltip';
import { InsightsPanel } from './InsightsPanel';
import { ListView } from './ListView';
import { HighlightChip } from './HighlightChip';

/** Escape peels back one layer at a time: dialog → selection → highlight → hero. */
function useEscape() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const s = useStore.getState();
      if (s.panel === 'list' || s.panel === 'token' || s.error) return; // dialogs handle Escape
      if (s.selection) clearSelection();
      else if (s.highlight) setHighlight(null);
      else if (s.panel === 'insights') s.set({ panel: 'none' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const heroOpen = useStore((s) => s.heroOpen);
  const panel = useStore((s) => s.panel);
  useEscape();

  useEffect(() => {
    void boot();
  }, []);

  return (
    <div className="app">
      <GalaxyCanvas />
      <FolderLabels />
      <Reticles />
      {heroOpen ? <Hero /> : <Hud />}
      {!heroOpen && panel !== 'insights' && <Legend />}
      {!heroOpen && panel === 'insights' && <InsightsPanel />}
      {!heroOpen && <HighlightChip />}
      {!heroOpen && <Timeline />}
      {!heroOpen && <DetailPanel />}
      <Tooltip />
      <LoadingVeil />
      <ErrorCard />
      <Notice />
      {panel === 'token' && <TokenDialog />}
      {panel === 'list' && <ListView />}
    </div>
  );
}
