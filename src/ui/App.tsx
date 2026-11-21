import { useEffect } from 'react';
import { GalaxyCanvas } from '../render/GalaxyCanvas';
import { boot } from '../state/actions';
import { useStore } from '../state/store';
import { ErrorCard } from './ErrorCard';
import { FolderLabels } from './FolderLabels';
import { Hero } from './Hero';
import { Hud } from './Hud';
import { Legend } from './Legend';
import { LoadingVeil } from './LoadingVeil';
import { Notice } from './Notice';
import { TokenDialog } from './TokenDialog';

export function App() {
  const heroOpen = useStore((s) => s.heroOpen);
  const panel = useStore((s) => s.panel);

  useEffect(() => {
    void boot();
  }, []);

  return (
    <div className="app">
      <GalaxyCanvas />
      <FolderLabels />
      {heroOpen ? <Hero /> : <Hud />}
      {!heroOpen && <Legend />}
      <LoadingVeil />
      <ErrorCard />
      <Notice />
      {panel === 'token' && <TokenDialog />}
    </div>
  );
}
