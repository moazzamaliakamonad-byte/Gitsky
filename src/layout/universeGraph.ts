/**
 * The universe as a graph that grows: projects and people, joined by "contributes" and
 * "owns" edges. Expanding a project adds its contributors; expanding a person adds their
 * own projects. People who reach several projects are the bridges of the cosmic web.
 *
 * Layout is a small 3D force simulation (springs along edges, repulsion between every
 * pair, a gentle pull toward a disk), warm-started from the previous layout so the map
 * grows instead of reshuffling. Everything here is pure and deterministic.
 * Explained in learn/concepts/universe.md.
 */
export type Vec3 = [number, number, number];

export interface GRepo {
  fullName: string;
  stars: number;
  language: string | null;
  description: string | null;
  /** Last push, ms since epoch (null if unknown). */
  pushedAt: number | null;
}

export interface GPerson {
  login: string;
  avatar: string;
}

export interface GEdge {
  person: string;
  repo: string;
  kind: 'contributes' | 'owns';
  /** Commits for "contributes"; 1 for "owns". */
  weight: number;
}

export interface UGraph {
  root: { kind: 'repo' | 'user'; id: string };
  repos: Map<string, GRepo>;
  people: Map<string, GPerson>;
  edges: GEdge[];
  /** `repo:owner/name` or `user:login` that have been expanded. */
  expanded: Set<string>;
}

export interface GraphPatch {
  repos: GRepo[];
  people: GPerson[];
  edges: GEdge[];
  expanded: string[];
}

export function emptyGraph(root: UGraph['root']): UGraph {
  return { root, repos: new Map(), people: new Map(), edges: [], expanded: new Set() };
}

/** A new graph with the patch merged in (nodes updated, edges deduplicated). */
export function mergeGraph(g: UGraph, p: GraphPatch): UGraph {
  const repos = new Map(g.repos);
  for (const r of p.repos) repos.set(r.fullName, { ...repos.get(r.fullName), ...r });
  const people = new Map(g.people);
  for (const x of p.people) people.set(x.login, { ...people.get(x.login), ...x });
  const edges = [...g.edges];
  const key = (e: GEdge) => `${e.person}|${e.repo}|${e.kind}`;
  const at = new Map(edges.map((e, i) => [key(e), i]));
  for (const e of p.edges) {
    const i = at.get(key(e));
    if (i === undefined) {
      at.set(key(e), edges.length);
      edges.push(e);
    } else if (e.weight > edges[i].weight) edges[i] = e;
  }
  return { root: g.root, repos, people, edges, expanded: new Set([...g.expanded, ...p.expanded]) };
}

export const nodeKey = {
  repo: (fullName: string) => `repo:${fullName}`,
  person: (login: string) => `person:${login}`,
};

function rootKey(g: UGraph) {
  return g.root.kind === 'repo' ? nodeKey.repo(g.root.id) : nodeKey.person(g.root.id);
}

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

/**
 * Force layout. Springs pull linked nodes to a rest length (shorter for "owns"), every
 * pair repels (inverse square, softened), and a weak force flattens the web toward a
 * disk so it reads like a galaxy field. The root stays pinned at the origin.
 */
export function layoutGraph(
  g: UGraph,
  prev?: Map<string, Vec3>,
  iterations = 220,
): Map<string, Vec3> {
  const keys: string[] = [];
  const size: number[] = [];
  for (const r of g.repos.values()) {
    keys.push(nodeKey.repo(r.fullName));
    size.push(galaxyRadius(r.stars));
  }
  for (const p of g.people.values()) {
    keys.push(nodeKey.person(p.login));
    size.push(3);
  }
  const n = keys.length;
  // Repulsion is O(n²) per iteration: big universes settle in fewer, larger steps so an
  // expansion never stalls the frame for long.
  const steps =
    n > 500 ? Math.round(iterations * 0.45) : n > 250 ? Math.round(iterations * 0.7) : iterations;
  const index = new Map(keys.map((k, i) => [k, i]));
  const root = index.get(rootKey(g)) ?? -1;

  // Starting positions: previous layout where known; new nodes start near a linked
  // neighbour (or on a seeded sphere), so additions bloom out of what they connect to.
  const pos = new Float64Array(n * 3);
  const placed = new Uint8Array(n);
  keys.forEach((k, i) => {
    const p = prev?.get(k);
    if (p) {
      pos.set(p, i * 3);
      placed[i] = 1;
    }
  });
  const links = g.edges
    .map((e) => ({
      a: index.get(nodeKey.person(e.person)) ?? -1,
      b: index.get(nodeKey.repo(e.repo)) ?? -1,
      rest: e.kind === 'owns' ? 38 : 62,
      k: e.kind === 'owns' ? 0.06 : 0.035 + 0.02 * Math.min(1, Math.log10(e.weight + 1) / 3),
    }))
    .filter((l) => l.a >= 0 && l.b >= 0);
  for (let pass = 0; pass < 3; pass++) {
    keys.forEach((k, i) => {
      if (placed[i]) return;
      const nb = links.find((l) => (l.a === i && placed[l.b]) || (l.b === i && placed[l.a]));
      const j = nb ? (nb.a === i ? nb.b : nb.a) : -1;
      if (j < 0 && pass < 2) return;
      const u = hash01(k, 1) * 2 - 1;
      const t = hash01(k, 2) * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const d = j >= 0 ? 30 : 90;
      const base = j >= 0 ? [pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]] : [0, 0, 0];
      pos[i * 3] = base[0] + Math.cos(t) * r * d;
      pos[i * 3 + 1] = base[1] + u * d * 0.4;
      pos[i * 3 + 2] = base[2] + Math.sin(t) * r * d;
      placed[i] = 1;
    });
  }
  if (root >= 0) pos.fill(0, root * 3, root * 3 + 3);

  const force = new Float64Array(n * 3);
  // A warm start resumes a settled layout: nodes it already placed move gently, new
  // nodes move freely.
  const heat = new Float64Array(n).fill(1);
  if (prev) keys.forEach((k, i) => prev.has(k) && (heat[i] = 0.3));
  for (let it = 0; it < steps; it++) {
    const cool = 1 - it / steps; // step size shrinks: the layout settles
    force.fill(0);
    // Repulsion between every pair (n is a few hundred at most).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        const minD = size[i] + size[j] + 6;
        const d2 = dx * dx + dy * dy + dz * dz + 1;
        const f = (900 + minD * minD * 4) / d2;
        const inv = f / Math.sqrt(d2);
        force[i * 3] += dx * inv;
        force[i * 3 + 1] += dy * inv;
        force[i * 3 + 2] += dz * inv;
        force[j * 3] -= dx * inv;
        force[j * 3 + 1] -= dy * inv;
        force[j * 3 + 2] -= dz * inv;
      }
    }
    // Springs.
    for (const l of links) {
      const dx = pos[l.b * 3] - pos[l.a * 3];
      const dy = pos[l.b * 3 + 1] - pos[l.a * 3 + 1];
      const dz = pos[l.b * 3 + 2] - pos[l.a * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const rest = l.rest + size[l.a] + size[l.b];
      const f = (l.k * (d - rest)) / d;
      force[l.a * 3] += dx * f;
      force[l.a * 3 + 1] += dy * f;
      force[l.a * 3 + 2] += dz * f;
      force[l.b * 3] -= dx * f;
      force[l.b * 3 + 1] -= dy * f;
      force[l.b * 3 + 2] -= dz * f;
    }
    for (let i = 0; i < n; i++) {
      if (i === root) continue;
      force[i * 3 + 1] -= pos[i * 3 + 1] * 0.02; // toward the disk
      for (let c = 0; c < 3; c++) {
        const step = Math.max(-6, Math.min(6, force[i * 3 + c])) * cool * heat[i];
        pos[i * 3 + c] += step;
      }
    }
  }

  const out = new Map<string, Vec3>();
  keys.forEach((k, i) => {
    out.set(
      k,
      i === root ? [0, 0, 0] : [round(pos[i * 3]), round(pos[i * 3 + 1]), round(pos[i * 3 + 2])],
    );
  });
  return out;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** 1 for a push this week, fading to ~0.1 for projects untouched for years. */
export function activityOf(pushedAt: number | null, now: number): number {
  if (pushedAt === null) return 0.35;
  const days = (now - pushedAt) / 86400000;
  if (days <= 7) return 1;
  return Math.max(0.1, Math.min(1, 1 - Math.log10(days / 7) * 0.45));
}

export interface UGalaxy extends GRepo {
  key: string;
  home: boolean;
  pos: Vec3;
  radius: number;
  normal: Vec3;
  seed: number;
  activity: number;
  expanded: boolean;
}

export interface UPerson extends GPerson {
  key: string;
  pos: Vec3;
  /** Total commits across the projects in view. */
  contributions: number;
  /** Contributes to two or more projects in view: a bridge of the web. */
  bridge: boolean;
  expanded: boolean;
}

export interface ULink {
  kind: 'contributes' | 'owns';
  person: number;
  galaxy: number;
  from: Vec3;
  to: Vec3;
  strength: number;
}

export interface Universe {
  galaxies: UGalaxy[];
  people: UPerson[];
  links: ULink[];
  extent: number;
}

function normalFor(name: string): Vec3 {
  const tilt = 0.25 + hash01(name, 3) * 0.9;
  const az = hash01(name, 4) * Math.PI * 2;
  return [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
}

/** The view model: what UniverseView draws. Home (the root repo, if any) comes first. */
export function graphToUniverse(g: UGraph, pos: Map<string, Vec3>, now: number): Universe {
  const repos = [...g.repos.values()].sort((a, b) =>
    g.root.kind === 'repo' && a.fullName === g.root.id
      ? -1
      : g.root.kind === 'repo' && b.fullName === g.root.id
        ? 1
        : b.stars - a.stars,
  );
  const galaxies: UGalaxy[] = repos.map((r) => {
    const key = nodeKey.repo(r.fullName);
    const home = g.root.kind === 'repo' && r.fullName === g.root.id;
    return {
      ...r,
      key,
      home,
      pos: pos.get(key) ?? [0, 0, 0],
      radius: home ? Math.max(16, galaxyRadius(r.stars)) : galaxyRadius(r.stars),
      normal: home ? [0, 1, 0] : normalFor(r.fullName),
      seed: hash01(r.fullName),
      activity: activityOf(r.pushedAt, now),
      expanded: g.expanded.has(key),
    };
  });
  const gIndex = new Map(galaxies.map((x, i) => [x.fullName, i]));
  const contributes = new Map<string, Set<string>>();
  const commits = new Map<string, number>();
  for (const e of g.edges) {
    if (e.kind !== 'contributes') continue;
    if (!contributes.has(e.person)) contributes.set(e.person, new Set());
    contributes.get(e.person)!.add(e.repo);
    commits.set(e.person, (commits.get(e.person) ?? 0) + e.weight);
  }
  const people: UPerson[] = [...g.people.values()]
    .sort(
      (a, b) =>
        (commits.get(b.login) ?? 0) - (commits.get(a.login) ?? 0) || (a.login < b.login ? -1 : 1),
    )
    .map((p) => {
      const key = nodeKey.person(p.login);
      return {
        ...p,
        key,
        pos: pos.get(key) ?? [0, 0, 0],
        contributions: commits.get(p.login) ?? 0,
        bridge: (contributes.get(p.login)?.size ?? 0) >= 2,
        expanded: g.expanded.has(`user:${p.login}`),
      };
    });
  const pIndex = new Map(people.map((x, i) => [x.login, i]));
  const maxW = Math.max(1, ...g.edges.filter((e) => e.kind === 'contributes').map((e) => e.weight));
  const links: ULink[] = [];
  for (const e of g.edges) {
    const pi = pIndex.get(e.person);
    const gi = gIndex.get(e.repo);
    if (pi === undefined || gi === undefined) continue;
    links.push({
      kind: e.kind,
      person: pi,
      galaxy: gi,
      from: people[pi].pos,
      to: galaxies[gi].pos,
      strength: e.kind === 'owns' ? 0.4 : 0.25 + 0.75 * Math.sqrt(e.weight / maxW),
    });
  }
  let extent = 20;
  for (const x of galaxies) extent = Math.max(extent, Math.hypot(...x.pos) + x.radius);
  for (const x of people) extent = Math.max(extent, Math.hypot(...x.pos));
  return { galaxies, people, links, extent };
}
