import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SkyModel } from '../state/model';
import { inGalaxyView, useStore } from '../state/store';
import { formClock } from './formClock';
import { starBodyFragment, starBodyVertex } from './systemShaders';
import { NEAR, nearLabels } from './nearConfig';

const MAX_BODIES = 400;
const MAX_LABELS = 10;

const v = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s3 = new THREE.Vector3();

/** A uniform grid over the stars, so "which stars are near the camera" is a few cells' work. */
function buildGrid(positions: Float32Array, n: number) {
  const cells = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.floor(positions[i * 3] / NEAR)},${Math.floor(positions[i * 3 + 1] / NEAR)},${Math.floor(positions[i * 3 + 2] / NEAR)}`;
    const c = cells.get(k);
    if (c) c.push(i);
    else cells.set(k, [i]);
  }
  return cells;
}

/**
 * Close up, a star stops being a soft point of light and resolves into a small sun with
 * a surface (its glow sprite fades over the same distance in the star shader). The
 * nearest ones get their file names, crisp, as clickable labels.
 */
export function NearStars({ model }: { model: SkyModel }) {
  const { size } = useThree();
  const n = model.data.files.length;
  const grid = useMemo(() => buildGrid(model.layout.positions, n), [model, n]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const last = useRef(new THREE.Vector3(1e9, 0, 0));
  const found = useRef<{ i: number; d: number }[]>([]);

  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 24, 16);
    g.setAttribute(
      'aColor',
      new THREE.InstancedBufferAttribute(new Float32Array(MAX_BODIES * 3), 3),
    );
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(MAX_BODIES), 1));
    g.setAttribute('aFade', new THREE.InstancedBufferAttribute(new Float32Array(MAX_BODIES), 1));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starBodyVertex,
        fragmentShader: starBodyFragment,
        uniforms: { uTime: { value: 0 } },
        // Emissive light, added: a body that is still fading in is faint, never a dark ball.
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useEffect(
    () => () => {
      nearLabels.els.forEach((el) => (el.style.opacity = '0'));
    },
    [],
  );

  useFrame((state) => {
    const camera = state.camera;
    const st = useStore.getState();
    const { content, heroOpen } = st;
    const im = mesh.current;
    if (!im) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    const active = inGalaxyView(st) && formClock.value > 0.98;
    if (!active) {
      im.count = 0;
      nearLabels.els.forEach((el) => (el.style.opacity = '0'));
      return;
    }
    // Re-query only when the camera has moved a little.
    const cam = camera.position;
    if (cam.distanceToSquared(last.current) > 0.04) {
      last.current.copy(cam);
      const out: { i: number; d: number }[] = [];
      const cx = Math.floor(cam.x / NEAR);
      const cy = Math.floor(cam.y / NEAR);
      const cz = Math.floor(cam.z / NEAR);
      const p = model.layout.positions;
      for (let x = cx - 1; x <= cx + 1; x++)
        for (let y = cy - 1; y <= cy + 1; y++)
          for (let z = cz - 1; z <= cz + 1; z++) {
            const cell = grid.get(`${x},${y},${z}`);
            if (!cell) continue;
            for (const i of cell) {
              const d = Math.hypot(p[i * 3] - cam.x, p[i * 3 + 1] - cam.y, p[i * 3 + 2] - cam.z);
              if (d < NEAR) out.push({ i, d });
            }
          }
      out.sort((a, b) => a.d - b.d);
      found.current = out.slice(0, MAX_BODIES);
    }

    // The selected file draws its own sun (FileOrbit) when it has planets.
    const resolved =
      content?.status === 'ready' && (content.outline?.length ?? 0) > 0 ? content.file : -1;
    const color = geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute;
    const seed = geometry.getAttribute('aSeed') as THREE.InstancedBufferAttribute;
    const fade = geometry.getAttribute('aFade') as THREE.InstancedBufferAttribute;
    let k = 0;
    const p = model.layout.positions;
    for (const { i, d } of found.current) {
      if (i === resolved) continue;
      const f = 1 - THREE.MathUtils.smoothstep(d, NEAR * 0.55, NEAR);
      if (f <= 0.01) continue;
      s3.setScalar(0.1 + model.sizes[i] * 0.045);
      m4.compose(v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), q, s3);
      im.setMatrixAt(k, m4);
      color.setXYZ(k, model.colors[i * 3], model.colors[i * 3 + 1], model.colors[i * 3 + 2]);
      seed.setX(k, (i % 97) / 97);
      fade.setX(k, f);
      k++;
    }
    im.count = k;
    im.instanceMatrix.needsUpdate = true;
    color.needsUpdate = true;
    seed.needsUpdate = true;
    fade.needsUpdate = true;

    // Labels for the nearest few that are in front of the camera.
    let slot = 0;
    for (const { i, d } of found.current) {
      if (slot >= MAX_LABELS || heroOpen) break;
      if (i === resolved) continue;
      v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).project(camera);
      if (v.z >= 1 || Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.9) continue;
      const el = nearLabels.els[slot];
      if (!el) break;
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      if (nearLabels.files[slot] !== i) {
        nearLabels.files[slot] = i;
        const path = model.data.files[i].path;
        el.textContent = path.slice(path.lastIndexOf('/') + 1);
        el.title = path;
      }
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = String(Math.min(1, (1 - d / NEAR) * 2.2));
      el.style.pointerEvents = 'auto';
      slot++;
    }
    for (; slot < nearLabels.els.length; slot++) {
      nearLabels.els[slot].style.opacity = '0';
      nearLabels.els[slot].style.pointerEvents = 'none';
      nearLabels.files[slot] = -1;
    }
  });

  return <instancedMesh ref={mesh} args={[geometry, material, MAX_BODIES]} frustumCulled={false} />;
}
