import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { rand } from '../layout/random';
import { warpFragment, warpVertex } from './systemShaders';
import { warp } from './warp';

const COUNT = 700;

/**
 * Star streaks rushing past during a warp: line segments defined in camera space
 * (the shader skips the view matrix), arranged in a hollow cylinder around the view
 * axis so the centre of the screen, where you're heading, stays clear.
 */
export function WarpStreaks() {
  const lines = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => {
    const pos = new Float32Array(COUNT * 2 * 3);
    const end = new Float32Array(COUNT * 2);
    const seed = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      const a = rand(i, 1) * Math.PI * 2;
      const r = 6 + Math.pow(rand(i, 2), 0.6) * 90;
      for (let e = 0; e < 2; e++) {
        const k = i * 2 + e;
        pos[k * 3] = Math.cos(a) * r;
        pos[k * 3 + 1] = Math.sin(a) * r;
        pos[k * 3 + 2] = 0;
        end[k] = e;
        seed[k] = rand(i, 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: warpVertex,
        fragmentShader: warpFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uWarp: { value: 0 },
          uTime: { value: 0 },
          uTint: { value: new THREE.Color('#9db6ff') },
        },
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const clock = useRef(0);
  useFrame((_, dt) => {
    const on = warp.speed > 0.01;
    if (lines.current) lines.current.visible = on;
    if (!on) return;
    // Integrate distance, so speeding up or reversing never makes streaks jump.
    clock.current += Math.min(dt, 0.05) * (60 + 900 * warp.speed) * warp.dir;
    material.uniforms.uWarp.value = warp.speed;
    material.uniforms.uTime.value = clock.current;
  });

  return (
    <lineSegments
      ref={lines}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={20}
      visible={false}
    />
  );
}
