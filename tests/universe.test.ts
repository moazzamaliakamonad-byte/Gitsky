import { describe, expect, it } from 'vitest';
import { buildUniverse, type UniverseInput } from '../src/layout/universe';

function input(): UniverseInput {
  return {
    home: { fullName: 'o/home', stars: 5000, language: 'TypeScript', description: null },
    people: [
      { login: 'ada', contributions: 300, avatar: 'a.png' },
      { login: 'lin', contributions: 40, avatar: 'l.png' },
    ],
    repos: [
      { fullName: 'ada/one', stars: 1200, language: 'Rust', description: 'x', owner: 'ada' },
      { fullName: 'ada/two', stars: 3, language: null, description: null, owner: 'ada' },
      { fullName: 'lin/tool', stars: 90, language: 'Go', description: null, owner: 'lin' },
    ],
  };
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('buildUniverse', () => {
  const u = buildUniverse(input());

  it('puts the home repo at the centre and every related repo around it', () => {
    expect(u.galaxies[0]).toMatchObject({ fullName: 'o/home', home: true, pos: [0, 0, 0] });
    expect(u.galaxies.map((g) => g.fullName)).toEqual(['o/home', 'ada/one', 'ada/two', 'lin/tool']);
    for (const g of u.galaxies.slice(1))
      expect(dist(g.pos, [0, 0, 0])).toBeGreaterThan(u.galaxies[0].radius);
  });

  it('sizes galaxies by GitHub stars (log scale)', () => {
    const [, one, two] = u.galaxies;
    expect(one.radius).toBeGreaterThan(two.radius);
    expect(u.galaxies[0].radius).toBeGreaterThan(one.radius);
  });

  it('places each person between the home galaxy and their own repos', () => {
    const ada = u.people.find((p) => p.login === 'ada')!;
    const one = u.galaxies[1];
    expect(dist(ada.pos, [0, 0, 0])).toBeLessThan(dist(one.pos, [0, 0, 0]));
    expect(dist(ada.pos, one.pos)).toBeLessThan(dist(ada.pos, u.galaxies[3].pos));
  });

  it('links home to contributors and contributors to their repos', () => {
    expect(u.links.filter((l) => l.kind === 'contributes')).toHaveLength(2);
    expect(u.links.filter((l) => l.kind === 'owns')).toHaveLength(3);
    const strong = u.links.find((l) => l.kind === 'contributes' && l.person === 0)!;
    const weak = u.links.find((l) => l.kind === 'contributes' && l.person === 1)!;
    expect(strong.strength).toBeGreaterThan(weak.strength);
  });

  it('is deterministic and bounded', () => {
    expect(buildUniverse(input())).toEqual(u);
    for (const g of u.galaxies) expect(dist(g.pos, [0, 0, 0])).toBeLessThanOrEqual(u.extent);
  });

  it('copes with a repo nobody else contributes to', () => {
    const lonely = buildUniverse({ ...input(), people: [], repos: [] });
    expect(lonely.galaxies).toHaveLength(1);
    expect(lonely.links).toEqual([]);
  });
});

describe('universe data', () => {
  it('keeps real people, most active first, and drops bots', async () => {
    const { peopleFrom } = await import('../src/data/universeData');
    const out = peopleFrom(
      [
        { login: 'b', type: 'User', contributions: 5, avatar_url: 'b' },
        { login: 'dependabot[bot]', type: 'Bot', contributions: 900, avatar_url: 'x' },
        { login: 'a', type: 'User', contributions: 50, avatar_url: 'a' },
      ],
      10,
    );
    expect(out.map((p) => p.login)).toEqual(['a', 'b']);
  });

  it('keeps a person’s own projects: no forks, not the home repo, most starred first', async () => {
    const { reposFrom } = await import('../src/data/universeData');
    const r = (full_name: string, stars: number, fork = false) => ({
      full_name,
      fork,
      stargazers_count: stars,
      language: null,
      description: null,
    });
    const out = reposFrom(
      [r('a/x', 5), r('a/fork', 999, true), r('o/home', 50), r('a/y', 40)],
      'a',
      'O/Home',
    );
    expect(out.map((x) => x.fullName)).toEqual(['a/y', 'a/x']);
  });
});
