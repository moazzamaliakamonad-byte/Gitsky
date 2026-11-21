import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../state/store';
import { formClock } from './formClock';
import { starsRef } from './sceneRefs';
import { advancePlayhead, lastTouches, START } from './timeline';
import { timelineClock } from './timelineClock';

/**
 * Drives time: advances the playhead while playing, feeds it to the star shader
 * (uPlayhead → the arrival flash), and rewrites the stars' `aTouch` attribute only when
 * the playhead crosses into a new commit.
 */
export function TimelineDriver() {
  const model = useStore((s) => s.model);
  const lastK = useRef<number | null>(null);

  useEffect(() => {
    timelineClock.playhead = START;
    lastK.current = null;
  }, [model]);

  useFrame((_, dt) => {
    const { playing, commitIndex, set } = useStore.getState();
    if (!model) return;
    const n = model.data.commits.length;
    // Comets wait until the galaxy has formed.
    if (playing && formClock.value >= 1 && n > 0) {
      timelineClock.playhead = advancePlayhead(timelineClock.playhead, Math.min(dt, 0.1), n);
    }
    const points = starsRef.current;
    if (!points) return;
    const mat = points.material as THREE.ShaderMaterial;
    mat.uniforms.uPlayhead.value = timelineClock.playhead;

    const k = Math.min(n - 1, Math.floor(timelineClock.playhead));
    if (k !== lastK.current) {
      lastK.current = k;
      const attr = points.geometry.getAttribute('aTouch') as THREE.BufferAttribute;
      lastTouches(model.data.files.length, model.data.commits, k, attr.array as Float32Array);
      attr.needsUpdate = true;
      if (k !== commitIndex) set({ commitIndex: k });
    }
  });

  return null;
}
