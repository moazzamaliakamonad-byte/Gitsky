import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from '../state/store';
import { controlsRef } from './sceneRefs';

const FLY_SECONDS = 1.3;
const INTRO_SECONDS = 3.6;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Flight {
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPos: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
  seconds: number;
  ease: (t: number) => number;
  /** Start auto-rotating when the flight lands (the intro). */
  thenRotate?: boolean;
}

/**
 * Orbit controls (drag to rotate, scroll/pinch to zoom, right-drag to pan), slow
 * auto-rotation until the first interaction, and smooth fly-to camera animation.
 */
export function Controls() {
  const { camera, gl } = useThree();
  const model = useStore((s) => s.model);
  const flyTo = useStore((s) => s.flyTo);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const flight = useRef<Flight | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.9;
    controls.autoRotateSpeed = 0.28;
    controls.listenToKeyEvents(window); // arrow keys pan
    const onStart = () => {
      controls.autoRotate = false;
      flight.current = null;
      if (!useStore.getState().interacted) useStore.getState().set({ interacted: true });
    };
    controls.addEventListener('start', onStart);
    controlsRef.current = controls;
    return () => {
      controls.removeEventListener('start', onStart);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  // Frame each new galaxy: a three-quarter view from above, like a photo of a galaxy.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !model) return;
    const r = model.layout.extent;
    const dist = r * 1.85 + 14;
    const elev = THREE.MathUtils.degToRad(38);
    const final = new THREE.Vector3(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
    controls.target.set(0, 0, 0);
    controls.minDistance = 2;
    controls.maxDistance = r * 6 + 100;
    const rotate = !reducedMotion && !useStore.getState().interacted;
    if (reducedMotion) {
      camera.position.copy(final);
      flight.current = null;
    } else {
      // The intro: start high above and further out, turned a little, and descend into
      // the three-quarter view while the arms unwind beneath the camera.
      const highElev = THREE.MathUtils.degToRad(76);
      const start = new THREE.Vector3(
        0,
        Math.sin(highElev) * dist * 2.1,
        Math.cos(highElev) * dist * 2.1,
      );
      start.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.9);
      camera.position.copy(start);
      flight.current = {
        fromPos: start,
        fromTarget: new THREE.Vector3(),
        toPos: final,
        toTarget: new THREE.Vector3(),
        t: 0,
        seconds: INTRO_SECONDS,
        ease: easeOut,
        thenRotate: rotate,
      };
    }
    controls.autoRotate = false;
    controls.update();
  }, [model, camera, reducedMotion]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !flyTo) return;
    const toTarget = new THREE.Vector3(...flyTo.target);
    const dir = camera.position.clone().sub(controls.target).normalize();
    // Keep a pleasant downward angle so the disk doesn't flatten into a line.
    if (Math.abs(dir.y) < 0.25) dir.y = 0.25 * Math.sign(dir.y || 1);
    dir.normalize();
    const toPos = toTarget.clone().add(dir.multiplyScalar(flyTo.distance));
    controls.autoRotate = false;
    if (reducedMotion) {
      camera.position.copy(toPos);
      controls.target.copy(toTarget);
      controls.update();
      return;
    }
    flight.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos,
      toTarget,
      t: 0,
      seconds: FLY_SECONDS,
      ease: easeInOut,
    };
  }, [flyTo, camera, reducedMotion]);

  // On the landing page, shift the rendered view down so the galaxy sits above the hero
  // text instead of behind it. setViewOffset renders a sub-rectangle of a taller image,
  // so the projection (and therefore picking) stays exact.
  const viewShift = useRef(0);
  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    // The landing page, a collision and a system all have a panel at the bottom: lift
    // the scene above it.
    const st = useStore.getState();
    const want = st.heroOpen
      ? 0.17
      : st.collision
        ? 0.2
        : st.universe
          ? 0.16
          : st.system !== null
            ? 0.1
            : 0;
    const k = reducedMotion ? 1 : Math.min(1, dt * 3);
    viewShift.current += (want - viewShift.current) * k;
    const { width: w, height: h } = state.size;
    if (viewShift.current > 0.001) cam.setViewOffset(w, h, 0, viewShift.current * h, w, h);
    else if (cam.view?.enabled) cam.clearViewOffset();
  });

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const f = flight.current;
    if (f) {
      f.t = Math.min(1, f.t + Math.min(dt, 0.05) / f.seconds);
      const k = f.ease(f.t);
      controls.target.lerpVectors(f.fromTarget, f.toTarget, k);
      camera.position.lerpVectors(f.fromPos, f.toPos, k);
      if (f.t >= 1) {
        flight.current = null;
        if (f.thenRotate && !useStore.getState().interacted) controls.autoRotate = true;
      }
    }
    controls.update(dt);
  });

  return null;
}
