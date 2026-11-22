/**
 * Two galaxies colliding, as a restricted three-body simulation (the method Toomre &
 * Toomre used in 1972 to explain tidal tails): each galaxy's mass sits in a softened
 * point at its core, the two cores orbit each other, and every file is a massless test
 * particle pulled by both cores. Tails and bridges emerge on their own.
 *
 * Units are world units and seconds of simulation time. Explained in
 * learn/concepts/galaxy-collisions.md.
 */
export interface GalaxyInput {
  positions: Float32Array;
  count: number;
  /** The galaxy's radius (layout extent). */
  extent: number;
}

export interface Collision {
  n: number;
  /** Positions and velocities of every star, xyz interleaved. */
  pos: Float32Array;
  vel: Float32Array;
  /** Which galaxy each star belongs to (0 or 1). */
  galaxy: Uint8Array;
  /** Index into that galaxy's file list. */
  file: Uint32Array;
  /** Core positions and velocities: [x, y, z] for core 0 then core 1. */
  corePos: Float64Array;
  coreVel: Float64Array;
  mass: [number, number];
  soft: [number, number];
  g: number;
  /** Combined radii, the natural length scale of the encounter. */
  scale: number;
  t: number;
}

export interface CollisionOptions {
  /** At most this many stars per galaxy are simulated (a deterministic stride sample). */
  cap?: number;
  /** Tilt of galaxy B's disk relative to A's, radians. */
  tilt?: number;
}

/** Orbital period, in sim seconds, at the edge of the larger galaxy's disk. */
const PERIOD = 24;
/** Softening as a fraction of radius: inner disks turn almost rigidly (keeping their
 *  folder structure), outer stars orbit freely and feel the tides. */
const SOFT = 0.5;

export function setupCollision(
  a: GalaxyInput,
  b: GalaxyInput,
  opts: CollisionOptions = {},
): Collision {
  const cap = opts.cap ?? 16000;
  const tilt = opts.tilt ?? 0.75;
  const pick = (g: GalaxyInput) => {
    const step = Math.max(1, g.count / cap);
    const out: number[] = [];
    for (let k = 0; k < g.count / step; k++) out.push(Math.floor(k * step));
    return out;
  };
  const ia = pick(a);
  const ib = pick(b);
  const n = ia.length + ib.length;

  // Mass grows with size (sqrt of file count), normalised so the pair weighs 2.
  const ma = Math.sqrt(Math.max(1, a.count));
  const mb = Math.sqrt(Math.max(1, b.count));
  const mass: [number, number] = [(2 * ma) / (ma + mb), (2 * mb) / (ma + mb)];
  const ra = Math.max(4, a.extent);
  const rb = Math.max(4, b.extent);
  const soft: [number, number] = [ra * SOFT, rb * SOFT];
  const scale = ra + rb;

  // G chosen so a star at the edge of the bigger disk orbits in PERIOD seconds:
  // v² = G M R² / (R² + ε²)^1.5 and v = 2πR / PERIOD.
  const big = ra >= rb ? 0 : 1;
  const R = big === 0 ? ra : rb;
  const vEdge = (2 * Math.PI * R) / PERIOD;
  const g = (vEdge * vEdge * Math.pow(R * R + soft[big] * soft[big], 1.5)) / (mass[big] * R * R);

  // Cores: a slightly bound, near-parabolic, prograde encounter in the xz plane.
  const M = mass[0] + mass[1];
  const d0 = scale * 1.7;
  const rp = scale * 0.5;
  const L = Math.sqrt(2 * g * M * rp);
  const v0 = Math.sqrt((2 * g * M) / d0) * 0.97;
  const vt = Math.min(v0 * 0.99, L / d0);
  const vr = Math.sqrt(Math.max(0, v0 * v0 - vt * vt));
  // Relative position b - a = (d0, 0, 0); relative velocity (-vr, 0, vt).
  const fa = mass[1] / M;
  const fb = mass[0] / M;
  const corePos = new Float64Array([-d0 * fa, 0, 0, d0 * fb, 0, 0]);
  const coreVel = new Float64Array([vr * fa, 0, -vt * fa, -vr * fb, 0, vt * fb]);

  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const galaxy = new Uint8Array(n);
  const file = new Uint32Array(n);
  // B's spin axis: tilted away from A's (y) around the x axis.
  const axisB = [0, Math.cos(tilt), Math.sin(tilt)];
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);

  let k = 0;
  const place = (gi: 0 | 1, src: GalaxyInput, idx: number[]) => {
    const axis = gi === 0 ? [0, 1, 0] : axisB;
    for (const i of idx) {
      const x = src.positions[i * 3];
      let y = src.positions[i * 3 + 1];
      let z = src.positions[i * 3 + 2];
      if (gi === 1) {
        // Tilt B's disk: rotate around the x axis.
        const y2 = y * c - z * s;
        const z2 = y * s + z * c;
        y = y2;
        z = z2;
      }
      // Circular speed in a Plummer potential: v² = G M r² / (r² + ε²)^1.5.
      const r2 = x * x + y * y + z * z;
      const e2 = soft[gi] * soft[gi];
      const v = Math.sqrt((g * mass[gi] * r2) / Math.pow(r2 + e2, 1.5));
      // Direction: axis × r̂ (prograde with the encounter).
      let tx = axis[1] * z - axis[2] * y;
      let ty = axis[2] * x - axis[0] * z;
      let tz = axis[0] * y - axis[1] * x;
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      const o = gi * 3;
      pos[k * 3] = x + corePos[o];
      pos[k * 3 + 1] = y + corePos[o + 1];
      pos[k * 3 + 2] = z + corePos[o + 2];
      // Spin opposite to how the cores swing past each other (−z for +x): prograde.
      vel[k * 3] = -tx * v + coreVel[o];
      vel[k * 3 + 1] = -ty * v + coreVel[o + 1];
      vel[k * 3 + 2] = -tz * v + coreVel[o + 2];
      galaxy[k] = gi;
      file[k] = i;
      k++;
    }
  };
  place(0, a, ia);
  place(1, b, ib);

  return { n, pos, vel, galaxy, file, corePos, coreVel, mass, soft, g, scale, t: 0 };
}

const acc = new Float64Array(6);

/** Core-on-core acceleration, plus dynamical friction so the pair eventually merges. */
function coreAccel(s: Collision) {
  const dx = s.corePos[3] - s.corePos[0];
  const dy = s.corePos[4] - s.corePos[1];
  const dz = s.corePos[5] - s.corePos[2];
  const e2 = s.soft[0] * s.soft[0] + s.soft[1] * s.soft[1];
  const r2 = dx * dx + dy * dy + dz * dz;
  const inv = s.g / Math.pow(r2 + e2 * 0.5, 1.5);
  // Friction: the cores lose relative speed while they overlap.
  const near = Math.exp(-r2 / (s.scale * s.scale * 0.5));
  const fr = 0.1 * near;
  const rvx = s.coreVel[3] - s.coreVel[0];
  const rvy = s.coreVel[4] - s.coreVel[1];
  const rvz = s.coreVel[5] - s.coreVel[2];
  const M = s.mass[0] + s.mass[1];
  acc[0] = inv * s.mass[1] * dx + (fr * rvx * s.mass[1]) / M;
  acc[1] = inv * s.mass[1] * dy + (fr * rvy * s.mass[1]) / M;
  acc[2] = inv * s.mass[1] * dz + (fr * rvz * s.mass[1]) / M;
  acc[3] = -inv * s.mass[0] * dx - (fr * rvx * s.mass[0]) / M;
  acc[4] = -inv * s.mass[0] * dy - (fr * rvy * s.mass[0]) / M;
  acc[5] = -inv * s.mass[0] * dz - (fr * rvz * s.mass[0]) / M;
}

/** One leapfrog step (kick–drift–kick) of the cores and every star. */
export function stepCollision(s: Collision, dt: number) {
  const h = dt / 2;
  // Cores.
  coreAccel(s);
  for (let i = 0; i < 6; i++) s.coreVel[i] += acc[i] * h;
  for (let i = 0; i < 6; i++) s.corePos[i] += s.coreVel[i] * dt;
  coreAccel(s);
  for (let i = 0; i < 6; i++) s.coreVel[i] += acc[i] * h;

  // Stars: kick with the force at the start, drift, kick with the force at the end.
  // The cores have already moved, so use their mid-step positions for both kicks:
  // accurate enough for a picture, and half the work.
  const { pos, vel, n, g } = s;
  const ax0 = s.corePos[0];
  const ay0 = s.corePos[1];
  const az0 = s.corePos[2];
  const ax1 = s.corePos[3];
  const ay1 = s.corePos[4];
  const az1 = s.corePos[5];
  const gm0 = g * s.mass[0];
  const gm1 = g * s.mass[1];
  const e0 = s.soft[0] * s.soft[0];
  const e1 = s.soft[1] * s.soft[1];
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    for (let pass = 0; pass < 2; pass++) {
      const x = pos[o];
      const y = pos[o + 1];
      const z = pos[o + 2];
      let dx = ax0 - x;
      let dy = ay0 - y;
      let dz = az0 - z;
      let r2 = dx * dx + dy * dy + dz * dz + e0;
      let f = gm0 / (r2 * Math.sqrt(r2));
      let vx = dx * f;
      let vy = dy * f;
      let vz = dz * f;
      dx = ax1 - x;
      dy = ay1 - y;
      dz = az1 - z;
      r2 = dx * dx + dy * dy + dz * dz + e1;
      f = gm1 / (r2 * Math.sqrt(r2));
      vx += dx * f;
      vy += dy * f;
      vz += dz * f;
      vel[o] += vx * h;
      vel[o + 1] += vy * h;
      vel[o + 2] += vz * h;
      if (pass === 0) {
        pos[o] += vel[o] * dt;
        pos[o + 1] += vel[o + 1] * dt;
        pos[o + 2] += vel[o + 2] * dt;
      }
    }
  }
  s.t += dt;
}

/** Distance between the two cores. */
export function coreSeparation(s: Collision): number {
  return Math.hypot(
    s.corePos[3] - s.corePos[0],
    s.corePos[4] - s.corePos[1],
    s.corePos[5] - s.corePos[2],
  );
}

/** Files whose path exists in both repos: pairs of indices (a, b), at most `max`. */
export function sharedPaths(
  a: { path: string }[],
  b: { path: string }[],
  max = 400,
): [number, number][] {
  const inB = new Map<string, number>();
  b.forEach((f, i) => inB.set(f.path, i));
  const out: [number, number][] = [];
  for (let i = 0; i < a.length && out.length < max; i++) {
    const j = inB.get(a[i].path);
    if (j !== undefined) out.push([i, j]);
  }
  return out;
}
