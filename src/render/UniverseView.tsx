import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorForLanguageName, hexToRgb } from '../layout/color';
import type { Universe } from '../layout/universe';
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

/**
 * The universe around the current repo (layout in layout/universe.ts): related projects
 * as spiral galaxies, contributors as bright stars, filaments between them. Hover to
 * name things, click to focus one; the panel offers to chart any galaxy.
 */
export function UniverseView({ universe }: { universe: Universe }) {
  const { gl, size, camera } = useThree();
  const dpr = useStore((s) => s.dpr);
  const focus = useStore((s) => s.universe?.focus ?? null);
  const galaxyMesh = useRef<THREE.InstancedMesh>(null);
  const hover = useRef<{ kind: 'galaxy' | 'person'; index: number } | null>(null);
  const pointer = useRef({ x: 0, y: 0, inside: false });
  const down = useRef({ x: 0, y: 0, t: 0 });
  const intro = useRef(0);

  const built = useMemo(() => {
    const { galaxies, people, links } = universe;
    // Galaxies: instanced disks, oriented by their normal, scaled by radius.
    const plane = new THREE.PlaneGeometry(2, 2);
    plane.rotateX(-Math.PI / 2);
    const color = new Float32Array(galaxies.length * 3);
    const seed = new Float32Array(galaxies.length);
    const glow = new THREE.InstancedBufferAttribute(new Float32Array(galaxies.length), 1);
    galaxies.forEach((g, i) => {
      color.set(hexToRgb(colorForLanguageName(g.language)), i * 3);
      seed[i] = g.seed;
    });
    plane.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    plane.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    plane.setAttribute('aGlow', glow);

    // People: points.
    const ppos = new Float32Array(people.length * 3);
    const psize = new Float32Array(people.length);
    const pglow = new THREE.BufferAttribute(new Float32Array(people.length), 1);
    const maxC = Math.max(1, ...people.map((p) => p.contributions));
    people.forEach((p, i) => {
      ppos.set(p.pos, i * 3);
      psize[i] = 16 + 18 * Math.sqrt(p.contributions / maxC);
    });
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
    pgeo.setAttribute('aSize', new THREE.BufferAttribute(psize, 1));
    pgeo.setAttribute('aGlow', pglow);

    // Filaments.
    const lpos = new Float32Array(links.length * 6);
    const lt = new Float32Array(links.length * 2);
    const ls = new Float32Array(links.length * 2);
    const lseed = new Float32Array(links.length * 2);
    links.forEach((l, i) => {
      lpos.set(l.from, i * 6);
      lpos.set(l.to, i * 6 + 3);
      lt[i * 2 + 1] = 1;
      ls[i * 2] = ls[i * 2 + 1] = l.strength;
      lseed[i * 2] = lseed[i * 2 + 1] = (i * 0.618) % 1;
    });
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    lgeo.setAttribute('aT', new THREE.BufferAttribute(lt, 1));
    lgeo.setAttribute('aStrength', new THREE.BufferAttribute(ls, 1));
    lgeo.setAttribute('aSeed', new THREE.BufferAttribute(lseed, 1));
    return { plane, glow, pgeo, pglow, lgeo };
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

  // Place every galaxy once.
  useEffect(() => {
    const mesh = galaxyMesh.current;
    if (!mesh) return;
    universe.galaxies.forEach((g, i) => {
      q.setFromUnitVectors(UP, v.set(...g.normal));
      m4.compose(v.set(...g.pos), q, s3.setScalar(g.radius));
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [universe]);

  // Frame the whole universe, slowly turning.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.dispatchEvent({ type: 'start' });
    const d = universe.extent * 1.15 + 30;
    const elev = THREE.MathUtils.degToRad(30);
    camera.position.set(0, Math.sin(elev) * d, Math.cos(elev) * d);
    controls.target.set(0, 0, 0);
    controls.maxDistance = d * 3;
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
    const home = focus.kind === 'galaxy' && focus.index === 0;
    useStore.getState().fly(pos, home ? universe.extent * 1.15 + 30 : Math.max(40, r * 5));
  }, [focus, universe]);

  // Glow for hovered/focused things.
  useEffect(() => {
    const g = built.glow.array as Float32Array;
    const p = built.pglow.array as Float32Array;
    g.fill(0);
    p.fill(0);
    if (focus?.kind === 'galaxy') g[focus.index] = 1;
    if (focus?.kind === 'person') p[focus.index] = 1;
    built.glow.needsUpdate = true;
    built.pglow.needsUpdate = true;
  }, [focus, built]);

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

    // Project everything once: for picking and for the labels.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const px = pointer.current;
    let best: typeof hover.current = null;
    let bestScore = Infinity;
    const project = (pos: [number, number, number], radius: number) => {
      v.set(...pos).applyMatrix4(cam.matrixWorldInverse);
      const depth = -v.z;
      v.set(...pos).project(cam);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      const rpx = depth > 0 ? (radius / (depth * tanHalf)) * (size.height / 2) : 0;
      return { x, y, rpx, on: depth > 0 && v.z < 1 };
    };
    const gScreen = universe.galaxies.map((g) => project(g.pos, g.radius));
    const pScreen = universe.people.map((p) => project(p.pos, 2));
    const consider = (
      kind: 'galaxy' | 'person',
      i: number,
      s: { x: number; y: number; rpx: number; on: boolean },
    ) => {
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

    // Labels, placed in priority order (home, hovered/focused, people, then galaxies by
    // stars); a label that would overlap one already placed waits for a better angle.
    const f = useStore.getState().universe?.focus;
    const hv = hover.current as { kind: 'galaxy' | 'person'; index: number } | null;
    const isHot = (kind: 'galaxy' | 'person', i: number) =>
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
      const hot = isHot('galaxy', i);
      const g = universe.galaxies[i];
      cands.push({
        el,
        s,
        hot,
        rank: g.home ? 0 : hot ? 1 : 3 + 1 / (1 + g.stars),
        dy: Math.min(s.rpx * 0.6, 60),
      });
    });
    pScreen.forEach((s, i) => {
      const el = universeLabels.people[i];
      if (!el) return;
      const hot = isHot('person', i);
      cands.push({ el, s, hot, rank: hot ? 1 : 2, dy: 0 });
    });
    cands.sort((a, b) => a.rank - b.rank);
    const placed: [number, number, number, number][] = [];
    for (const c of cands) {
      const { el, s } = c;
      let on = s.on && s.x > 20 && s.x < size.width - 20 && s.y > 70 && s.y < size.height - 10;
      const y = s.y - c.dy;
      if (on) {
        const w =
          Number(el.dataset.w) ||
          ((el.dataset.w = String(el.offsetWidth || 120)), Number(el.dataset.w));
        const person = el.classList.contains('u-label--person');
        const box: [number, number, number, number] = person
          ? [s.x + 10, y - 11, s.x + 14 + w, y + 11]
          : [s.x - w / 2, y - 22, s.x + w / 2, y];
        for (const b of placed) {
          if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) {
            on = c.hot; // hovered or focused labels always show
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
        ref={galaxyMesh}
        args={[built.plane, mats.galaxy, universe.galaxies.length]}
        frustumCulled={false}
      />
      <points geometry={built.pgeo} material={mats.person} frustumCulled={false} />
    </group>
  );
}
