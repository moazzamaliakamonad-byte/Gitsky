import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SupernovaPlan } from './supernovaMath';
import { supernovaAt } from './supernovaMath';
import { fxState } from './fxState';
import { supernovaFragment, supernovaVertex } from './shaders';
import { timelineClock } from './timelineClock';

/** World-space radius of the fully expanded remnant. */
const SIZE = 16;
const v = new THREE.Vector3();

/** The supernova of the most-changed file, driven purely by the playhead. */
export function Supernova({ plan, position }: { plan: SupernovaPlan; position: THREE.Vector3 }) {
  const mesh = useRef<THREE.Mesh>(null);
  const quad = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: supernovaVertex,
        fragmentShader: supernovaFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uCenter: { value: position },
          uSize: { value: SIZE },
          uFlash: { value: 0 },
          uShell: { value: 0 },
          uRemnant: { value: 0 },
          uSeed: { value: (plan.file % 97) / 97 },
        },
      }),
    [plan, position],
  );
  useEffect(() => () => quad.dispose(), [quad]);
  useEffect(
    () => () => {
      material.dispose();
      fxState.flash = 0;
      fxState.shock[3] = 0;
    },
    [material],
  );

  useFrame(({ camera }) => {
    const s = supernovaAt(plan, timelineClock.playhead);
    if (mesh.current) mesh.current.visible = s !== null;
    if (!s) {
      fxState.flash = 0;
      fxState.shock[3] = 0;
      return;
    }
    const u = material.uniforms;
    u.uFlash.value = s.flash;
    u.uShell.value = s.shell;
    u.uRemnant.value = s.remnant;
    fxState.flash = s.flash;
    // Shock ripple in screen space for the first two seconds.
    v.copy(position).applyMatrix4(camera.matrixWorldInverse);
    const depth = -v.z;
    v.copy(position).project(camera);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2));
    const radius = depth > 0.5 ? (SIZE * (0.15 + s.age * 0.9)) / (depth * tanHalf) / 2 : 0;
    fxState.shock[0] = v.x * 0.5 + 0.5;
    fxState.shock[1] = v.y * 0.5 + 0.5;
    fxState.shock[2] = radius;
    fxState.shock[3] = depth > 0.5 ? 0.018 * Math.exp(-s.age * 1.6) * (s.age < 2.5 ? 1 : 0) : 0;
  });

  return (
    <mesh ref={mesh} geometry={quad} material={material} frustumCulled={false} renderOrder={5} />
  );
}
