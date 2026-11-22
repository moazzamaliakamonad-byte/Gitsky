/**
 * The universe around a repo: the people who build it, and the other projects they
 * build. The home repo is the central galaxy; each top contributor is a bright star on
 * a shell around it; each of their own repos is a galaxy further out, beyond them.
 * Filaments join home → contributor (strength from contributions) and contributor →
 * their repos. Galaxy size is GitHub stars (log scale); colour is the main language.
 */
export interface UPersonIn {
  login: string;
  /** Commits to the home repo, as GitHub counts them. */
  contributions: number;
  avatar: string;
}

export interface URepoIn {
  fullName: string;
  stars: number;
  language: string | null;
  description: string | null;
  owner: string;
}

export interface UniverseInput {
  home: { fullName: string; stars: number; language: string | null; description: string | null };
  people: UPersonIn[];
  repos: URepoIn[];
}

export type Vec3 = [number, number, number];

export interface UGalaxy {
  fullName: string;
  stars: number;
  language: string | null;
  description: string | null;
  home: boolean;
  /** Index into people of the owner, or -1 for the home repo. */
  owner: number;
  pos: Vec3;
  radius: number;
  /** Disk orientation (unit normal). */
  normal: Vec3;
  seed: number;
}

export interface UPerson extends UPersonIn {
  pos: Vec3;
}

export interface ULink {
  kind: 'contributes' | 'owns';
  person: number;
  galaxy: number;
  from: Vec3;
  to: Vec3;
  /** 0.25 … 1, drives brightness. */
  strength: number;
}

export interface Universe {
  galaxies: UGalaxy[];
  people: UPerson[];
  links: ULink[];
  extent: number;
}

const PERSON_SHELL = 95;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Deterministic 0..1 from a string (FNV-1a). */
function hash01(s: string, salt = 0): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

export const galaxyRadius = (stars: number) => Math.min(22, 4 + 3.2 * Math.log10(stars + 1));

function normalFor(name: string): Vec3 {
  // Mostly face-up disks with a personal tilt, like a real deep field.
  const tilt = 0.25 + hash01(name, 1) * 0.9;
  const az = hash01(name, 2) * Math.PI * 2;
  return [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
}

export function buildUniverse(input: UniverseInput): Universe {
  const homeR = Math.max(galaxyRadius(input.home.stars), 16);
  const galaxies: UGalaxy[] = [
    {
      ...input.home,
      home: true,
      owner: -1,
      pos: [0, 0, 0],
      radius: homeR,
      normal: [0, 1, 0],
      seed: hash01(input.home.fullName),
    },
  ];
  const n = input.people.length;
  const maxC = Math.max(1, ...input.people.map((p) => p.contributions));

  // People on a flattened golden-angle shell, the most active first.
  const people: UPerson[] = input.people.map((p, i) => {
    const y = n === 1 ? 0 : 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * GOLDEN + hash01(input.home.fullName) * Math.PI * 2;
    const shell = PERSON_SHELL * (0.85 + 0.3 * hash01(p.login, 3));
    return {
      ...p,
      pos: [Math.cos(a) * r * shell, y * shell * 0.45, Math.sin(a) * r * shell],
    };
  });

  const links: ULink[] = [];
  people.forEach((p, pi) => {
    links.push({
      kind: 'contributes',
      person: pi,
      galaxy: 0,
      from: [0, 0, 0],
      to: p.pos,
      strength: 0.25 + 0.75 * Math.sqrt(p.contributions / maxC),
    });
    // The person's own repos fan out beyond them, away from home.
    const mine = input.repos.filter((r) => r.owner === p.login);
    const len = Math.hypot(...p.pos) || 1;
    const out: Vec3 = [p.pos[0] / len, p.pos[1] / len, p.pos[2] / len];
    // Two axes perpendicular to `out`, for spreading repos in a cone.
    const up: Vec3 = Math.abs(out[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const ax: Vec3 = normalize(cross(out, up));
    const ay: Vec3 = cross(out, ax);
    mine.forEach((r, k) => {
      const radius = galaxyRadius(r.stars);
      const dist = 30 + radius * 1.6 + k * 9;
      const a = k * GOLDEN * 2 + hash01(r.fullName, 4) * 0.8;
      const spread = 10 + k * 6;
      const pos: Vec3 = [0, 1, 2].map(
        (c) => p.pos[c] + out[c] * dist + (ax[c] * Math.cos(a) + ay[c] * Math.sin(a)) * spread,
      ) as Vec3;
      const gi = galaxies.length;
      galaxies.push({
        ...r,
        home: false,
        owner: pi,
        pos,
        radius,
        normal: normalFor(r.fullName),
        seed: hash01(r.fullName),
      });
      links.push({ kind: 'owns', person: pi, galaxy: gi, from: p.pos, to: pos, strength: 0.4 });
    });
  });

  let extent = homeR;
  for (const g of galaxies) extent = Math.max(extent, Math.hypot(...g.pos) + g.radius);
  for (const p of people) extent = Math.max(extent, Math.hypot(...p.pos));
  return { galaxies, people, links, extent };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
