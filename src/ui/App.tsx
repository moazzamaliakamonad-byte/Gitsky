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
import { ShareDialog } from './ShareDialog';
import { SystemHud, SystemLabels, WarpFlash } from './SystemUi';
import { warpUp } from '../state/systemActions';

/** Escape peels back one layer at a time: dialog → selection → highlight → hero. */
function useEscape() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const s = useStore.getState();
      if (s.panel === 'list' || s.panel === 'token' || s.panel === 'share' || s.error) return; // dialogs handle Escape
      if (s.selection) clearSelection();
      else if (s.highlight) setHighlight(null);
      else if (s.panel === 'insights') s.set({ panel: 'none' });
      else if (s.system !== null) warpUp();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const heroOpen = useStore((s) => s.heroOpen);
  const panel = useStore((s) => s.panel);
  const inSystem = useStore((s) => s.system !== null);
  const warping = useStore((s) => s.warping);
  useEscape();

  useEffect(() => {
    void boot();
  }, []);

  return (
    <div className="app">
      <a
        href="#list"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          useStore.getState().set({ heroOpen: false, panel: 'list' });
        }}
      >
        Skip to the file list
      </a>
      <GalaxyCanvas />
      {!inSystem && <FolderLabels />}
      {!inSystem && <Reticles />}
      <SystemLabels />
      {heroOpen ? <Hero /> : <Hud />}
      {!heroOpen && !inSystem && panel !== 'insights' && <Legend />}
      {!heroOpen && panel === 'insights' && <InsightsPanel />}
      {!heroOpen && !inSystem && <HighlightChip />}
      {!heroOpen && !inSystem && !warping && <Timeline />}
      {!heroOpen && inSystem && !warping && <SystemHud />}
      {!heroOpen && <DetailPanel />}
      <Tooltip />
      <WarpFlash />
      <LoadingVeil />
      <ErrorCard />
      <Notice />
      {panel === 'token' && <TokenDialog />}
      {panel === 'list' && <ListView />}
      {panel === 'share' && <ShareDialog />}
    </div>
  );
}
