import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useStore, type AppState } from '../state/store';
import type { SkyModel } from '../state/model';
import { ARRIVE } from './timeline';
import { starFragment, starVertex } from './shaders';
import { starsRef } from './sceneRefs';
import { formClock } from './formClock';

const FORM_SECONDS = 2.6;

/**
 * Every file in the repo, as ONE THREE.Points object = one draw call.
 * React builds the geometry once per repo; after that, per-frame changes are uniform
 * updates, and interaction changes rewrite one attribute array. No React re-renders.
 */
export function Starfield({ model }: { model: SkyModel }) {
  const { size, camera } = useThree();
  const formStart = useRef<number | null>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const quality = useStore((s) => s.quality);
  const dpr = useStore((s) => s.dpr);

  const geometry = useMemo(() => {
    const n = model.data.files.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(model.layout.positions, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(model.colors, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(model.sizes, 1));
    g.setAttribute('aBright', new THREE.BufferAttribute(model.churn.brightness, 1));
    g.setAttribute('aSpike', new THREE.BufferAttribute(model.spikes, 1));
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) seeds[i] = ((i * 2654435761) >>> 0) / 4294967296;
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const hl = new THREE.BufferAttribute(new Float32Array(n).fill(1), 1);
    hl.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aHighlight', hl);
    const touch = new THREE.BufferAttribute(new Float32Array(n).fill(-1), 1);
    touch.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aTouch', touch);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), model.layout.radius * 1.1);
    return g;
  }, [model]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVertex,
        fragmentShader: starFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uForm: { value: 0 },
          uRadius: { value: 1 },
          uScale: { value: 1 },
          uPixelRatio: { value: 1 },
          uTwinkle: { value: 1 },
          uPlayhead: { value: -10 },
          uArrive: { value: ARRIVE },
          uHalo: { value: 0 },
          uExposure: { value: 1 },
        },
      }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Highlight and selection → the aHighlight attribute (0 dimmed, 1 normal, 2 emphasised).
  // One Float32Array rewrite + re-upload per change; nothing per frame.
  useEffect(() => {
    const attr = geometry.getAttribute('aHighlight') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const apply = (s: AppState) => {
      const { highlight, selection } = s;
      arr.fill(highlight ? 0 : 1);
      if (highlight) {
        const v = highlight.reason === 'folder' ? 1 : 2;
        for (const i of highlight.indices) arr[i] = v;
      }
      if (selection?.kind === 'file') arr[selection.index] = 2;
      attr.needsUpdate = true;
    };
    apply(useStore.getState());
    return useStore.subscribe((s, prev) => {
      if (s.highlight !== prev.highlight || s.selection !== prev.selection) apply(s);
    });
  }, [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Restart the forming animation for each new repo.
  useEffect(() => {
    formStart.current = null;
    material.uniforms.uRadius.value = model.layout.radius;
    // Dense skies add up to white under additive blending; dim them so hues survive.
    material.uniforms.uExposure.value = Math.min(
      1,
      Math.max(0.26, Math.sqrt(2500 / Math.max(1, model.data.files.length))),
    );
  }, [model, material]);

  useEffect(() => {
    material.uniforms.uHalo.value = quality === 'low' ? 1 : 0;
    material.uniforms.uTwinkle.value = reducedMotion ? 0 : 1;
  }, [quality, reducedMotion, material]);

  useEffect(() => {
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
    material.uniforms.uScale.value = size.height / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    material.uniforms.uPixelRatio.value = dpr;
  }, [size.height, camera, dpr, material]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    material.uniforms.uTime.value = t;
    if (formStart.current === null) formStart.current = t;
    const form = reducedMotion ? 1 : Math.min(1, (t - formStart.current) / FORM_SECONDS);
    material.uniforms.uForm.value = form;
    formClock.value = form;
  });

  return (
    <points
      ref={(p) => {
        starsRef.current = p;
      }}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}
