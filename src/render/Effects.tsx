import { useFrame, useThree } from '@react-three/fiber';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  VignetteEffect,
} from 'postprocessing';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../state/store';
import { composerRef } from './sceneRefs';

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

  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, camera));
    const bloom = new BloomEffect({
      mipmapBlur: true,
      intensity: 1.35,
      luminanceThreshold: 0.12,
      luminanceSmoothing: 0.35,
      radius: 0.72,
    });
    // Merged into one pass with bloom: a vignette costs almost nothing here.
    const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
    c.addPass(new EffectPass(camera, bloom, vignette));
    return c;
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

  useFrame((_, dt) => composer.render(dt), 1);
  return null;
}
