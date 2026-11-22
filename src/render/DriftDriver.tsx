import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { openBundled } from '../state/actions';
import { nextSky } from '../state/driftPlan';
import { useStore } from '../state/store';
import { controlsRef } from './sceneRefs';

/** Seconds on each featured sky before drifting on to the next. */
export const DRIFT_SKY_SECONDS = 75;
/** Let each new sky's intro flight land before taking the camera. */
const INTRO_WAIT = 4;

const sph = new THREE.Spherical();
const off = new THREE.Vector3();
const origin = new THREE.Vector3();

/**
 * The camera in drift mode: a slow orbit that breathes in and out (diving toward the
 * core, then pulling back to see the whole spiral) and rises and sinks over the disk.
 * Two slow sine waves with unrelated periods, so the path never quite repeats.
 */
export function DriftDriver() {
  const t = useRef(0);
  const onSky = useRef(0);
  const modelId = useRef(-1);
  const moving = useRef(false);
  const active = useRef(false);

  useFrame((state, dt) => {
    const s = useStore.getState();
    const controls = controlsRef.current;
    if (!s.drift || !controls || !s.model) {
      if (active.current && controls) controls.autoRotate = false;
      active.current = false;
      return;
    }
    active.current = true;
    const step = Math.min(dt, 0.05);
    if (s.modelId !== modelId.current) {
      modelId.current = s.modelId;
      onSky.current = 0;
      moving.current = false;
    }
    onSky.current += step;

    // On to the next featured sky.
    if (onSky.current > DRIFT_SKY_SECONDS && !moving.current && s.status === 'ready') {
      const next = nextSky(s.bundled, s.model.data.meta.fullName);
      if (next) {
        moving.current = true;
        void openBundled(next, { updateUrl: false });
      }
    }
    if (onSky.current < INTRO_WAIT) return;

    t.current += step;
    const slow = s.reducedMotion ? 0.4 : 1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.32 * slow;
    const ext = s.model.layout.extent;
    const k = t.current * slow;
    const wantR = ext * (1.3 + 0.6 * Math.sin(k * 0.045));
    const wantPhi = 1.0 + 0.3 * Math.sin(k * 0.029 + 1.3);
    off.copy(state.camera.position).sub(controls.target);
    sph.setFromVector3(off);
    sph.radius += (wantR - sph.radius) * Math.min(1, step * 0.25);
    sph.phi += (wantPhi - sph.phi) * Math.min(1, step * 0.2);
    controls.target.lerp(origin, Math.min(1, step * 0.3));
    off.setFromSpherical(sph);
    state.camera.position.copy(controls.target).add(off);
  });

  return null;
}
