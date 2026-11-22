import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { hexToRgb } from '../layout/color';
import { KIND_COLOR, layoutFileOrbit } from '../layout/fileOrbit';
import type { FileSymbol } from '../layout/outline';
import { orbitPosition } from '../layout/system';
import type { SkyModel } from '../state/model';
import { inGalaxyView, useStore } from '../state/store';
import { fileOrbitState } from './fileOrbitState';
import {
  coronaFragment,
  coronaVertex,
  orbitFragment,
  orbitVertex,
  planetFragment,
  planetVertex,
  sunFragment,
  sunVertex,
} from './systemShaders';

const SEGMENTS = 96;
const p3: [number, number, number] = [0, 0, 0];
const v = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s3 = new THREE.Vector3();

/**
 * The selected file, seen up close: its star resolves into a small sun, and every
 * top-level symbol in it (functions, classes, types, headings, keys) orbits as a planet.
 * Hover a planet to name it; click it to open that code in the code panel.
 */
export function FileOrbit({ model }: { model: SkyModel }) {
  const content = useStore((s) => s.content);
  const outline = content?.status === 'ready' ? content.outline : undefined;
  if (!content || !outline || outline.length === 0) return null;
  return <FileOrbitScene key={content.file} model={model} file={content.file} outline={outline} />;
}

function FileOrbitScene({
  model,
  file,
  outline,
}: {
  model: SkyModel;
  file: number;
  outline: FileSymbol[];
}) {
  const { gl, size } = useThree();
  const symbol = useStore((s) => s.symbol);
  const center = useMemo(() => {
    const p = model.layout.positions;
    return new THREE.Vector3(p[file * 3], p[file * 3 + 1], p[file * 3 + 2]);
  }, [model, file]);
  const orbits = useMemo(() => layoutFileOrbit(outline, file), [outline, file]);
  const sunR = 0.42 + model.sizes[file] * 0.08;
  const intro = useRef(0);

  const built = useMemo(() => {
    const n = orbits.length;
    const sphere = new THREE.SphereGeometry(1, 28, 20);
    const color = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const kind = new Float32Array(n);
    const heat = new Float32Array(n);
    orbits.forEach((o, i) => {
      const s = outline[o.symbol];
      color.set(hexToRgb(KIND_COLOR[s.kind]), i * 3);
      seed[i] = ((file * 31 + i) % 97) / 97;
      kind[i] = s.kind === 'class' ? 1 : 0; // classes are banded giants, the rest rocky
    });
    sphere.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    sphere.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    sphere.setAttribute('aKind', new THREE.InstancedBufferAttribute(kind, 1));
    const heatAttr = new THREE.InstancedBufferAttribute(heat, 1);
    sphere.setAttribute('aHeat', heatAttr);

    const pos = new Float32Array(n * SEGMENTS * 2 * 3);
    const alpha = new Float32Array(n * SEGMENTS * 2);
    orbits.forEach((o, oi) => {
      for (let k = 0; k < SEGMENTS; k++) {
        for (let e = 0; e < 2; e++) {
          orbitPosition({ ...o, speed: 0, phase: ((k + e) / SEGMENTS) * Math.PI * 2 }, 0, p3);
          const j = (oi * SEGMENTS + k) * 2 + e;
          pos.set(p3, j * 3);
          alpha[j] = 0.14;
        }
      }
    });
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    orbitGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    return { sphere, heatAttr, orbitGeo };
  }, [orbits, outline, file]);

  const mats = useMemo(() => {
    const c = model.colors;
    const color = new THREE.Color(c[file * 3], c[file * 3 + 1], c[file * 3 + 2]);
    const add = (vs: string, fs: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: vs,
        fragmentShader: fs,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    return {
      sun: new THREE.ShaderMaterial({
        vertexShader: sunVertex,
        fragmentShader: sunFragment,
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uIntro: { value: 0 } },
      }),
      corona: add(coronaVertex, coronaFragment, {
        uTime: { value: 0 },
        uColor: { value: color },
        uInner: { value: 1 / 5 },
        uSize: { value: sunR * 5 },
        uIntro: { value: 0 },
      }),
      planet: new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uSun: { value: center } },
      }),
      orbit: add(orbitVertex, orbitFragment, { uIntro: { value: 0 } }),
    };
  }, [model, file, sunR, center]);
  const sunGeo = useMemo(() => new THREE.SphereGeometry(1, 48, 32), []);
  const quad = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const inst = useRef<THREE.InstancedMesh>(null);

  useEffect(
    () => () => {
      built.sphere.dispose();
      built.orbitGeo.dispose();
    },
    [built],
  );
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      sunGeo.dispose();
      quad.dispose();
    },
    [mats, sunGeo, quad],
  );

  // The focused symbol's planet glows (its "heat"), and its orbit brightens.
  useEffect(() => {
    const heat = built.heatAttr.array as Float32Array;
    heat.fill(0);
    if (symbol >= 0 && symbol < heat.length) heat[symbol] = 1;
    built.heatAttr.needsUpdate = true;
    const a = built.orbitGeo.getAttribute('aAlpha') as THREE.BufferAttribute;
    const arr = a.array as Float32Array;
    for (let oi = 0; oi < orbits.length; oi++)
      arr.fill(oi === symbol ? 0.6 : 0.14, oi * SEGMENTS * 2, (oi + 1) * SEGMENTS * 2);
    a.needsUpdate = true;
  }, [symbol, built, orbits.length]);

  useEffect(() => {
    fileOrbitState.active = true;
    return () => {
      fileOrbitState.active = false;
      fileOrbitState.hover = -1;
      fileOrbitState.labels.forEach((el) => (el.style.opacity = '0'));
      gl.domElement.style.cursor = '';
    };
  }, [gl]);

  useFrame((state, dt) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const st = useStore.getState();
    const { reducedMotion, pointer } = st;
    const visible = inGalaxyView(st);
    intro.current = Math.min(1, intro.current + dt / 0.7);
    const k = visible ? intro.current : 0;
    for (const m of Object.values(mats)) if ('uIntro' in m.uniforms) m.uniforms.uIntro.value = k;
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    mats.sun.uniforms.uTime.value = state.clock.elapsedTime;
    mats.corona.uniforms.uTime.value = state.clock.elapsedTime;
    mats.planet.uniforms.uTime.value = t;

    // Move the planets; find the one under the pointer.
    const mesh = inst.current;
    const rect = gl.domElement.getBoundingClientRect();
    const px = pointer.x - rect.left;
    const py = pointer.y - rect.top;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let best = -1;
    let bestScore = Infinity;
    const screen: [number, number, number][] = [];
    orbits.forEach((o, i) => {
      orbitPosition(o, t, p3);
      const x = center.x + p3[0];
      const y = center.y + p3[1];
      const z = center.z + p3[2];
      s3.setScalar(o.radius * k);
      m4.compose(v.set(x, y, z), q, s3);
      mesh?.setMatrixAt(i, m4);
      v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      const depth = -v.z;
      v.set(x, y, z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * size.width;
      const sy = (-v.y * 0.5 + 0.5) * size.height;
      screen.push([sx, sy, depth > 0 && v.z < 1 ? 1 : 0]);
      if (depth <= 0 || !visible) return;
      const rpx = (o.radius / (depth * tanHalf)) * (size.height / 2);
      const d = Math.hypot(sx - px, sy - py);
      const reach = Math.max(rpx, 6) + 5;
      if (d < reach && d / reach < bestScore) {
        bestScore = d / reach;
        best = i;
      }
    });
    if (mesh) mesh.instanceMatrix.needsUpdate = true;
    fileOrbitState.hover = best;
    if (best >= 0) gl.domElement.style.cursor = 'pointer';

    // Labels: the hovered planet and the focused one.
    const shown = [best, useStore.getState().symbol];
    fileOrbitState.labels.forEach((el, slot) => {
      const i = shown[slot];
      const sp = i >= 0 ? screen[i] : undefined;
      if (!sp || !sp[2] || (slot === 1 && i === best)) {
        el.style.opacity = '0';
        return;
      }
      const s = outline[orbits[i].symbol];
      if (el.dataset.key !== `${file}:${i}`) {
        el.dataset.key = `${file}:${i}`;
        el.dataset.kind = s.kind;
        el.textContent = s.name;
        el.title = `Lines ${s.line}–${s.endLine}`;
      }
      el.style.transform = `translate3d(${sp[0].toFixed(1)}px, ${sp[1].toFixed(1)}px, 0)`;
      el.style.opacity = '1';
    });
  });

  return (
    <group>
      <mesh geometry={sunGeo} material={mats.sun} position={center} scale={sunR} />
      <mesh
        geometry={quad}
        material={mats.corona}
        position={center}
        renderOrder={2}
        frustumCulled={false}
      />
      <instancedMesh
        ref={inst}
        args={[built.sphere, mats.planet, orbits.length]}
        frustumCulled={false}
      />
      <lineSegments
        geometry={built.orbitGeo}
        material={mats.orbit}
        position={center}
        frustumCulled={false}
      />
    </group>
  );
}
