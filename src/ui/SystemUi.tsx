import { useEffect, useMemo, useRef } from 'react';
import { systemLabelEls } from '../render/systemLabels';
import { systemFor } from '../render/systemRuntime';
import { warp } from '../render/warp';
import { selectFolder } from '../state/selection';
import { enterSystem, exitSystem, warpUp } from '../state/systemActions';
import { useStore } from '../state/store';
import { formatBytes } from '../layout/size';

/** Registers a label element under a key so SystemView can position it every frame. */
function useLabel(key: string) {
  return (el: HTMLElement | null) => {
    if (el) systemLabelEls.set(key, el);
    else systemLabelEls.delete(key);
  };
}

function GiantLabel({ folder, name, files }: { folder: number; name: string; files: number }) {
  const ref = useLabel(`g${folder}`);
  return (
    <button
      ref={ref}
      type="button"
      className="sys-label sys-label--giant"
      onClick={() => enterSystem(folder)}
      title={`Warp into ${name}/`}
    >
      <span className="sys-label__name mono">{name}/</span>
      <span className="sys-label__count mono">{files.toLocaleString()}</span>
    </button>
  );
}

/** Names floating over the sun and the gas giants. Giants are buttons: warp deeper. */
export function SystemLabels() {
  const model = useStore((s) => s.model);
  const system = useStore((s) => s.system);
  const sunRef = useLabel('sun');
  if (!model || system === null) return null;
  const sys = systemFor(model, system);
  const folders = model.layout.tree.folders;
  const f = folders[system];
  return (
    <div className="sys-labels" aria-hidden={false}>
      <button
        ref={sunRef}
        type="button"
        className="sys-label sys-label--sun"
        onClick={() => selectFolder(system, { fly: false })}
      >
        <span className="sys-label__name mono">{f.name}/</span>
        <span className="sys-label__count mono">{formatBytes(f.totalBytes)}</span>
      </button>
      {sys.giants.map((g) => (
        <GiantLabel
          key={g.folder}
          folder={g.folder}
          name={folders[g.folder].name}
          files={folders[g.folder].totalFiles}
        />
      ))}
    </div>
  );
}

/** The panel that replaces the timeline inside a system: where you are, and the way out. */
export function SystemHud() {
  const model = useStore((s) => s.model);
  const system = useStore((s) => s.system);
  const sys = useMemo(
    () => (model && system !== null ? systemFor(model, system) : null),
    [model, system],
  );
  if (!model || system === null || !sys) return null;
  const folders = model.layout.tree.folders;
  const f = folders[system];
  const parent = f.parent > 0 ? folders[f.parent] : null;
  const parts = [
    sys.planets.length === 0
      ? 'No files sit directly in this folder, so the sun has no planets'
      : `${sys.planets.length} ${sys.planets.length === 1 ? 'file orbits' : 'files orbit'} the sun`,
    sys.giants.length > 0 &&
      `${sys.giants.length} sub-folder${sys.giants.length === 1 ? ' is a gas giant' : 's are gas giants'}`,
    sys.belt && `${sys.belt.files.length.toLocaleString()} more files form the asteroid belt`,
    sys.hiddenFolders > 0 && `${sys.hiddenFolders} smaller sub-folders aren't drawn`,
  ].filter(Boolean);

  return (
    <section className="system-hud panel" aria-label={`Solar system of ${f.path}/`}>
      <div className="system-hud__head">
        <h2 className="system-hud__title mono">{f.path}/</h2>
        <div className="system-hud__actions">
          {parent && (
            <button type="button" className="btn btn--ghost" onClick={warpUp}>
              Up to {parent.name}/
            </button>
          )}
          <button type="button" className="btn btn--accent" onClick={exitSystem}>
            Back to galaxy
          </button>
        </div>
      </div>
      <p className="system-hud__facts">{parts.join('. ')}.</p>
      <p className="system-hud__key">
        Planet size is bytes and colour is language. The most-changed files orbit closest and busy
        files glow on their night side. Click a gas giant to warp into it.
      </p>
    </section>
  );
}

/** The white-out that hides the switch between views, driven straight from warp state. */
export function WarpFlash() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const o = warp.flash.toFixed(3);
        if (el.style.opacity !== o) el.style.opacity = o;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="warp-flash" aria-hidden="true" />;
}
