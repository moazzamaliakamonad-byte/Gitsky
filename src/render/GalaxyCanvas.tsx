import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { useStore } from '../state/store';
import { Background } from './Background';
import { Controls } from './Controls';
import { Effects } from './Effects';
import { FpsGovernor } from './fpsGovernor';
import { captureRef, composerRef } from './sceneRefs';
import { Starfield } from './Starfield';
import { Nebulae } from './Nebulae';
import { GalaxyHaze } from './GalaxyHaze';
import { StarGlow } from './StarGlow';
import { StarChart } from './StarChart';
import { LabelDriver } from './LabelDriver';
import { Picker } from './Picker';
import { Comets } from './Comets';
import { TimelineDriver } from './TimelineDriver';

const DPR_LEVELS = [1.5, 1.25, 1, 0.75];

/** Watches frame times and steps quality down when the GPU can't keep up. */
function Governor() {
  const qualityLocked = useStore((s) => s.qualityLocked);
  const startDpr = useMemo(() => useStore.getState().dpr, []);
  const gov = useMemo(
    () => new FpsGovernor({ dprLevels: DPR_LEVELS, startDpr, allowQualityDrop: !qualityLocked }),
    [qualityLocked, startDpr],
  );
  useFrame((_, dt) => {
    const a = gov.frame(dt * 1000);
    if (!a) return;
    const { set } = useStore.getState();
    if (a.kind === 'dpr') set({ dpr: a.dpr });
    else set({ quality: 'low', notice: 'Switched to Low quality to keep the sky smooth.' });
  });
  return null;
}

/** Registers a function that renders a frame on demand, for PNG export. */
function CaptureBridge() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureRef.current = () => {
      if (composerRef.current) composerRef.current.render(0);
      else gl.render(scene, camera);
      return gl.domElement;
    };
    return () => {
      captureRef.current = null;
    };
  }, [gl, scene, camera]);
  return null;
}

export function GalaxyCanvas() {
  const model = useStore((s) => s.model);
  const quality = useStore((s) => s.quality);
  const dpr = useStore((s) => s.dpr);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const label = model
    ? `3D galaxy of ${model.data.meta.fullName}: ${model.data.files.length.toLocaleString()} files as stars. Use the List view for an accessible table of the same data.`
    : 'A 3D galaxy is loading.';

  return (
    <div className="canvas-wrap" role="img" aria-label={label}>
      <Canvas
        linear
        flat
        dpr={dpr}
        gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
        camera={{ fov: 50, near: 0.5, far: 6000, position: [0, 120, 160] }}
      >
        <Background />
        {model && (
          <>
            <StarChart model={model} />
            <GalaxyHaze model={model} />
            <Nebulae model={model} />
            <StarGlow model={model} />
            <Starfield model={model} />
            {!reducedMotion && <Comets model={model} />}
          </>
        )}
        <Controls />
        {quality === 'high' && <Effects />}
        <TimelineDriver />
        <Picker />
        <LabelDriver />
        <Governor />
        <CaptureBridge />
      </Canvas>
    </div>
  );
}
