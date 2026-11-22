import { deepClock } from './deepClock';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CORE_RADIUS } from '../layout/galaxy';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import { formClock } from './formClock';
import { nebulaFragment, nebulaVertex } from './shaders';

/**
 * Folder nebulae + the core glow, as ONE instanced mesh: a single quad geometry drawn
 * N times, each instance with its own centre, size, colour and intensity.
 * Instance 0 is the warm core of the galaxy (the repo root).
 */
export function Nebulae({ model }: { model: SkyModel }) {
  const quality = useStore((s) => s.quality);

  const geometry = useMemo(() => {
    const neb = model.nebulae;
    const n = neb.count + 1;
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    const centers = new Float32Array(n * 3);
    centers.set(neb.centers, 3);
    const sizes = new Float32Array(n);
    sizes[0] = CORE_RADIUS * 3.4;
    sizes.set(neb.radii, 1);
    const colors = new Float32Array(n * 3);
    colors.set([1.0, 0.84, 0.62], 0);
    colors.set(neb.colors, 3);
    const intensity = new Float32Array(n);
    intensity[0] = 2.6;
    intensity.set(neb.intensity, 1);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) seeds[i] = ((i * 2654435761) >>> 0) / 4294967296;
    g.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 3));
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1));
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    g.setAttribute('aIntensity', new THREE.InstancedBufferAttribute(intensity, 1));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    g.instanceCount = n;
    return g;
  }, [model]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: nebulaVertex,
        fragmentShader: nebulaFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uForm: { value: 0 },
          uRadius: { value: 1 },
          uStrength: { value: 0.1 },
        },
      }),
    [],
  );

  useEffect(() => {
    material.uniforms.uRadius.value = model.layout.radius;
  }, [model, material]);

  useEffect(() => {
    // Without bloom the clouds carry more of the glow on their own.
    material.userData.base = quality === 'low' ? 0.2 : 0.15;
  }, [quality, material]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uForm.value = formClock.value;
    material.uniforms.uStrength.value =
      ((material.userData.base as number | undefined) ?? 0.15) * Math.pow(deepClock.alive, 0.8);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}
