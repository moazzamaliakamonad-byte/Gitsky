import { deepClock, OFF } from './deepClock';
import { NOW } from '../data/deepTime';
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
    const born = new THREE.BufferAttribute(new Float32Array(glow.count), 1);
    born.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aBorn', born);
    return { g, count: glow.count, src: glow.src };
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
          uEpoch: { value: OFF },
        },
      }),
    [],
  );

  useEffect(() => () => geometry.g.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Deep time: unresolved light appears with the files it belongs to.
  useEffect(() => {
    const attr = geometry.g.getAttribute('aBorn') as THREE.BufferAttribute;
    const apply = () => {
      const h = useStore.getState().deep?.history;
      const arr = attr.array as Float32Array;
      if (!h || h.born.length !== model.data.files.length) arr.fill(0);
      else {
        const last = h.epochs.length;
        for (let j = 0; j < arr.length; j++) {
          const b = h.born[geometry.src[j]];
          arr[j] = b === NOW ? last : b;
        }
      }
      attr.needsUpdate = true;
    };
    apply();
    return useStore.subscribe((s, prev) => {
      if (s.deep?.history !== prev.deep?.history) apply();
    });
  }, [geometry, model]);
  useFrame(() => {
    material.uniforms.uEpoch.value = deepClock.epoch;
  });

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
