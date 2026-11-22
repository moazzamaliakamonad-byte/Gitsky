import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  coreSeparation,
  setupCollision,
  sharedPaths,
  stepCollision,
  type Collision,
} from '../layout/collision';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import { starFragment } from './shaders';
import {
  collisionVertex,
  coronaFragment,
  coronaVertex,
  threadFragment,
  threadVertex,
} from './systemShaders';
import { controlsRef } from './sceneRefs';
import { densityExposure } from './exposure';
import { collisionClock } from './collisionClock';

/** Simulated seconds per real second. The whole story plays in about half a minute. */
const SPEED = 2.2;
const DT = 0.05;
/** Stars simulated per galaxy. Fixed, so a quality change never restarts the story. */
const CAP = 12000;
const v = new THREE.Vector3();

/**
 * Two galaxies colliding (simulation in layout/collision.ts). The CPU integrates every
 * star each frame and the position buffer is re-uploaded; colours, sizes and brightness
 * come from each repo's own model, so both galaxies keep their identity as they merge.
 */
export function CollisionView({ a, b }: { a: SkyModel; b: SkyModel }) {
  const { size, camera } = useThree();
  const dpr = useStore((s) => s.dpr);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const sim = useRef<Collision | null>(null);
  const acc = useRef(0);

  const built = useMemo(() => {
    const s = setupCollision(
      { positions: a.layout.positions, count: a.data.files.length, extent: a.layout.extent },
      { positions: b.layout.positions, count: b.data.files.length, extent: b.layout.extent },
      { cap: CAP },
    );
    const models = [a, b];
    const color = new Float32Array(s.n * 3);
    const sizeAttr = new Float32Array(s.n);
    const bright = new Float32Array(s.n);
    const shared = new Float32Array(s.n);
    // Star index of each sampled file, per galaxy, for the shared-path threads.
    const starOf = [new Map<number, number>(), new Map<number, number>()];
    for (let k = 0; k < s.n; k++) {
      const m = models[s.galaxy[k]];
      const f = s.file[k];
      color.set(m.colors.subarray(f * 3, f * 3 + 3), k * 3);
      sizeAttr[k] = m.sizes[f];
      bright[k] = m.churn.brightness[f];
      starOf[s.galaxy[k]].set(f, k);
    }
    const pairs: [number, number][] = [];
    for (const [fa, fb] of sharedPaths(a.data.files, b.data.files, 300)) {
      const ka = starOf[0].get(fa);
      const kb = starOf[1].get(fb);
      if (ka !== undefined && kb !== undefined) {
        pairs.push([ka, kb]);
        shared[ka] = 1;
        shared[kb] = 1;
      }
    }
    const g = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(s.pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', posAttr);
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizeAttr, 1));
    g.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    g.setAttribute('aShared', new THREE.BufferAttribute(shared, 1));

    const tpos = new Float32Array(Math.max(1, pairs.length) * 2 * 3);
    const tend = new Float32Array(Math.max(1, pairs.length) * 2);
    for (let p = 0; p < pairs.length; p++) tend[p * 2 + 1] = 1;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute(
      'position',
      new THREE.BufferAttribute(tpos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    tg.setAttribute('aEnd', new THREE.BufferAttribute(tend, 1));
    tg.setDrawRange(0, pairs.length * 2);
    return { s, g, posAttr, pairs, tg, tpos };
  }, [a, b]);

  const mats = useMemo(() => {
    const stars = new THREE.ShaderMaterial({
      vertexShader: collisionVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uScale: { value: 1 },
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        uExposure: { value: 1 },
        uTouch: { value: 0 },
        uIntro: { value: 0 },
        uReach: { value: 1 },
        // A soft halo around every star gives each disk a glowing body.
        uHalo: { value: 1 },
      },
    });
    const threads = new THREE.ShaderMaterial({
      vertexShader: threadVertex,
      fragmentShader: threadFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 } },
    });
    const core = (color: string, r: number) =>
      new THREE.ShaderMaterial({
        vertexShader: coronaVertex,
        fragmentShader: coronaFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uInner: { value: 0.02 },
          uSize: { value: r },
          uIntro: { value: 0 },
        },
      });
    return {
      stars,
      threads,
      cores: [core('#ffd8a8', a.layout.extent * 0.32), core('#cfe0ff', b.layout.extent * 0.32)],
    };
  }, [a, b]);
  const quad = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const coreRefs = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(
    () => () => {
      built.g.dispose();
      built.tg.dispose();
    },
    [built],
  );
  useEffect(
    () => () => {
      mats.stars.dispose();
      mats.threads.dispose();
      mats.cores.forEach((m) => m.dispose());
      quad.dispose();
    },
    [mats, quad],
  );

  // Start (or restart) the story, and frame both galaxies from above at an angle.
  useEffect(() => {
    sim.current = built.s;
    acc.current = 0;
    collisionClock.reset = false;
    collisionClock.t = 0;
    const controls = controlsRef.current;
    if (controls) {
      controls.dispatchEvent({ type: 'start' }); // cancel the galaxy's intro flight
      const d = built.s.scale * 2.15;
      const elev = THREE.MathUtils.degToRad(48);
      camera.position.set(0, Math.sin(elev) * d, Math.cos(elev) * d);
      controls.target.set(0, 0, 0);
      controls.maxDistance = d * 4;
      controls.autoRotate = !reducedMotion;
      controls.update();
    }
    // Reduced motion: jump straight to the tidal tails and hold there.
    if (reducedMotion) {
      for (let t = 0; t < 18; t += DT) stepCollision(built.s, DT);
      built.posAttr.needsUpdate = true;
    }
    // Each galaxy is as dense as it was alone; only overlap adds up.
    const n = Math.max(a.data.files.length, b.data.files.length);
    mats.stars.uniforms.uExposure.value = Math.min(1, densityExposure(n) * 1.3);
    mats.stars.uniforms.uReach.value = built.s.scale * 2;
    return () => {
      const c = controlsRef.current;
      if (c) c.autoRotate = false;
    };
  }, [built, camera, reducedMotion, a, b, mats]);

  useFrame((state, dt) => {
    const s = sim.current;
    if (!s) return;
    if (collisionClock.reset) {
      // Replay: rebuild from the original layouts.
      const fresh = setupCollision(
        { positions: a.layout.positions, count: a.data.files.length, extent: a.layout.extent },
        { positions: b.layout.positions, count: b.data.files.length, extent: b.layout.extent },
        { cap: CAP },
      );
      s.pos.set(fresh.pos);
      s.vel.set(fresh.vel);
      s.corePos.set(fresh.corePos);
      s.coreVel.set(fresh.coreVel);
      s.t = 0;
      acc.current = 0;
      collisionClock.reset = false;
      collisionClock.playing = !reducedMotion;
    }
    if (collisionClock.playing) {
      acc.current += Math.min(dt, 0.05) * SPEED;
      let steps = 0;
      while (acc.current >= DT && steps < 4) {
        stepCollision(s, DT);
        acc.current -= DT;
        steps++;
      }
      if (steps > 0) built.posAttr.needsUpdate = true;
    }
    collisionClock.t = s.t;
    const sep = coreSeparation(s);
    collisionClock.separation = sep / s.scale;

    const touch = THREE.MathUtils.smoothstep(sep, s.scale * 1.3, s.scale * 0.45);
    const u = mats.stars.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uTouch.value = touch;
    u.uIntro.value = Math.min(1, u.uIntro.value + dt / 0.8);
    u.uPixelRatio.value = dpr;
    u.uScale.value =
      size.height /
      2 /
      Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2));

    // Threads between shared paths, shown while the galaxies interact.
    mats.threads.uniforms.uOpacity.value = touch * 0.55;
    if (touch > 0.01) {
      const { tpos, pairs } = built;
      for (let p = 0; p < pairs.length; p++) {
        const [ka, kb] = pairs[p];
        tpos.set(s.pos.subarray(ka * 3, ka * 3 + 3), p * 6);
        tpos.set(s.pos.subarray(kb * 3, kb * 3 + 3), p * 6 + 3);
      }
      (built.tg.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    // Core glows follow the cores; their labels too.
    for (let gi = 0; gi < 2; gi++) {
      const m = coreRefs.current[gi];
      if (m) m.position.set(s.corePos[gi * 3], s.corePos[gi * 3 + 1], s.corePos[gi * 3 + 2]);
      mats.cores[gi].uniforms.uIntro.value = u.uIntro.value * 0.55;
      mats.cores[gi].uniforms.uTime.value = state.clock.elapsedTime;
      const el = collisionClock.labels[gi];
      if (el) {
        v.set(s.corePos[gi * 3], s.corePos[gi * 3 + 1], s.corePos[gi * 3 + 2]).project(camera);
        const x = (v.x * 0.5 + 0.5) * size.width;
        const y = (-v.y * 0.5 + 0.5) * size.height;
        const on = v.z < 1 && sep > s.scale * 0.35;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - 28).toFixed(1)}px, 0)`;
        el.style.opacity = on ? '1' : '0';
      }
    }
  });

  return (
    <group>
      <points geometry={built.g} material={mats.stars} frustumCulled={false} />
      {built.pairs.length > 0 && (
        <lineSegments geometry={built.tg} material={mats.threads} frustumCulled={false} />
      )}
      {mats.cores.map((m, gi) => (
        <mesh
          key={gi}
          ref={(el) => {
            coreRefs.current[gi] = el;
          }}
          geometry={quad}
          material={m}
          frustumCulled={false}
          renderOrder={-1}
        />
      ))}
    </group>
  );
}
