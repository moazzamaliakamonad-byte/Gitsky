import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import { formClock } from './formClock';
import { chartFragment, chartVertex } from './shaders';

const RING_SEGMENTS = 192;

/**
 * A faint star-chart overlay in the galaxy plane: concentric orbit rings, radial
 * spokes every 30°, and degree ticks on the outer ring. One LineSegments draw call.
 * It gives the eye a sense of scale and orientation while the galaxy rotates.
 */
export function StarChart({ model }: { model: SkyModel }) {
  const heroOpen = useStore((s) => s.heroOpen);
  const R = model.layout.extent * 1.05;

  const geometry = useMemo(() => {
    const pos: number[] = [];
    const alpha: number[] = [];
    const seg = (x1: number, z1: number, x2: number, z2: number, a1: number, a2 = a1) => {
      pos.push(x1, 0, z1, x2, 0, z2);
      alpha.push(a1, a2);
    };
    // Rings: dashed on the inner ones, solid on the outer frame.
    const rings = [0.33, 0.66, 1.0, 1.12];
    rings.forEach((k, ri) => {
      const r = R * k;
      for (let i = 0; i < RING_SEGMENTS; i++) {
        if (ri < 3 && i % 2 === 1) continue; // dashes
        const t1 = (i / RING_SEGMENTS) * Math.PI * 2;
        const t2 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;
        const a = ri === 3 ? 0.9 : 0.55;
        seg(r * Math.cos(t1), r * Math.sin(t1), r * Math.cos(t2), r * Math.sin(t2), a);
      }
    });
    // Spokes every 30°, fading toward the core.
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      seg(c * R * 0.18, s * R * 0.18, c * R * 1.12, s * R * 1.12, 0.0, 0.6);
    }
    // Ticks every 5° on the outer frame, longer every 30°.
    for (let i = 0; i < 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      const len = i % 6 === 0 ? 0.05 : 0.022;
      const c = Math.cos(t);
      const s = Math.sin(t);
      seg(c * R * 1.12, s * R * 1.12, c * R * (1.12 + len), s * R * (1.12 + len), 1.0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alpha, 1));
    return g;
  }, [R]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: chartVertex,
        fragmentShader: chartFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uOpacity: { value: 0 } },
      }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    // The chart draws itself in once the galaxy has formed; quieter behind the hero.
    const target = (heroOpen ? 0.12 : 0.2) * Math.max(0, (formClock.value - 0.6) / 0.4);
    const u = material.uniforms.uOpacity;
    u.value += (target - u.value) * Math.min(1, dt * 2.5);
  });

  return (
    <lineSegments geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} />
  );
}
