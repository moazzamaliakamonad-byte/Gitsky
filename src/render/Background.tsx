import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { rand } from '../layout/random';
import { backgroundFragment, backgroundVertex, dustFragment, dustVertex } from './shaders';
import { useStore } from '../state/store';

/**
 * Deep-space gradient (a full-screen triangle drawn first, behind everything) plus a
 * sphere of faint distant stars that follows the camera, so it never gets closer:
 * it behaves as if infinitely far away, like a real sky.
 */
export function Background() {
  const { size } = useThree();
  const dpr = useStore((s) => s.dpr);
  const quality = useStore((s) => s.quality);

  const gradient = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // One triangle that covers the whole screen (cheaper than a two-triangle quad).
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    const m = new THREE.ShaderMaterial({
      vertexShader: backgroundVertex,
      fragmentShader: backgroundFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uAspect: { value: new THREE.Vector2(1, 1) },
        uVoid: { value: new THREE.Color('#04060d') },
        uAbyss: { value: new THREE.Color('#0b1638') },
        uNebula: { value: new THREE.Color('#3a3f9a') },
      },
    });
    return { g, m };
  }, []);

  useEffect(() => {
    gradient.m.uniforms.uAspect.value.set(size.width / Math.max(1, size.height), 1);
  }, [size, gradient]);

  const dustCount = quality === 'low' ? 1200 : 2600;
  const dust = useMemo(() => {
    const pos = new Float32Array(dustCount * 3);
    const sizes = new Float32Array(dustCount);
    const bright = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      // Uniform on a sphere: z uniform in [-1,1], angle uniform.
      const z = rand(i, 0) * 2 - 1;
      const t = rand(i, 1) * Math.PI * 2;
      const r = Math.sqrt(1 - z * z) * 1800;
      pos[i * 3] = r * Math.cos(t);
      pos[i * 3 + 1] = z * 1800;
      pos[i * 3 + 2] = r * Math.sin(t);
      const k = rand(i, 2);
      sizes[i] = 1.2 + k * k * 2.6;
      bright[i] = 0.15 + rand(i, 3) * 0.45;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: 1 } },
    });
    return { g, m };
  }, [dustCount]);

  useEffect(() => {
    dust.m.uniforms.uPixelRatio.value = dpr;
  }, [dpr, dust]);

  useEffect(
    () => () => {
      dust.g.dispose();
      dust.m.dispose();
    },
    [dust],
  );
  useEffect(
    () => () => {
      gradient.g.dispose();
      gradient.m.dispose();
    },
    [gradient],
  );

  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    group.current?.position.copy(camera.position);
  });

  return (
    <>
      <mesh geometry={gradient.g} material={gradient.m} renderOrder={-2} frustumCulled={false} />
      <group ref={group}>
        <points geometry={dust.g} material={dust.m} renderOrder={-1} frustumCulled={false} />
      </group>
    </>
  );
}
