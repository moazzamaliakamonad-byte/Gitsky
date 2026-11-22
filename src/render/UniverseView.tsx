import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorForLanguageName, hexToRgb } from '../layout/color';
import type { Universe, Vec3 } from '../layout/universeGraph';
import { useStore } from '../state/store';
import { controlsRef } from './sceneRefs';
import { universeLabels } from './universeLabels';
import {
  uGalaxyFragment,
  uGalaxyVertex,
  uLinkFragment,
  uLinkVertex,
  uPersonFragment,
  uPersonVertex,
} from './universeShaders';

const v = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const GROW_SECONDS = 1.6;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

type Focus = { kind: 'galaxy' | 'person'; index: number };

/**
 * The universe (graph in layout/universeGraph.ts): projects as spiral galaxies, people
 * as stars (bridges in gold), filaments between them. When the map grows, new nodes
 * bloom out of the node that was expanded and existing ones glide to their new places.
 */
export function UniverseView({ universe }: { universe: Universe }) {
  const { gl, size, camera } = useThree();
  const dpr = useStore((s) => s.dpr);
  const focus = useStore((s) => s.universe?.focus ?? null);
  const languages = useStore((s) => s.universe?.languages ?? null);
  const galaxyMesh = useRef<THREE.InstancedMesh>(null);
  const hover = useRef<Focus | null>(null);
  const pointer = useRef({ x: 0, y: 0, inside: false });
  const down = useRef({ x: 0, y: 0, t: 0 });
  const intro = useRef(0);
  const framed = useRef(false);
  // Where every node was last drawn, by key: the start of the next growth animation.
  const drawn = useRef(new Map<string, Vec3>());
  const grow = useRef({ t: 1, from: new Map<string, Vec3>(), origin: [0, 0, 0] as Vec3 });

  const built = useMemo(() => {
    const { galaxies, people, links } = universe;
    const plane = new THREE.PlaneGeometry(2, 2);
    plane.rotateX(-Math.PI / 2);
    const color = new Float32Array(galaxies.length * 3);
    const seed = new Float32Array(galaxies.length);
    const activity = new Float32Array(galaxies.length);
    galaxies.forEach((g, i) => {
      color.set(hexToRgb(colorForLanguageName(g.language)), i * 3);
      seed[i] = g.seed;
      activity[i] = g.activity;
    });
    const glow = new THREE.InstancedBufferAttribute(new Float32Array(galaxies.length), 1);
    const dim = new THREE.InstancedBufferAttribute(new Float32Array(galaxies.length), 1);
    plane.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    plane.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    plane.setAttribute('aActivity', new THREE.InstancedBufferAttribute(activity, 1));
    plane.setAttribute('aGlow', glow);
    plane.setAttribute('aDim', dim);

    const ppos = new THREE.BufferAttribute(new Float32Array(people.length * 3), 3);
    const psize = new Float32Array(people.length);
    const pbridge = new Float32Array(people.length);
    const pglow = new THREE.BufferAttribute(new Float32Array(people.length), 1);
    const maxC = Math.max(1, ...people.map((p) => p.contributions));
    people.forEach((p, i) => {
      psize[i] = 15 + 18 * Math.sqrt(p.contributions / maxC) + (p.bridge ? 8 : 0);
      pbridge[i] = p.bridge ? 1 : 0;
    });
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', ppos);
    pgeo.setAttribute('aSize', new THREE.BufferAttribute(psize, 1));
    pgeo.setAttribute('aBridge', new THREE.BufferAttribute(pbridge, 1));
    pgeo.setAttribute('aGlow', pglow);

    const lpos = new THREE.BufferAttribute(new Float32Array(links.length * 6), 3);
    const lt = new Float32Array(links.length * 2);
    const ls = new Float32Array(links.length * 2);
    const lseed = new Float32Array(links.length * 2);
    links.forEach((l, i) => {
      lt[i * 2 + 1] = 1;
      ls[i * 2] = ls[i * 2 + 1] = l.strength;
      lseed[i * 2] = lseed[i * 2 + 1] = (i * 0.618) % 1;
    });
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', lpos);
    lgeo.setAttribute('aT', new THREE.BufferAttribute(lt, 1));
    lgeo.setAttribute('aStrength', new THREE.BufferAttribute(ls, 1));
    lgeo.setAttribute('aSeed', new THREE.BufferAttribute(lseed, 1));
    return { plane, glow, dim, ppos, pgeo, pglow, lpos, lgeo };
  }, [universe]);

  const mats = useMemo(() => {
    const add = (vs: string, fs: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: vs,
        fragmentShader: fs,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
    return {
      galaxy: add(uGalaxyVertex, uGalaxyFragment, { uTime: { value: 0 }, uIntro: { value: 0 } }),
      person: add(uPersonVertex, uPersonFragment, {
        uPixelRatio: { value: 1 },
        uIntro: { value: 0 },
      }),
      link: add(uLinkVertex, uLinkFragment, { uTime: { value: 0 }, uIntro: { value: 0 } }),
    };
  }, []);

  useEffect(
    () => () => {
      built.plane.dispose();
      built.pgeo.dispose();
      built.lgeo.dispose();
    },
    [built],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  // A new layout: grow toward it from wherever things were drawn. New nodes start at the
  // focused node (the one that was expanded), so they bloom out of it.
  useEffect(() => {
    const f = useStore.getState().universe?.focus;
    const key = f
      ? f.kind === 'galaxy'
        ? universe.galaxies[f.index]?.key
        : universe.people[f.index]?.key
      : undefined;
    const origin: Vec3 = (key && drawn.current.get(key)) || [0, 0, 0];
    grow.current = { t: drawn.current.size ? 0 : 1, from: new Map(drawn.current), origin };
  }, [universe]);

  // Frame the whole universe once, slowly turning.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || framed.current) return;
    framed.current = true;
    controls.dispatchEvent({ type: 'start' });
    const d = universe.extent * 1.15 + 30;
    const elev = THREE.MathUtils.degToRad(30);
    camera.position.set(0, Math.sin(elev) * d, Math.cos(elev) * d);
    controls.target.set(0, 0, 0);
    controls.maxDistance = d * 4;
    controls.autoRotate = !useStore.getState().reducedMotion;
    controls.update();
  }, [universe, camera]);

  // Fly to whatever gets focused.
  useEffect(() => {
    if (!focus) return;
    const pos =
      focus.kind === 'galaxy'
        ? universe.galaxies[focus.index]?.pos
        : universe.people[focus.index]?.pos;
    if (!pos) return;
    const r = focus.kind === 'galaxy' ? universe.galaxies[focus.index].radius : 6;
    const home = focus.kind === 'galaxy' && universe.galaxies[focus.index].home;
    useStore.getState().fly(pos, home ? universe.extent * 1.15 + 30 : Math.max(45, r * 5));
  }, [focus, universe]);

  // Glow for the focused node; dim galaxies outside the language filter.
  useEffect(() => {
    const g = built.glow.array as Float32Array;
    const p = built.pglow.array as Float32Array;
    g.fill(0);
    p.fill(0);
    if (focus?.kind === 'galaxy') g[focus.index] = 1;
    if (focus?.kind === 'person') p[focus.index] = 1;
    built.glow.needsUpdate = true;
    built.pglow.needsUpdate = true;
    const dim = built.dim.array as Float32Array;
    universe.galaxies.forEach((x, i) => {
      dim[i] = languages && !languages.includes(x.language ?? '') ? 1 : 0;
    });
    built.dim.needsUpdate = true;
  }, [focus, languages, built, universe]);

  useEffect(() => {
    const el = gl.domElement;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => (pointer.current = { ...local(e), inside: true });
    const onLeave = () => (pointer.current.inside = false);
    const onDown = (e: PointerEvent) => (down.current = { ...local(e), t: performance.now() });
    const onUp = (e: PointerEvent) => {
      const p = local(e);
      if (Math.hypot(p.x - down.current.x, p.y - down.current.y) > 5) return;
      if (performance.now() - down.current.t > 400) return;
      const u = useStore.getState().universe;
      if (u && hover.current) useStore.getState().set({ universe: { ...u, focus: hover.current } });
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
      const c = controlsRef.current;
      if (c) c.autoRotate = false;
    };
  }, [gl]);

  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    intro.current = Math.min(1, intro.current + dt / 1.2);
    const t = useStore.getState().reducedMotion ? 0 : state.clock.elapsedTime;
    for (const m of Object.values(mats)) m.uniforms.uIntro.value = intro.current;
    mats.galaxy.uniforms.uTime.value = t;
    mats.link.uniforms.uTime.value = t;
    mats.person.uniforms.uPixelRatio.value = dpr;

    // Positions this frame: mid-growth they're eased from where they were drawn.
    const gr = grow.current;
    const animating = gr.t < 1;
    if (animating)
      gr.t = useStore.getState().reducedMotion ? 1 : Math.min(1, gr.t + dt / GROW_SECONDS);
    const k = easeOut(gr.t);
    const at = (key: string, target: Vec3): Vec3 => {
      if (k >= 1) return target;
      const from = gr.from.get(key) ?? gr.origin;
      return [
        from[0] + (target[0] - from[0]) * k,
        from[1] + (target[1] - from[1]) * k,
        from[2] + (target[2] - from[2]) * k,
      ];
    };
    const gPos = universe.galaxies.map((g) => at(g.key, g.pos));
    const pPos = universe.people.map((p) => at(p.key, p.pos));
    const mesh = galaxyMesh.current;
    if (mesh && (animating || mesh.userData.u !== universe)) {
      mesh.userData.u = universe;
      universe.galaxies.forEach((g, i) => {
        q.setFromUnitVectors(UP, v.set(...g.normal));
        // New galaxies also grow in size as they arrive.
        const grown = gr.from.has(g.key) || k >= 1 ? 1 : Math.max(0.05, k);
        m4.compose(v.set(...gPos[i]), q, s3.setScalar(g.radius * grown));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      pPos.forEach((p, i) => built.ppos.setXYZ(i, p[0], p[1], p[2]));
      built.ppos.needsUpdate = true;
      universe.links.forEach((l, i) => {
        const a = pPos[l.person];
        const b = gPos[l.galaxy];
        built.lpos.setXYZ(i * 2, a[0], a[1], a[2]);
        built.lpos.setXYZ(i * 2 + 1, b[0], b[1], b[2]);
      });
      built.lpos.needsUpdate = true;
      universe.galaxies.forEach((g, i) => drawn.current.set(g.key, gPos[i]));
      universe.people.forEach((p, i) => drawn.current.set(p.key, pPos[i]));
    }

    // Project everything: for picking and for the labels.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const px = pointer.current;
    let best: Focus | null = null;
    let bestScore = Infinity;
    const project = (pos: Vec3, radius: number) => {
      v.set(...pos).applyMatrix4(cam.matrixWorldInverse);
      const depth = -v.z;
      v.set(...pos).project(cam);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      const rpx = depth > 0 ? (radius / (depth * tanHalf)) * (size.height / 2) : 0;
      return { x, y, rpx, on: depth > 0 && v.z < 1 };
    };
    const gScreen = gPos.map((p, i) => project(p, universe.galaxies[i].radius));
    const pScreen = pPos.map((p) => project(p, 2));
    const consider = (kind: Focus['kind'], i: number, s: (typeof gScreen)[number]) => {
      if (!s.on || !px.inside) return;
      const reach = Math.max(s.rpx * 0.8, kind === 'person' ? 12 : 10) + 4;
      const d = Math.hypot(s.x - px.x, s.y - px.y);
      if (d < reach && d / reach < bestScore) {
        bestScore = d / reach;
        best = { kind, index: i };
      }
    };
    gScreen.forEach((s, i) => consider('galaxy', i, s));
    pScreen.forEach((s, i) => consider('person', i, s));
    hover.current = best;
    gl.domElement.style.cursor = best ? 'pointer' : '';

    // Labels in priority order (home, hovered/focused, bridges, people, galaxies by
    // stars); one that would overlap an already-placed label waits for a better angle.
    const f = useStore.getState().universe?.focus;
    const hv = hover.current as Focus | null;
    const isHot = (kind: Focus['kind'], i: number) =>
      (hv?.kind === kind && hv.index === i) || (f?.kind === kind && f.index === i);
    type Cand = {
      el: HTMLElement;
      s: (typeof gScreen)[number];
      hot: boolean;
      rank: number;
      dy: number;
    };
    const cands: Cand[] = [];
    gScreen.forEach((s, i) => {
      const el = universeLabels.galaxies[i];
      if (!el) return;
      const g = universe.galaxies[i];
      const hot = isHot('galaxy', i);
      const dimmed = languages !== null && !languages.includes(g.language ?? '');
      cands.push({
        el,
        s,
        hot,
        rank: g.home ? 0 : hot ? 1 : dimmed ? 9 : 4 + 1 / (1 + g.stars),
        dy: Math.min(s.rpx * 0.6, 60),
      });
    });
    pScreen.forEach((s, i) => {
      const el = universeLabels.people[i];
      if (!el) return;
      const hot = isHot('person', i);
      cands.push({ el, s, hot, rank: hot ? 1 : universe.people[i].bridge ? 2 : 3, dy: 0 });
    });
    cands.sort((a, b) => a.rank - b.rank);
    const placed: [number, number, number, number][] = [];
    for (const c of cands) {
      const { el, s } = c;
      let on =
        (c.rank < 9 || c.hot) &&
        s.on &&
        s.x > 20 &&
        s.x < size.width - 20 &&
        s.y > 70 &&
        s.y < size.height - 10;
      const y = s.y - c.dy;
      if (on) {
        if (!el.dataset.w) el.dataset.w = String(el.offsetWidth || 120);
        const w = Number(el.dataset.w);
        const person = el.classList.contains('u-label--person');
        const box: [number, number, number, number] = person
          ? [s.x + 10, y - 11, s.x + 14 + w, y + 11]
          : [s.x - w / 2, y - 22, s.x + w / 2, y];
        for (const b of placed) {
          if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) {
            on = c.hot;
            break;
          }
        }
        if (on) placed.push(box);
      }
      el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = on ? (c.hot ? '1' : '0.85') : '0';
      el.style.pointerEvents = on ? 'auto' : 'none';
      el.dataset.hot = c.hot ? '1' : '0';
    }
  });

  return (
    <group>
      <lineSegments geometry={built.lgeo} material={mats.link} frustumCulled={false} />
      <instancedMesh
        key={universe.galaxies.length}
        ref={galaxyMesh}
        args={[built.plane, mats.galaxy, universe.galaxies.length]}
        frustumCulled={false}
      />
      <points geometry={built.pgeo} material={mats.person} frustumCulled={false} />
    </group>
  );
}
