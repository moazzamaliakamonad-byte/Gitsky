import { deepClock } from './deepClock';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import { formClock } from './formClock';
import { hazeFragment, hazeVertex } from './shaders';

/** The disk: one flat quad in the galaxy plane whose shader draws the spiral-arm haze. */
export function GalaxyHaze({ model }: { model: SkyModel }) {
  const { extent: radius, spiral } = model.layout;
  const quality = useStore((s) => s.quality);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(radius * 2.6, radius * 2.6);
    g.rotateX(-Math.PI / 2); // into the xz plane
    return g;
  }, [radius]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: hazeVertex,
        fragmentShader: hazeFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uA: { value: spiral.a },
          uB: { value: spiral.b },
          uArms: { value: spiral.arms },
          uSweep: { value: spiral.sweep },
          uR: { value: radius },
          uForm: { value: 0 },
          uStrength: { value: 1 },
          uOctaves: { value: 4 },
        },
      }),
    [spiral, radius],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.uniforms.uOctaves.value = quality === 'low' ? 2 : 4;
  }, [quality, material]);

  useFrame(() => {
    material.uniforms.uForm.value = formClock.value;
    material.uniforms.uStrength.value = Math.pow(deepClock.alive, 0.8);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={0} />;
}
