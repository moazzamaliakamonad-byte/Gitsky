import type { Commit } from '../data/types';

export interface Person {
  name: string;
  commits: number;
  /** Files they touched, most-touched first. */
  files: number[];
}

/** Everyone in the sampled commits: most commits first, then most files. */
export function peopleOf(commits: Commit[]): Person[] {
  const by = new Map<string, { commits: number; touches: Map<number, number> }>();
  for (const c of commits) {
    let p = by.get(c.author);
    if (!p) by.set(c.author, (p = { commits: 0, touches: new Map() }));
    p.commits++;
    for (const f of c.files) p.touches.set(f, (p.touches.get(f) ?? 0) + 1);
  }
  return [...by.entries()]
    .map(([name, p]) => ({
      name,
      commits: p.commits,
      files: [...p.touches.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([f]) => f),
    }))
    .sort(
      (a, b) =>
        b.commits - a.commits || b.files.length - a.files.length || (a.name < b.name ? -1 : 1),
    );
}

/**
 * A person's constellation: the shortest set of lines that joins all their stars (a
 * minimum spanning tree, Prim's algorithm). Real constellations are drawn the same way,
 * nearest neighbour to nearest neighbour. Edges come out in the order the tree grows from
 * the first (most-touched) star, so they can be drawn in one stroke after another.
 * O(n²) for n ≤ max stars: about 1 ms for 400.
 */
export function constellationEdges(
  positions: Float32Array,
  indices: number[],
  max = 400,
): [number, number][] {
  const pts = indices.slice(0, max);
  const n = pts.length;
  if (n < 2) return [];
  const inTree = new Uint8Array(n);
  const best = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const d2 = (a: number, b: number) => {
    const i = pts[a] * 3;
    const j = pts[b] * 3;
    const dx = positions[i] - positions[j];
    const dy = positions[i + 1] - positions[j + 1];
    const dz = positions[i + 2] - positions[j + 2];
    return dx * dx + dy * dy + dz * dz;
  };
  const edges: [number, number][] = [];
  let cur = 0;
  inTree[0] = 1;
  for (let step = 1; step < n; step++) {
    for (let k = 0; k < n; k++) {
      if (inTree[k]) continue;
      const d = d2(cur, k);
      if (d < best[k]) {
        best[k] = d;
        from[k] = cur;
      }
    }
    let next = -1;
    for (let k = 0; k < n; k++) if (!inTree[k] && (next < 0 || best[k] < best[next])) next = k;
    inTree[next] = 1;
    edges.push([pts[from[next]], pts[next]]);
    cur = next;
  }
  return edges;
}
