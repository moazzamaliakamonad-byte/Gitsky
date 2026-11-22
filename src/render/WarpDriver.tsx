import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../state/store';
import { controlsRef } from './sceneRefs';
import { systemFor } from './systemRuntime';
import { ACCEL, ARRIVE, warp } from './warp';

const BASE_FOV = 50;
const WARP_FOV = 96;
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const tmp = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Framing for a folder's cluster in the galaxy (matches ui/focus.ts). */
function galaxyFraming(folder: number): { target: THREE.Vector3; dist: number } {
  const model = useStore.getState().model!;
  const c = model.layout.folderCenters;
  const f = model.layout.tree.folders[folder];
  const size = model.layout.folderRadii[folder] * 2 + Math.pow(f.totalFiles, 0.4) * 2.2;
  return {
    target: new THREE.Vector3(c[folder * 3], c[folder * 3 + 1], c[folder * 3 + 2]),
    dist: Math.max(14, size * 2.4),
  };
}

/**
 * Drives the camera through a warp (see warp.ts): accelerate with a widening field of
 * view, switch views under the flash, then decelerate into the new view. Orbit controls
 * are switched off for the duration and re-aimed on arrival.
 */
export function WarpDriver() {
  useFrame((state, rawDt) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const controls = controlsRef.current;
    const { model, reducedMotion } = useStore.getState();
    if (!warp.active || !controls || !model) {
      warp.speed = 0;
      warp.flash = 0;
      return;
    }
    const dt = Math.min(rawDt, 0.05);
    if (warp.t === 0) {
      warp.fromPos.copy(camera.position);
      warp.fromTarget.copy(controls.target);
      controls.enabled = false;
      controls.autoRotate = false;
      controls.maxDistance = Infinity;
      controls.dispatchEvent({ type: 'start' }); // cancels any fly-to in progress
    }
    const accel = reducedMotion ? 0.001 : ACCEL;
    const arrive = reducedMotion ? 0.001 : ARRIVE;
    warp.t += reducedMotion ? 1 : dt;

    let fov = BASE_FOV;
    if (warp.t < accel) {
      // 1. Accelerate: dive at the aim point, or pull back away from it.
      const k = easeIn(warp.t / accel);
      if (warp.dir === 1) {
        tmp.copy(warp.fromPos).sub(warp.aim).multiplyScalar(0.04).add(warp.aim);
        camera.position.lerpVectors(warp.fromPos, tmp, k);
        controls.target.lerpVectors(warp.fromTarget, warp.aim, Math.min(1, k * 4));
      } else {
        tmp.copy(warp.fromPos).sub(warp.fromTarget);
        tmp.multiplyScalar(2.6).add(warp.fromPos);
        camera.position.lerpVectors(warp.fromPos, tmp, k);
      }
      fov = BASE_FOV + (WARP_FOV - BASE_FOV) * k;
      warp.speed = Math.pow(warp.t / accel, 1.5);
    } else if (!warp.switched) {
      // 2. The switch, hidden by the flash.
      warp.switched = true;
      const prev = useStore.getState().system;
      useStore.getState().set({ system: warp.next, selection: null, highlight: null, hovered: -1 });
      // Keep the camera's heading so the new view doesn't spin around.
      tmp.copy(camera.position).sub(controls.target);
      const azimuth = Math.atan2(tmp.x, tmp.z);
      if (warp.next !== null) {
        const sys = systemFor(model, warp.next);
        const dist = sys.extent * 1.2 + 10;
        const elev = THREE.MathUtils.degToRad(24);
        warp.arriveTarget.set(0, 0, 0);
        warp.arriveTo
          .set(0, Math.sin(elev) * dist, Math.cos(elev) * dist)
          .applyAxisAngle(UP, azimuth);
        warp.arriveFrom.copy(warp.arriveTo).multiplyScalar(warp.dir === 1 ? 3.2 : 0.2);
        controls.maxDistance = sys.extent * 5 + 60;
      } else {
        const { target, dist } = galaxyFraming(prev ?? 0);
        const elev = THREE.MathUtils.degToRad(34);
        const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev)).applyAxisAngle(
          UP,
          azimuth,
        );
        warp.arriveTarget.copy(target);
        warp.arriveTo.copy(target).addScaledVector(dir, dist);
        warp.arriveFrom.copy(target).addScaledVector(dir, dist * 0.08);
        controls.maxDistance = model.layout.extent * 6 + 100;
      }
      camera.position.copy(warp.arriveFrom);
      controls.target.copy(warp.arriveTarget);
      fov = WARP_FOV;
      warp.speed = 1;
    } else {
      // 3. Arrive: decelerate into the new view as the field of view settles.
      const u = Math.min(1, (warp.t - accel) / arrive);
      const k = easeOut(u);
      camera.position.lerpVectors(warp.arriveFrom, warp.arriveTo, k);
      controls.target.copy(warp.arriveTarget);
      fov = WARP_FOV - (WARP_FOV - BASE_FOV) * k;
      warp.speed = 1 - k;
      if (u >= 1) {
        warp.active = false;
        warp.speed = 0;
        controls.enabled = true;
        useStore.getState().set({ warping: false });
      }
    }
    warp.flash = reducedMotion ? 0 : Math.exp(-Math.pow((warp.t - accel) / 0.14, 2)) * 0.92;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    // OrbitControls aimed the camera earlier this frame; aim it at the new target now.
    camera.lookAt(controls.target);
  });
  return null;
}
