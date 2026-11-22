import { useEffect, useRef } from 'react';
import { controlsRef } from '../render/sceneRefs';
import { useStore } from '../state/store';

const DEG = 180 / Math.PI;

/**
 * Where a point is: the folder of the selected file, else the folder of the star
 * nearest the point (within reach), `/` near the galactic core, or open space.
 */
function sectorAt(x: number, y: number, z: number): string {
  const { model, selection } = useStore.getState();
  if (!model) return '';
  const { tree, positions } = model.layout;
  const folderOf = (file: number) => {
    const f = tree.fileFolder[file];
    return f > 0 ? `${tree.folders[f].path}/` : '/';
  };
  if (selection?.kind === 'file') return folderOf(selection.index);
  if (selection?.kind === 'folder') return `${tree.folders[selection.index].path}/`;
  let best = -1;
  let bestD = 64; // within 8 units
  for (let i = 0; i < model.data.files.length; i++) {
    const d =
      (positions[i * 3] - x) ** 2 +
      (positions[i * 3 + 1] - y) ** 2 +
      (positions[i * 3 + 2] - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best >= 0) return folderOf(best);
  return Math.hypot(x, y, z) < 12 ? '/  (core)' : 'open space';
}

/**
 * The viewfinder around the sky: corner brackets, edge rulers, and a telemetry readout
 * of real values: the sector (nearest folder to where you're looking), range from the
 * galactic core, heading and elevation of the camera, and frame rate. Pointer-transparent.
 */
export function ViewportFrame() {
  const heroOpen = useStore((st) => st.heroOpen);
  // The detail panel fills the right edge; the readout steps aside while it's open.
  const panelOpen = useStore((st) => st.selection !== null && !st.universe);
  const sector = useRef<HTMLSpanElement>(null);
  const range = useRef<HTMLSpanElement>(null);
  const heading = useRef<HTMLSpanElement>(null);
  const fps = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastSector = 0;
    let frames = 0;
    let lastFps = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      frames++;
      const controls = controlsRef.current;
      const s = useStore.getState();
      if (!controls || !s.model) return;
      const cam = controls.object.position;
      const t = controls.target;
      const dx = cam.x - t.x;
      const dy = cam.y - t.y;
      const dz = cam.z - t.z;
      const az = (Math.atan2(dx, dz) * DEG + 360) % 360;
      const el = Math.atan2(dy, Math.hypot(dx, dz)) * DEG;
      if (heading.current)
        heading.current.textContent = `HDG ${az.toFixed(0).padStart(3, '0')}°  ELV ${el >= 0 ? '+' : '−'}${Math.abs(el).toFixed(0).padStart(2, '0')}°`;
      if (range.current)
        range.current.textContent = `RNG ${Math.hypot(cam.x, cam.y, cam.z).toFixed(1)} u`;
      if (now - lastSector > 250 && sector.current) {
        lastSector = now;
        const mode = s.universe
          ? `UNIVERSE  ${s.universe.label}`
          : s.collision
            ? `COLLISION  ${s.collision.data.meta.fullName}`
            : s.system !== null
              ? `SYSTEM  ${s.model.layout.tree.folders[s.system].path}/`
              : `SECTOR  ${sectorAt(t.x, t.y, t.z)}`;
        sector.current.textContent = mode;
        sector.current.title = mode;
      }
      if (now - lastFps > 1000 && fps.current) {
        fps.current.textContent = `FPS ${Math.round((frames * 1000) / (now - lastFps))}  DPR ${s.dpr.toFixed(2)}`;
        frames = 0;
        lastFps = now;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`viewfinder${heroOpen ? ' is-hero' : ''}${panelOpen ? ' is-panel' : ''}`}
      aria-hidden="true"
    >
      <span className="viewfinder__corner viewfinder__corner--tl" />
      <span className="viewfinder__corner viewfinder__corner--tr" />
      <span className="viewfinder__corner viewfinder__corner--bl" />
      <span className="viewfinder__corner viewfinder__corner--br" />
      <span className="viewfinder__ruler viewfinder__ruler--l" />
      <span className="viewfinder__ruler viewfinder__ruler--r" />
      <div className="telemetry mono">
        <span ref={sector} className="telemetry__sector" />
        <span ref={range} />
        <span ref={heading} />
        <span ref={fps} />
      </div>
    </div>
  );
}
