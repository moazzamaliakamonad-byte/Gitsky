import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { constellationEdges } from '../layout/constellation';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import { authorColor } from './cometMath';
import { constellationLabel } from './constellationLabel';

const DRAW_SECONDS = 1.8;

const vertex = /* glsl */ `
attribute float aOrder;   // 0..1: when this line is drawn, in the order the tree grew
varying float vOrder;
void main() {
  vOrder = aOrder;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const fragment = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;
uniform float uTime;
varying float vOrder;
void main() {
  // Lines appear one after another; each brightens as it is drawn, then settles.
  float drawn = smoothstep(vOrder, vOrder + 0.04, uProgress);
  float fresh = exp(-max(uProgress - vOrder, 0.0) * 9.0);
  float shimmer = 0.85 + 0.15 * sin(uTime * 1.3 + vOrder * 40.0);
  gl_FragColor = vec4(uColor * drawn * (0.5 * shimmer + 0.9 * fresh), 1.0);
}
`;

const v = new THREE.Vector3();

/**
 * A person's files joined into a constellation: the minimum spanning tree of their
 * stars, drawn stroke by stroke in their colour, with their name at its heart.
 */
export function Constellation({ model }: { model: SkyModel }) {
  const highlight = useStore((s) => s.highlight);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const person = highlight?.person ?? null;
  const start = useRef(0);

  const built = useMemo(() => {
    if (!person || !highlight) return null;
    const p = model.layout.positions;
    const edges = constellationEdges(p, highlight.indices);
    if (edges.length === 0) return null;
    const pos = new Float32Array(edges.length * 6);
    const order = new Float32Array(edges.length * 2);
    edges.forEach(([a, b], k) => {
      pos.set([p[a * 3], p[a * 3 + 1], p[a * 3 + 2], p[b * 3], p[b * 3 + 1], p[b * 3 + 2]], k * 6);
      order[k * 2] = order[k * 2 + 1] = k / edges.length;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aOrder', new THREE.BufferAttribute(order, 1));
    // The label sits at the heart: the star nearest the centre of the shape.
    const stars = [...new Set(edges.flat())];
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const i of stars) {
      cx += p[i * 3];
      cy += p[i * 3 + 1];
      cz += p[i * 3 + 2];
    }
    const center = new THREE.Vector3(cx, cy, cz).divideScalar(stars.length);
    return { g, center };
  }, [person, highlight, model]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color() },
          uProgress: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    [],
  );

  useEffect(() => {
    if (person) material.uniforms.uColor.value.set(authorColor(person));
    start.current = -1;
  }, [person, material]);
  useEffect(() => () => built?.g.dispose(), [built]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(
    () => () => {
      if (constellationLabel.el) constellationLabel.el.style.opacity = '0';
    },
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    material.uniforms.uTime.value = t;
    const el = constellationLabel.el;
    if (!built || !person) {
      if (el) el.style.opacity = '0';
      return;
    }
    if (start.current < 0) start.current = t;
    const progress = reducedMotion ? 1.1 : Math.min(1.1, (t - start.current) / DRAW_SECONDS);
    material.uniforms.uProgress.value = progress;
    if (!el) return;
    v.copy(built.center).project(state.camera);
    const on = v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9;
    if (el.dataset.person !== person) {
      el.dataset.person = person;
      el.textContent = person;
      el.style.color = authorColor(person);
    }
    el.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * state.size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * state.size.height).toFixed(1)}px, 0)`;
    el.style.opacity = on ? String(Math.min(1, Math.max(0, (progress - 0.3) * 2))) : '0';
  });

  if (!built) return null;
  return <lineSegments geometry={built.g} material={material} frustumCulled={false} />;
}
