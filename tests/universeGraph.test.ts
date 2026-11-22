import { describe, expect, it } from 'vitest';
import {
  activityOf,
  emptyGraph,
  graphToUniverse,
  layoutGraph,
  mergeGraph,
  type GraphPatch,
} from '../src/layout/universeGraph';

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 22);

function patch(): GraphPatch {
  return {
    repos: [
      {
        fullName: 'o/home',
        stars: 5000,
        language: 'TypeScript',
        description: null,
        pushedAt: NOW - DAY,
      },
      {
        fullName: 'ada/one',
        stars: 1200,
        language: 'Rust',
        description: 'x',
        pushedAt: NOW - 400 * DAY,
      },
      {
        fullName: 'lin/tool',
        stars: 90,
        language: 'Go',
        description: null,
        pushedAt: NOW - 10 * DAY,
      },
    ],
    people: [
      { login: 'ada', avatar: 'a' },
      { login: 'lin', avatar: 'l' },
    ],
    edges: [
      { person: 'ada', repo: 'o/home', kind: 'contributes', weight: 300 },
      { person: 'lin', repo: 'o/home', kind: 'contributes', weight: 40 },
      { person: 'ada', repo: 'ada/one', kind: 'owns', weight: 1 },
      { person: 'lin', repo: 'lin/tool', kind: 'owns', weight: 1 },
    ],
    expanded: ['repo:o/home'],
  };
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('mergeGraph', () => {
  it('adds nodes and edges once, keeping the strongest edge weight', () => {
    let g = mergeGraph(emptyGraph({ kind: 'repo', id: 'o/home' }), patch());
    g = mergeGraph(g, {
      repos: [
        { fullName: 'ada/one', stars: 1300, language: 'Rust', description: 'x', pushedAt: NOW },
      ],
      people: [{ login: 'ada', avatar: 'a' }],
      edges: [{ person: 'ada', repo: 'o/home', kind: 'contributes', weight: 350 }],
      expanded: ['user:ada'],
    });
    expect(g.repos.size).toBe(3);
    expect(g.people.size).toBe(2);
    expect(g.edges.filter((e) => e.person === 'ada' && e.repo === 'o/home')).toHaveLength(1);
    expect(g.edges.find((e) => e.person === 'ada' && e.repo === 'o/home')?.weight).toBe(350);
    expect(g.repos.get('ada/one')?.stars).toBe(1300);
    expect(g.expanded.has('user:ada')).toBe(true);
  });
});

describe('layoutGraph', () => {
  const g = mergeGraph(emptyGraph({ kind: 'repo', id: 'o/home' }), patch());
  const pos = layoutGraph(g);

  it('pins the root at the centre and keeps linked nodes closer than unlinked ones', () => {
    expect(pos.get('repo:o/home')).toEqual([0, 0, 0]);
    const ada = pos.get('person:ada')!;
    expect(dist(ada, pos.get('repo:ada/one')!)).toBeLessThan(dist(ada, pos.get('repo:lin/tool')!));
  });

  it('is deterministic, and warm-starts from previous positions', () => {
    expect(layoutGraph(g)).toEqual(pos);
    const again = layoutGraph(g, pos);
    for (const [k, p] of pos) expect(dist(p, again.get(k)!)).toBeLessThan(25);
  });
});

describe('graphToUniverse', () => {
  it('turns the graph into galaxies, people and filaments, marking bridges', () => {
    const g = mergeGraph(emptyGraph({ kind: 'repo', id: 'o/home' }), {
      ...patch(),
      edges: [
        ...patch().edges,
        { person: 'ada', repo: 'lin/tool', kind: 'contributes', weight: 5 },
      ],
    });
    const u = graphToUniverse(g, layoutGraph(g), NOW);
    expect(u.galaxies[0]).toMatchObject({ fullName: 'o/home', home: true });
    expect(u.galaxies.map((x) => x.fullName).sort()).toEqual(['ada/one', 'lin/tool', 'o/home']);
    expect(u.links).toHaveLength(5);
    const ada = u.people.find((p) => p.login === 'ada')!;
    const lin = u.people.find((p) => p.login === 'lin')!;
    expect(ada.bridge).toBe(true); // contributes to two projects
    expect(lin.bridge).toBe(false);
    expect(u.galaxies.find((x) => x.fullName === 'o/home')?.expanded).toBe(true);
  });
});

describe('activityOf', () => {
  it('is bright for recent pushes and fades for dormant projects', () => {
    expect(activityOf(NOW - DAY, NOW)).toBe(1);
    expect(activityOf(NOW - 20 * DAY, NOW)).toBeGreaterThan(activityOf(NOW - 200 * DAY, NOW));
    expect(activityOf(NOW - 900 * DAY, NOW)).toBeLessThan(0.2);
    expect(activityOf(null, NOW)).toBeLessThan(0.5);
  });
});
