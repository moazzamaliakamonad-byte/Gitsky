import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clearSelection, selectFile } from '../state/selection';
import { inGalaxyView, useStore } from '../state/store';
import { formClock } from './formClock';
import { pickNearest } from './picking';
import { fileOrbitState } from './fileOrbitState';

const vp = new THREE.Matrix4();
const lastCam = new THREE.Matrix4();

/**
 * Pointer → star. We only remember where the pointer is on pointermove; the actual
 * pick runs once per frame in useFrame (at most 60×/s, however fast the mouse moves).
 * A click is a pointerup within 5 px and 400 ms of its pointerdown, so dragging to
 * rotate never selects anything.
 */
export function Picker() {
  const { gl, camera, size } = useThree();
  const pointer = useRef({ x: 0, y: 0, inside: false, dirty: false });
  const down = useRef({ x: 0, y: 0, t: 0 });
  const highlight = useStore((s) => s.highlight);
  const model = useStore((s) => s.model);
  const isTouch = useStore((s) => s.isTouch);

  // When a highlight is active, dimmed stars aren't pickable.
  const mask = useMemo(() => {
    if (!highlight || !model) return null;
    const m = new Uint8Array(model.data.files.length);
    for (const i of highlight.indices) m[i] = 1;
    return m;
  }, [highlight, model]);

  const pickAt = (x: number, y: number, radius: number) => {
    const { model: mdl } = useStore.getState();
    if (!mdl || formClock.value < 0.98 || !inGalaxyView(useStore.getState())) return -1;
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    return pickNearest(
      mdl.layout.positions,
      mdl.data.files.length,
      vp.elements,
      size.width,
      size.height,
      x,
      y,
      radius,
      mask ? (i) => mask[i] === 1 : undefined,
    );
  };
  const pickRef = useRef(pickAt);
  pickRef.current = pickAt;

  useEffect(() => {
    const el = gl.domElement;
    const local = (e: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      pointer.current = { ...p, inside: true, dirty: true };
      useStore.getState().set({ pointer: { x: e.clientX, y: e.clientY } });
    };
    const onLeave = () => {
      pointer.current.inside = false;
      pointer.current.dirty = true;
    };
    const onDown = (e: PointerEvent) => {
      const p = local(e);
      down.current = { ...p, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      const p = local(e);
      const moved = Math.hypot(p.x - down.current.x, p.y - down.current.y);
      if (moved > 5 || performance.now() - down.current.t > 400) return;
      if (fileOrbitState.hover >= 0) {
        useStore.getState().set({ symbol: fileOrbitState.hover });
        return;
      }
      const i = pickRef.current(p.x, p.y, e.pointerType === 'touch' ? 24 : 12);
      if (i >= 0) selectFile(i);
      else clearSelection();
    };
    const onDouble = (e: MouseEvent) => {
      const p = local(e);
      const i = pickRef.current(p.x, p.y, 14);
      if (i >= 0) selectFile(i, { fly: true });
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('dblclick', onDouble);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('dblclick', onDouble);
    };
  }, [gl]);

  useFrame(() => {
    // Inside a system SystemView picks; in a collision nothing is pickable.
    if (!inGalaxyView(useStore.getState())) {
      if (useStore.getState().hovered !== -1) useStore.getState().set({ hovered: -1 });
      return;
    }
    const p = pointer.current;
    // Re-pick when the pointer moved, or when the camera moved under a still pointer.
    const camMoved = !lastCam.equals(camera.matrixWorld);
    if (!p.dirty && !camMoved) return;
    lastCam.copy(camera.matrixWorld);
    p.dirty = false;
    // A planet of the selected file under the pointer wins over the stars behind it.
    const i = p.inside && !isTouch && fileOrbitState.hover < 0 ? pickAt(p.x, p.y, 12) : -1;
    if (i !== useStore.getState().hovered) useStore.getState().set({ hovered: i });
    gl.domElement.style.cursor = i >= 0 || fileOrbitState.hover >= 0 ? 'pointer' : '';
  });

  return null;
}
