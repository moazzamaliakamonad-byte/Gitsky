import { useFrame, useThree } from '@react-three/fiber';
import {
  BloomEffect,
  Effect,
  EffectComposer,
  EffectPass,
  RenderPass,
  VignetteEffect,
} from 'postprocessing';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../state/store';
import { composerRef } from './sceneRefs';
import { filmFragment } from './shaders';

/** Highlight shoulder + grain. See filmFragment in shaders.ts. */
class FilmEffect extends Effect {
  constructor() {
    super('FilmEffect', filmFragment, {
      uniforms: new Map<string, THREE.Uniform<number>>([
        ['uKnee', new THREE.Uniform(0.62)],
        ['uGrain', new THREE.Uniform(0.022)],
        ['uSeed', new THREE.Uniform(0)],
      ]),
    });
  }
}

/**
 * Bloom, driven directly with pmndrs/postprocessing. Explained in
 * learn/concepts/bloom-and-postprocessing.md.
 *
 * Mounting this component takes over rendering: a useFrame with priority > 0 tells
 * react-three-fiber "I'll render the frame myself". Unmounting it (Low quality) hands
 * rendering back to fiber's plain renderer.render(), with no bloom passes at all.
 */
export function Effects() {
  const { gl, scene, camera, size } = useThree();
  const dpr = useStore((s) => s.dpr);
  const reducedMotion = useStore((s) => s.reducedMotion);

  const { composer, film } = useMemo(() => {
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, camera));
    // A higher threshold than a typical "glow everything" bloom: only genuinely bright
    // light blooms, so faint stars stay crisp pinpoints instead of a soft mush.
    const bloom = new BloomEffect({
      mipmapBlur: true,
      intensity: 1.15,
      luminanceThreshold: 0.2,
      luminanceSmoothing: 0.45,
      radius: 0.78,
    });
    const filmFx = new FilmEffect();
    // Merged into one pass with bloom: vignette and film cost almost nothing here.
    const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
    c.addPass(new EffectPass(camera, bloom, filmFx, vignette));
    return { composer: c, film: filmFx };
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size, dpr]);

  useEffect(() => {
    composerRef.current = composer;
    return () => {
      composerRef.current = null;
      composer.dispose();
    };
  }, [composer]);

  useFrame((_, dt) => {
    // Moving grain reads as film; with reduced motion it holds still.
    if (!reducedMotion) {
      const seed = film.uniforms.get('uSeed');
      if (seed) seed.value = (seed.value + 17.13) % 1000;
    }
    composer.render(dt);
  }, 1);
  return null;
}
