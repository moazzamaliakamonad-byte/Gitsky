import { describe, expect, it } from 'vitest';
import { constellationEdges, peopleOf } from '../src/layout/constellation';
import type { Commit } from '../src/data/types';

const commit = (author: string, files: number[]): Commit => ({
  sha: author + files.join(),
  message: 'm',
  author,
  date: '2026-01-01T00:00:00Z',
  files,
  changedCount: files.length,
});

describe('peopleOf: who worked in the sampled commits', () => {
  it('counts commits and distinct files, busiest first', () => {
    const people = peopleOf([
      commit('ada', [1, 2]),
      commit('bob', [3]),
      commit('ada', [2, 4]),
      commit('cy', [5, 6, 7]),
    ]);
    expect(people.map((p) => p.name)).toEqual(['ada', 'cy', 'bob']);
    expect(people[0]).toMatchObject({ commits: 2, files: [2, 1, 4] });
  });
  it('orders files by how often the person touched them', () => {
    const [ada] = peopleOf([commit('ada', [9, 2]), commit('ada', [2])]);
    expect(ada.files).toEqual([2, 9]);
  });
});

describe('constellationEdges: the shortest set of lines joining a person’s stars', () => {
  // Four stars on a line, given out of order.
  const pos = new Float32Array([0, 0, 0, 3, 0, 0, 1, 0, 0, 2, 0, 0]);

  it('joins neighbours only (a minimum spanning tree)', () => {
    const edges = constellationEdges(pos, [0, 1, 2, 3]);
    const key = edges.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('-')).sort();
    expect(key).toEqual(['0-2', '1-3', '2-3']);
  });

  it('has one fewer line than stars, and none for a single star', () => {
    expect(constellationEdges(pos, [0, 1, 2, 3])).toHaveLength(3);
    expect(constellationEdges(pos, [2])).toEqual([]);
  });

  it('grows outward from the first star, so lines can be drawn in order', () => {
    const edges = constellationEdges(pos, [0, 1, 2, 3]);
    const seen = new Set([0]);
    for (const [a, b] of edges) {
      expect(seen.has(a)).toBe(true);
      seen.add(b);
    }
  });

  it('keeps at most `max` stars', () => {
    expect(constellationEdges(pos, [0, 1, 2, 3], 2)).toHaveLength(1);
  });
});
