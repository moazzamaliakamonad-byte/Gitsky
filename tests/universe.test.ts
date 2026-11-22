import { describe, expect, it } from 'vitest';

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
      ['O/Home'],
    );
    expect(out.map((x) => x.fullName)).toEqual(['a/y', 'a/x']);
  });
});
