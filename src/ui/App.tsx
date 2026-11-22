import { DeepTimePanel } from './DeepTimePanel';
import { closeDeepTime } from '../state/deepActions';
import { PeoplePanel } from './PeoplePanel';
import { constellationLabel } from '../render/constellationLabel';
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
import { CollisionHud, CollisionLabels } from './CollisionUi';
import { CodePanel, NearLabels, OrbitLabels } from './CodePanel';
import { ViewportFrame } from './ViewportFrame';
import { TourCaption } from './TourCaption';
import { UniverseHud, UniverseLabels } from './UniverseUi';
import { closeUniverse } from '../state/universeActions';
import { watchSelection } from '../state/contentActions';
import { warpUp } from '../state/systemActions';
import { endCollision } from '../state/collisionActions';
import { focusGalaxy } from './focus';
import { DriftOverlay } from './DriftOverlay';
import { startDrift } from '../state/drift';

/** Escape peels back one layer at a time: dialog → selection → highlight → hero. */
function useEscape() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === 'Home' && !typing && !e.defaultPrevented) {
        e.preventDefault();
        focusGalaxy();
        return;
      }
      if (
        (e.key === 'd' || e.key === 'D') &&
        !typing &&
        !e.defaultPrevented &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        useStore.getState().model
      ) {
        e.preventDefault();
        startDrift();
        return;
      }
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const s = useStore.getState();
      if (s.panel === 'list' || s.panel === 'token' || s.panel === 'share' || s.error) return; // dialogs handle Escape
      if (s.selection) clearSelection();
      else if (s.highlight) setHighlight(null);
      else if (s.panel === 'insights' || s.panel === 'people') s.set({ panel: 'none' });
      else if (s.deep) closeDeepTime();
      else if (s.universe) closeUniverse();
      else if (s.system !== null) warpUp();
      else if (s.collision) endCollision();
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
  const colliding = useStore((s) => s.collision !== null);
  const inUniverse = useStore((s) => s.universe !== null);
  const galaxyUi = !inSystem && !colliding && !inUniverse;
  const hasContent = useStore((s) => s.content !== null);
  const drift = useStore((s) => s.drift);
  const deep = useStore((s) => s.deep !== null);
  useEscape();

  useEffect(() => {
    void boot();
  }, []);
  useEffect(() => watchSelection(), []);

  return (
    <div className={`app${drift ? ' app--drift' : ''}${deep ? ' app--deep' : ''}`}>
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
      {galaxyUi && <FolderLabels />}
      {galaxyUi && <Reticles />}
      <CollisionLabels />
      <SystemLabels />
      <ViewportFrame />
      {heroOpen ? <Hero /> : <Hud />}
      {!heroOpen && galaxyUi && panel !== 'insights' && panel !== 'people' && !hasContent && (
        <Legend />
      )}
      {!heroOpen && galaxyUi && panel !== 'insights' && hasContent && <CodePanel />}
      {galaxyUi && <OrbitLabels />}
      {galaxyUi && <NearLabels />}
      {!heroOpen && panel === 'insights' && <InsightsPanel />}
      {!heroOpen && galaxyUi && panel === 'people' && <PeoplePanel />}
      {galaxyUi && (
        <span
          className="constellation-name mono"
          aria-hidden="true"
          ref={(el) => {
            constellationLabel.el = el;
          }}
        />
      )}
      {!heroOpen && galaxyUi && <HighlightChip />}
      {!heroOpen && galaxyUi && !warping && (deep ? <DeepTimePanel /> : <Timeline />)}
      {!heroOpen && colliding && <CollisionHud />}
      {!heroOpen && inUniverse && <UniverseHud />}
      <UniverseLabels />
      {!heroOpen && inSystem && !warping && <SystemHud />}
      {!heroOpen && !colliding && !inUniverse && <DetailPanel />}
      <Tooltip />
      <WarpFlash />
      {!heroOpen && <TourCaption />}
      <LoadingVeil />
      <ErrorCard />
      <Notice />
      {panel === 'token' && <TokenDialog />}
      {panel === 'list' && <ListView />}
      {panel === 'share' && <ShareDialog />}
      {drift && <DriftOverlay />}
    </div>
  );
}
