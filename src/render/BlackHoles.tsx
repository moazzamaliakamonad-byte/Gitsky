import { createPortal, useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { diskRadius } from '../layout/blackHoles';
import { gauss, rand } from '../layout/random';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import { formClock } from './formClock';
import { fxState, overlayScene } from './fxState';
import {
  diskFragment,
  diskVertex,
  infallFragment,
  infallPointFragment,
  infallVertex,
  shadowFragment,
  shadowVertex,
} from './shaders';

/** Einstein radius as a fraction of the disk radius; the shadow is 0.9 of it, which puts
 *  the horizon right at the disk's inner edge. */
const EINSTEIN = 0.32;
/** Streaks of devoured stars per hole, and the lanes most of them fall along. */
const STREAKS = 2600;
const LANES = 5;

const v = new THREE.Vector3();

function diskMaterial(center: THREE.Vector3, side: number, radius: number) {
  return new THREE.ShaderMaterial({
    vertexShader: diskVertex,
    fragmentShader: diskFragment,
    transparent: true,
    depthWrite: false,
    depthTest: side >= 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uCenter: { value: center },
      uSide: { value: side },
      uRadius: { value: radius },
    },
  });
}

/**
 * The streams of stars falling in. Their colours come from the files nearest the hole,
 * so a black hole in a TypeScript neighbourhood swallows blue light.
 */
function buildInfall(model: SkyModel, fileIndex: number, center: THREE.Vector3) {
  const p = model.layout.positions;
  const n = model.data.files.length;
  // The 48 nearest files supply the palette.
  const near: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (i === fileIndex) continue;
    const d =
      (p[i * 3] - center.x) ** 2 + (p[i * 3 + 1] - center.y) ** 2 + (p[i * 3 + 2] - center.z) ** 2;
    if (near.length < 48) near.push([d, i]);
    else if (d < near[near.length - 1][0]) near[near.length - 1] = [d, i];
    else continue;
    near.sort((a, b) => a[0] - b[0]);
  }
  const verts = STREAKS * 2;
  const pos = new Float32Array(verts * 3);
  const seed = new Float32Array(verts);
  const lane = new Float32Array(verts);
  const end = new Float32Array(verts);
  const color = new Float32Array(verts * 3);
  for (let k = 0; k < STREAKS; k++) {
    const s = rand(fileIndex * 7919 + k, 1);
    const inLane = rand(k, 2) < 0.75;
    const a = inLane
      ? (Math.floor(rand(k, 3) * LANES) / LANES) * Math.PI * 2 + gauss(k, 4) * 0.22
      : rand(k, 6) * Math.PI * 2;
    const src = near.length ? near[Math.floor(rand(k, 7) * near.length)][1] : fileIndex;
    for (let e = 0; e < 2; e++) {
      const j = k * 2 + e;
      seed[j] = s;
      lane[j] = a;
      end[j] = e;
      for (let c = 0; c < 3; c++) color[j * 3 + c] = model.colors[src * 3 + c] * 0.8 + 0.2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aLane', new THREE.BufferAttribute(lane, 1));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  return g;
}

const infallMaterial = (fragmentShader: string) =>
  new THREE.ShaderMaterial({
    vertexShader: infallVertex,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uPixelRatio: { value: 1 } },
  });

/**
 * The heaviest generated or binary file, drawn as a black hole that is visibly eating:
 * streams of stars spiral in and stretch as they fall, a churning disk drains into a
 * dark heart, and (on High) a lensing pass bends the light behind it.
 *
 * High quality: the far half of the disk is drawn in the scene, where the lens bends it
 * up over the shadow; the near half goes to `overlayScene`, drawn after the lens, so it
 * crosses in front unbent. Low quality: no lens pass, so both halves stay in the scene
 * with a soft black billboard between them standing in for the shadow.
 */
export function BlackHoles({ model }: { model: SkyModel }) {
  const quality = useStore((s) => s.quality);
  const dpr = useStore((s) => s.dpr);
  const { holes } = model;

  const parts = useMemo(
    () =>
      holes.map((h) => {
        const p = model.layout.positions;
        const R = diskRadius(h.mass);
        const center = new THREE.Vector3(p[h.index * 3], p[h.index * 3 + 1], p[h.index * 3 + 2]);
        const disk = new THREE.PlaneGeometry(2, 2); // local units: vP runs 0…1 across the radius
        disk.rotateX(-Math.PI / 2);
        return {
          hole: h,
          R,
          center,
          // A modest, seeded tilt: from the usual three-quarter view the disk reads as a
          // whirlpool, while still leaning enough for the lens to arc it over the top.
          tilt: new THREE.Euler(0.42 + rand(h.index, 1) * 0.3, rand(h.index, 2) * 6.28, 0, 'YXZ'),
          disk,
          far: diskMaterial(center, 1, R),
          near: diskMaterial(center, -1, R),
          infall: buildInfall(model, h.index, center),
          streaks: infallMaterial(infallFragment),
          heads: infallMaterial(infallPointFragment),
          shadow: new THREE.ShaderMaterial({
            vertexShader: shadowVertex,
            fragmentShader: shadowFragment,
            transparent: true,
            depthWrite: false,
            uniforms: { uSize: { value: R * EINSTEIN * 0.95 }, uOpacity: { value: 0 } },
          }),
        };
      }),
    [holes, model],
  );
  const quad = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useEffect(
    () => () => {
      for (const p of parts) {
        p.disk.dispose();
        p.infall.dispose();
        for (const m of [p.far, p.near, p.shadow, p.streaks, p.heads]) m.dispose();
      }
      fxState.holeCount = 0;
    },
    [parts],
  );
  useEffect(() => () => quad.dispose(), [quad]);

  useFrame((state) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const t = state.clock.elapsedTime;
    const { system, collision, reducedMotion } = useStore.getState();
    const inGalaxy = system === null && !collision;
    const formed = inGalaxy ? THREE.MathUtils.smoothstep(formClock.value, 0.85, 1) : 0;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let n = 0;
    for (const p of parts) {
      for (const m of [p.far, p.near]) {
        m.uniforms.uTime.value = t;
        m.uniforms.uIntensity.value = formed * 1.3;
      }
      for (const m of [p.streaks, p.heads]) {
        // With reduced motion the streams hold still (time stops) but stay visible.
        m.uniforms.uTime.value = reducedMotion ? 7 : t;
        m.uniforms.uIntensity.value = formed * 0.55;
        m.uniforms.uPixelRatio.value = dpr;
      }
      p.shadow.uniforms.uOpacity.value = formed;
      // Project the hole for the lens pass: centre in uv, Einstein radius in uv height.
      v.copy(p.center).applyMatrix4(camera.matrixWorldInverse);
      const depth = -v.z;
      if (depth <= 0.5) continue;
      v.copy(p.center).project(camera);
      const rE = (p.R * EINSTEIN) / (depth * tanHalf) / 2;
      // Fade out as it leaves the screen, so the warp never pops at the edge.
      const off = Math.max(Math.abs(v.x), Math.abs(v.y));
      const onScreen = 1 - THREE.MathUtils.smoothstep(off, 1.0, 1.0 + rE * 8);
      const o = n * 4;
      fxState.holes[o] = v.x * 0.5 + 0.5;
      fxState.holes[o + 1] = v.y * 0.5 + 0.5;
      fxState.holes[o + 2] = rE;
      fxState.holes[o + 3] = formed * onScreen;
      n++;
    }
    fxState.holeCount = n;
  });

  const high = quality === 'high';
  return (
    <>
      {parts.map((p) => (
        <group key={p.hole.index} position={p.center}>
          <group rotation={p.tilt} scale={p.R}>
            <mesh geometry={p.disk} material={p.far} frustumCulled={false} renderOrder={3} />
            <lineSegments geometry={p.infall} material={p.streaks} frustumCulled={false} />
            <points geometry={p.infall} material={p.heads} frustumCulled={false} />
          </group>
          {!high && (
            <>
              <mesh geometry={quad} material={p.shadow} frustumCulled={false} renderOrder={4} />
              <mesh
                geometry={p.disk}
                material={p.near}
                rotation={p.tilt}
                scale={p.R}
                frustumCulled={false}
                renderOrder={5}
              />
            </>
          )}
        </group>
      ))}
      {high &&
        createPortal(
          parts.map((p) => (
            <mesh
              key={p.hole.index}
              geometry={p.disk}
              material={p.near}
              position={p.center}
              rotation={p.tilt}
              scale={p.R}
              frustumCulled={false}
            />
          )),
          overlayScene,
        )}
    </>
  );
}
