import { createPortal, useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { diskRadius } from '../layout/blackHoles';
import { rand } from '../layout/random';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import { formClock } from './formClock';
import { fxState, overlayScene } from './fxState';
import { diskFragment, diskVertex, shadowFragment, shadowVertex } from './shaders';

/** Einstein radius as a fraction of the disk radius. The shadow is 0.9 of it. */
const EINSTEIN = 0.5;

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
 * The heaviest generated or binary files, drawn as black holes.
 *
 * High quality: the far half of each accretion disk is drawn in the scene, where the
 * lens pass bends it up over the shadow; the near half goes to `overlayScene`, drawn
 * after the lens, so it crosses in front of the hole unbent. That split is what gives
 * the "Interstellar" silhouette from a screen-space lens.
 * Low quality: no lens pass, so both halves stay in the scene with a black billboard
 * between them standing in for the shadow.
 */
export function BlackHoles({ model }: { model: SkyModel }) {
  const quality = useStore((s) => s.quality);
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
          // Steep, seeded tilts: from the usual viewing angles the disk reads nearly edge-on.
          tilt: new THREE.Euler(1.05 + rand(h.index, 1) * 0.35, rand(h.index, 2) * 6.28, 0, 'YXZ'),
          disk,
          far: diskMaterial(center, 1, R),
          near: diskMaterial(center, -1, R),
          shadow: new THREE.ShaderMaterial({
            vertexShader: shadowVertex,
            fragmentShader: shadowFragment,
            transparent: true,
            depthWrite: false,
            uniforms: { uSize: { value: R * EINSTEIN * 0.9 }, uOpacity: { value: 0 } },
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
        for (const m of [p.far, p.near, p.shadow]) m.dispose();
      }
      fxState.holeCount = 0;
    },
    [parts],
  );
  useEffect(() => () => quad.dispose(), [quad]);

  useFrame((state) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const t = state.clock.elapsedTime;
    const formed = THREE.MathUtils.smoothstep(formClock.value, 0.85, 1);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let n = 0;
    for (const p of parts) {
      for (const m of [p.far, p.near]) {
        m.uniforms.uTime.value = t;
        m.uniforms.uIntensity.value = formed * 1.6;
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
          <mesh
            geometry={p.disk}
            material={p.far}
            rotation={p.tilt}
            scale={[p.R, 1, p.R]}
            frustumCulled={false}
            renderOrder={3}
          />
          {!high && (
            <>
              <mesh geometry={quad} material={p.shadow} frustumCulled={false} renderOrder={4} />
              <mesh
                geometry={p.disk}
                material={p.near}
                rotation={p.tilt}
                scale={[p.R, 1, p.R]}
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
              scale={[p.R, 1, p.R]}
              frustumCulled={false}
            />
          )),
          overlayScene,
        )}
    </>
  );
}
