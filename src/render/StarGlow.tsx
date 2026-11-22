import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SkyModel } from '../state/model';
import { buildGlow, CAP } from './glow';
import { useStore } from '../state/store';
import { formClock } from './formClock';
import { NEAR } from './nearConfig';
import { densityExposure } from './exposure';
import { glowFragment, glowVertex } from './shaders';

export function StarGlow({ model }: { model: SkyModel }) {
  const { size, camera } = useThree();
  const quality = useStore((s) => s.quality);
  const dpr = useStore((s) => s.dpr);

  const geometry = useMemo(() => {
    const glow = buildGlow(model, CAP[quality]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(glow.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(glow.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(glow.size, 1));
    g.setAttribute('aBright', new THREE.BufferAttribute(glow.bright, 1));
    return { g, count: glow.count };
  }, [model, quality]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uForm: { value: 0 },
          uRadius: { value: 1 },
          uScale: { value: 1 },
          uPixelRatio: { value: 1 },
          uGain: { value: 0.1 },
          uCamPos: { value: new THREE.Vector3() },
          uNear: { value: NEAR },
        },
      }),
    [],
  );

  useEffect(() => () => geometry.g.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Each file gets the same share of glow, dimmed for dense skies faster than the stars
  // (where stars already crowd together, they are their own glow). When something is
  // highlighted, the glow steps back so the highlighted stars carry the view.
  useEffect(() => {
    const base = 0.38 * Math.pow(densityExposure(model.data.files.length), 1.5);
    material.uniforms.uRadius.value = model.layout.radius;
    const apply = () => {
      material.uniforms.uGain.value = useStore.getState().highlight ? base * 0.35 : base;
    };
    apply();
    return useStore.subscribe((s, prev) => {
      if (s.highlight !== prev.highlight) apply();
    });
  }, [model, geometry, material]);

  useEffect(() => {
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
    material.uniforms.uScale.value = size.height / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    material.uniforms.uPixelRatio.value = dpr;
  }, [size.height, camera, dpr, material]);

  useFrame((state) => {
    material.uniforms.uForm.value = formClock.value;
    material.uniforms.uCamPos.value.copy(state.camera.position);
  });

  return <points geometry={geometry.g} material={material} frustumCulled={false} />;
}
