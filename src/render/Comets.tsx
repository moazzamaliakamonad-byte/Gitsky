import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { hexToRgb } from '../layout/color';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import {
  authorColor,
  bezier,
  cometControl,
  cometOrigin,
  cometsAt,
  MAX_PER_COMMIT,
  type Vec3,
} from './cometMath';
import { cometFragment, cometVertex } from './shaders';
import { timelineClock } from './timelineClock';

const TRAIL = 90;
/** Gap between trail points, in path progress. */
const TRAIL_STEP = 0.0042;
const PER_COMET = TRAIL + 1; // trail points + the head; the burst reuses the head slot
const CAPACITY = MAX_PER_COMMIT * PER_COMET;

/**
 * Comets: every sampled commit sends one comet per touched file from beyond the rim
 * to that file's star, along a curved path, leaving a fading trail. On arrival the
 * comet becomes an expanding ring. All of it is one Points draw call; the buffers are
 * refilled each frame from `cometsAt(playhead)`, which is pure, so scrubbing just works.
 */
export function Comets({ model }: { model: SkyModel }) {
  const { size, camera } = useThree();
  const dpr = useStore((s) => s.dpr);

  const { geometry, pos, col, sz, alpha, kind } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(CAPACITY * 3);
    const col = new Float32Array(CAPACITY * 3);
    const sz = new Float32Array(CAPACITY);
    const alpha = new Float32Array(CAPACITY);
    const kind = new Float32Array(CAPACITY);
    const attr = (a: Float32Array, n: number) =>
      new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr(pos, 3));
    g.setAttribute('aColor', attr(col, 3));
    g.setAttribute('aSize', attr(sz, 1));
    g.setAttribute('aAlpha', attr(alpha, 1));
    g.setAttribute('aKind', attr(kind, 1));
    g.setDrawRange(0, 0);
    return { geometry: g, pos, col, sz, alpha, kind };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: cometVertex,
        fragmentShader: cometFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uScale: { value: 1 }, uPixelRatio: { value: 1 } },
      }),
    [],
  );

  useEffect(() => {
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
    material.uniforms.uScale.value = size.height / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    material.uniforms.uPixelRatio.value = dpr;
  }, [size.height, camera, dpr, material]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Per-commit path geometry is reused for every frame of that commit.
  const rim = model.layout.extent * 1.45;
  const colorCache = useMemo(() => new Map<string, [number, number, number]>(), []);

  useFrame(() => {
    const { commits } = model.data;
    const comets = cometsAt(commits, timelineClock.playhead);
    const p = model.layout.positions;
    let n = 0;

    const put = (v: Vec3, c: [number, number, number], s: number, a: number, k: number) => {
      pos[n * 3] = v[0];
      pos[n * 3 + 1] = v[1];
      pos[n * 3 + 2] = v[2];
      col[n * 3] = c[0];
      col[n * 3 + 1] = c[1];
      col[n * 3 + 2] = c[2];
      sz[n] = s;
      alpha[n] = a;
      kind[n] = k;
      n++;
    };

    for (const c of comets) {
      const commit = commits[c.commit];
      let rgb = colorCache.get(commit.author);
      if (!rgb) {
        rgb = hexToRgb(authorColor(commit.author));
        colorCache.set(commit.author, rgb);
      }
      const end: Vec3 = [p[c.file * 3], p[c.file * 3 + 1], p[c.file * 3 + 2]];
      if (c.u <= 1) {
        const start = cometOrigin(commit.sha, c.j, rim);
        const ctrl = cometControl(start, end);
        // Ease in: comets accelerate toward their star, like falling inward.
        const head = c.u * c.u * (3 - 2 * c.u) * 0.35 + c.u * 0.65;
        put(bezier(start, ctrl, end, head), rgb, 5.2, 1.5, 0);
        for (let i = 1; i <= TRAIL; i++) {
          const t = head - i * TRAIL_STEP;
          if (t <= 0) break;
          const fade = Math.pow(1 - i / (TRAIL + 1), 1.7);
          put(bezier(start, ctrl, end, t), rgb, 3.4 * fade + 0.5, 0.55 * fade, 0);
        }
      } else {
        // Impact: an expanding, fading ring around the star.
        const b = c.u - 1;
        put(end, rgb, 3 + b * 22, Math.exp(-b * 2.8), 1);
      }
    }
    geometry.setDrawRange(0, n);
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha', 'aKind']) {
      const a = geometry.getAttribute(name) as THREE.BufferAttribute;
      a.needsUpdate = true;
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
    }
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
