import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { hexToRgb, LANGUAGES } from '../layout/color';
import { rand } from '../layout/random';
import { subtreeFiles } from '../layout/stats';
import { orbitPosition, orbitSpeed, type Orbit, type SystemLayout } from '../layout/system';
import type { SkyModel } from '../state/model';
import { clearSelection, selectFile, selectFolder } from '../state/selection';
import { enterSystem } from '../state/systemActions';
import { useStore } from '../state/store';
import {
  beltFragment,
  beltVertex,
  coronaFragment,
  coronaVertex,
  orbitFragment,
  orbitVertex,
  planetFragment,
  planetVertex,
  ringFragment,
  ringVertex,
  sunFragment,
  sunVertex,
} from './systemShaders';
import { bodies, systemFor } from './systemRuntime';
import { systemLabelEls } from './systemLabels';

const ORBIT_SEGMENTS = 160;
const p3: [number, number, number] = [0, 0, 0];
const v = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s3 = new THREE.Vector3();

/** The language colour that holds the most bytes in a folder's subtree. */
function folderColor(model: SkyModel, folder: number): [number, number, number] {
  const bytes = new Map<number, number>();
  for (const i of subtreeFiles(model.layout.tree, folder)) {
    const id = model.languageIds[i];
    bytes.set(id, (bytes.get(id) ?? 0) + model.data.files[i].size);
  }
  let best = -1;
  let most = -1;
  for (const [id, b] of bytes) if (b > most) [best, most] = [id, b];
  return best >= 0 ? hexToRgb(LANGUAGES[best].color) : [0.8, 0.85, 1];
}

interface Moon extends Orbit {
  giant: number;
  radius: number;
}

/** Everything static about one system: geometry, materials, instance attributes. */
function buildSystem(model: SkyModel, sys: SystemLayout) {
  const { planets, giants } = sys;
  const moons: Moon[] = [];
  giants.forEach((g, gi) => {
    for (let k = 0; k < g.moons; k++) {
      const seed = g.folder * 31 + k;
      const orbit = g.radius * (2.0 + 0.6 * (k / Math.max(1, g.moons - 1))) + rand(seed, 1) * 0.6;
      moons.push({
        giant: gi,
        radius: 0.18 + rand(seed, 2) * 0.22,
        orbit,
        speed: orbitSpeed(orbit) * 4,
        phase: rand(seed, 3) * Math.PI * 2,
        incline: g.ringTilt + (rand(seed, 4) - 0.5) * 0.3,
        node: rand(seed, 5) * Math.PI * 2,
      });
    }
  });

  const count = planets.length + giants.length + moons.length;
  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const color = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const kind = new Float32Array(count);
  const heat = new Float32Array(count);
  planets.forEach((p, i) => {
    color.set(model.colors.subarray(p.file * 3, p.file * 3 + 3), i * 3);
    seed[i] = rand(p.file, 21);
    heat[i] = p.heat;
  });
  const giantColors = giants.map((g) => folderColor(model, g.folder));
  giants.forEach((g, gi) => {
    const i = planets.length + gi;
    color.set(giantColors[gi], i * 3);
    seed[i] = rand(g.folder, 22);
    kind[i] = 1;
  });
  moons.forEach((mo, mi) => {
    const i = planets.length + giants.length + mi;
    const c = giantColors[mo.giant];
    color.set([0.55 + c[0] * 0.25, 0.55 + c[1] * 0.25, 0.55 + c[2] * 0.25], i * 3);
    seed[i] = rand(mi, 23);
    kind[i] = 2;
  });
  sphere.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
  sphere.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  sphere.setAttribute('aKind', new THREE.InstancedBufferAttribute(kind, 1));
  sphere.setAttribute('aHeat', new THREE.InstancedBufferAttribute(heat, 1));

  // Orbit paths: one line-segment soup for every planet and giant.
  const orbits = [...planets, ...giants];
  const pos = new Float32Array(orbits.length * ORBIT_SEGMENTS * 2 * 3);
  const alpha = new Float32Array(orbits.length * ORBIT_SEGMENTS * 2);
  orbits.forEach((o, oi) => {
    const still = { ...o, speed: 0 };
    for (let k = 0; k < ORBIT_SEGMENTS; k++) {
      for (let e = 0; e < 2; e++) {
        const a = ((k + e) / ORBIT_SEGMENTS) * Math.PI * 2;
        orbitPosition({ ...still, phase: a }, 0, p3);
        const j = (oi * ORBIT_SEGMENTS + k) * 2 + e;
        pos.set(p3, j * 3);
        alpha[j] = oi < planets.length ? 0.16 : 0.24;
      }
    }
  });
  const orbitGeo = new THREE.BufferGeometry();
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  orbitGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));

  // Asteroid belt.
  let beltGeo: THREE.BufferGeometry | null = null;
  if (sys.belt) {
    const n = Math.min(1600, Math.max(240, sys.belt.files.length * 8));
    const radius = new Float32Array(n);
    const angle = new Float32Array(n);
    const size = new Float32Array(n);
    const y = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = (rand(i, 31) + rand(i, 32)) / 2; // denser in the middle of the belt
      radius[i] = sys.belt.inner + (sys.belt.outer - sys.belt.inner) * t;
      angle[i] = rand(i, 33) * Math.PI * 2;
      size[i] = 0.12 + Math.pow(rand(i, 34), 3) * 0.4;
      y[i * 3 + 1] = (rand(i, 35) - 0.5) * 0.9;
    }
    beltGeo = new THREE.BufferGeometry();
    beltGeo.setAttribute('position', new THREE.BufferAttribute(y, 3));
    beltGeo.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
    beltGeo.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
    beltGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  }

  return {
    moons,
    count,
    sphere,
    orbitGeo,
    beltGeo,
    giantColors,
    sunColor: folderColor(model, sys.folder),
  };
}

const additive = (
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

/**
 * A folder seen up close as a solar system (layout in layout/system.ts). Picking and
 * labels work off `bodies`, the live position of every body, refreshed each frame.
 */
export function SystemView({ model, folder }: { model: SkyModel; folder: number }) {
  const { gl, size } = useThree();
  const dpr = useStore((s) => s.dpr);
  const sys = useMemo(() => systemFor(model, folder), [model, folder]);
  const built = useMemo(() => buildSystem(model, sys), [model, sys]);
  const inst = useRef<THREE.InstancedMesh>(null);
  const intro = useRef(0);
  const time = useRef(0);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);

  const mats = useMemo(() => {
    const sunCol = new THREE.Color(...built.sunColor);
    const sun = new THREE.ShaderMaterial({
      vertexShader: sunVertex,
      fragmentShader: sunFragment,
      uniforms: { uTime: { value: 0 }, uColor: { value: sunCol }, uIntro: { value: 0 } },
    });
    const corona = additive(coronaVertex, coronaFragment, {
      uTime: { value: 0 },
      uColor: { value: sunCol },
      uInner: { value: 1 / 6 },
      uSize: { value: sys.sunRadius * 6 },
      uIntro: { value: 0 },
    });
    const planet = new THREE.ShaderMaterial({
      vertexShader: planetVertex,
      fragmentShader: planetFragment,
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uSun: { value: new THREE.Vector3() } },
    });
    const orbit = additive(orbitVertex, orbitFragment, { uIntro: { value: 0 } });
    const belt = additive(beltVertex, beltFragment, {
      uTime: { value: 0 },
      uScale: { value: 1 },
      uPixelRatio: { value: 1 },
      uIntro: { value: 0 },
    });
    const rings = sys.giants.map((g, gi) =>
      additive(ringVertex, ringFragment, {
        uColor: { value: new THREE.Color(...built.giantColors[gi]) },
        uInner: { value: 1.35 / 2.4 },
        uSeed: { value: rand(g.folder, 24) },
        uIntro: { value: 0 },
      }),
    );
    rings.forEach((r) => (r.side = THREE.DoubleSide));
    return { sun, corona, planet, orbit, belt, rings };
  }, [built, sys]);

  const sunGeo = useMemo(() => new THREE.SphereGeometry(1, 64, 48), []);
  const quad = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(1.35, 2.4, 128, 1), []);

  useEffect(
    () => () => {
      built.sphere.dispose();
      built.orbitGeo.dispose();
      built.beltGeo?.dispose();
    },
    [built],
  );
  useEffect(
    () => () => {
      for (const m of [mats.sun, mats.corona, mats.planet, mats.orbit, mats.belt, ...mats.rings])
        m.dispose();
    },
    [mats],
  );
  useEffect(
    () => () => {
      sunGeo.dispose();
      quad.dispose();
      ringGeo.dispose();
    },
    [sunGeo, quad, ringGeo],
  );

  // Brighten the orbit of the selected planet.
  useEffect(() => {
    const attr = built.orbitGeo.getAttribute('aAlpha') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const apply = () => {
      const sel = useStore.getState().selection;
      const chosen = sel?.kind === 'file' ? sys.planets.findIndex((p) => p.file === sel.index) : -1;
      const all = sys.planets.length + sys.giants.length;
      for (let oi = 0; oi < all; oi++) {
        const a = oi === chosen ? 0.75 : oi < sys.planets.length ? 0.16 : 0.24;
        arr.fill(a, oi * ORBIT_SEGMENTS * 2, (oi + 1) * ORBIT_SEGMENTS * 2);
      }
      attr.needsUpdate = true;
    };
    apply();
    return useStore.subscribe((s, prev) => {
      if (s.selection !== prev.selection) apply();
    });
  }, [built, sys]);

  // Pointer: hover planets (tooltip), click to select, click a giant to warp deeper.
  const pointer = useRef({ x: 0, y: 0, inside: false });
  const down = useRef({ x: 0, y: 0, t: 0 });
  const hit = useRef<string | null>(null);
  useEffect(() => {
    const el = gl.domElement;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      pointer.current = { ...local(e), inside: true };
      useStore.getState().set({ pointer: { x: e.clientX, y: e.clientY } });
    };
    const onLeave = () => (pointer.current.inside = false);
    const onDown = (e: PointerEvent) => (down.current = { ...local(e), t: performance.now() });
    const onUp = (e: PointerEvent) => {
      const p = local(e);
      if (Math.hypot(p.x - down.current.x, p.y - down.current.y) > 5) return;
      if (performance.now() - down.current.t > 400) return;
      const h = hit.current;
      if (!h) clearSelection();
      else if (h === 'sun') selectFolder(folder, { fly: false });
      else if (h[0] === 'p') selectFile(Number(h.slice(1)));
      else if (h[0] === 'g') enterSystem(Number(h.slice(1)));
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.style.cursor = '';
    };
  }, [gl, folder]);

  useEffect(() => {
    bodies.clear();
    return () => {
      bodies.clear();
      useStore.getState().set({ hovered: -1 });
    };
  }, [sys]);

  useFrame((state, dt) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const { reducedMotion, warping } = useStore.getState();
    time.current += reducedMotion ? 0 : Math.min(dt, 0.05);
    const t = time.current;
    intro.current = Math.min(1, intro.current + dt / 0.6);
    const k = intro.current;
    for (const m of [mats.sun, mats.corona, mats.planet, mats.orbit, mats.belt, ...mats.rings])
      m.uniforms.uIntro.value = k;
    mats.sun.uniforms.uTime.value = state.clock.elapsedTime;
    mats.corona.uniforms.uTime.value = state.clock.elapsedTime;
    mats.planet.uniforms.uTime.value = t;
    mats.belt.uniforms.uTime.value = t;
    mats.belt.uniforms.uScale.value =
      size.height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    mats.belt.uniforms.uPixelRatio.value = dpr;

    // Move every body along its orbit; publish positions for picking and labels.
    const mesh = inst.current;
    bodies.set('sun', { pos: new THREE.Vector3(), radius: sys.sunRadius });
    const giantPos: THREE.Vector3[] = [];
    const place = (i: number, key: string, x: number, y: number, z: number, r: number) => {
      s3.setScalar(r);
      m4.compose(v.set(x, y, z), q, s3);
      mesh?.setMatrixAt(i, m4);
      const b = bodies.get(key);
      if (b) {
        b.pos.set(x, y, z);
        b.radius = r;
      } else bodies.set(key, { pos: new THREE.Vector3(x, y, z), radius: r });
    };
    sys.planets.forEach((p, i) => {
      orbitPosition(p, t, p3);
      place(i, `p${p.file}`, p3[0], p3[1], p3[2], p.radius);
    });
    sys.giants.forEach((g, gi) => {
      orbitPosition(g, t, p3);
      place(sys.planets.length + gi, `g${g.folder}`, p3[0], p3[1], p3[2], g.radius);
      giantPos.push(new THREE.Vector3(p3[0], p3[1], p3[2]));
    });
    built.moons.forEach((mo, mi) => {
      orbitPosition(mo, t, p3);
      const gp = giantPos[mo.giant];
      place(
        sys.planets.length + sys.giants.length + mi,
        `m${mi}`,
        gp.x + p3[0],
        gp.y + p3[1],
        gp.z + p3[2],
        mo.radius,
      );
    });
    if (mesh) mesh.instanceMatrix.needsUpdate = true;
    ringRefs.current.forEach((r, gi) => r && r.position.copy(giantPos[gi]));

    // Pick: the body whose disc on screen is nearest the pointer (with a little slack).
    const p = pointer.current;
    let best: string | null = null;
    if (p.inside && !warping && k > 0.9) {
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      let bestScore = Infinity;
      for (const [key, b] of bodies) {
        if (key[0] === 'm') continue;
        v.copy(b.pos).applyMatrix4(camera.matrixWorldInverse);
        const depth = -v.z;
        if (depth <= 0) continue;
        v.copy(b.pos).project(camera);
        const x = (v.x * 0.5 + 0.5) * size.width;
        const y = (-v.y * 0.5 + 0.5) * size.height;
        const rpx = (b.radius / (depth * tanHalf)) * (size.height / 2);
        const d = Math.hypot(x - p.x, y - p.y);
        const reach = Math.max(rpx, 7) + 6;
        if (d < reach && d / reach < bestScore) {
          bestScore = d / reach;
          best = key;
        }
      }
    }
    hit.current = best;
    const hoveredFile = best && best[0] === 'p' ? Number(best.slice(1)) : -1;
    if (hoveredFile !== useStore.getState().hovered)
      useStore.getState().set({ hovered: hoveredFile });
    gl.domElement.style.cursor = best ? 'pointer' : '';

    // DOM labels for the sun and giants.
    for (const [key, el] of systemLabelEls) {
      const b = bodies.get(key);
      if (!b) continue;
      v.copy(b.pos);
      v.y += b.radius * (key === 'sun' ? 1.25 : 1.6);
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      // Hidden (and unclickable) when behind the camera or off the edge of the screen.
      const on =
        v.z < 1 &&
        k > 0.6 &&
        !warping &&
        x > 30 &&
        x < size.width - 30 &&
        y > 70 &&
        y < size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = on ? '1' : '0';
      el.style.pointerEvents = on ? 'auto' : 'none';
      el.tabIndex = on ? 0 : -1;
      el.dataset.hot = best === key ? '1' : '0';
    }
  });

  return (
    <group>
      <mesh geometry={sunGeo} material={mats.sun} scale={sys.sunRadius} />
      <mesh geometry={quad} material={mats.corona} renderOrder={2} frustumCulled={false} />
      <instancedMesh
        ref={inst}
        args={[built.sphere, mats.planet, built.count]}
        frustumCulled={false}
      />
      {sys.giants.map((g, gi) => (
        <mesh
          key={g.folder}
          ref={(m) => {
            ringRefs.current[gi] = m;
          }}
          geometry={ringGeo}
          material={mats.rings[gi]}
          scale={g.radius}
          rotation={[Math.PI / 2 + g.ringTilt, 0, rand(g.folder, 25) * 0.6]}
          renderOrder={3}
        />
      ))}
      <lineSegments geometry={built.orbitGeo} material={mats.orbit} frustumCulled={false} />
      {built.beltGeo && (
        <points geometry={built.beltGeo} material={mats.belt} frustumCulled={false} />
      )}
    </group>
  );
}
