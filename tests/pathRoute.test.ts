import { describe, expect, it } from 'vitest';
import { routeFromPath } from '../src/data/pathRoute';

describe('routeFromPath: swap github.com for the site and keep the path', () => {
  it('reads owner/repo after the base path', () => {
    expect(routeFromPath('/Gitsky/vitejs/vite', '/Gitsky/')).toEqual({ repo: 'vitejs/vite' });
    expect(routeFromPath('/vitejs/vite', '/')).toEqual({ repo: 'vitejs/vite' });
  });

  it('ignores the rest of a GitHub URL, but keeps a branch', () => {
    expect(routeFromPath('/Gitsky/vitejs/vite/pulls', '/Gitsky/')).toEqual({
      repo: 'vitejs/vite',
    });
    expect(routeFromPath('/Gitsky/vitejs/vite/tree/v5/packages/vite', '/Gitsky/')).toEqual({
      repo: 'vitejs/vite',
      branch: 'v5',
    });
    expect(routeFromPath('/Gitsky/pmndrs/zustand.git/', '/Gitsky/')).toEqual({
      repo: 'pmndrs/zustand',
    });
  });

  it('accepts a whole GitHub URL pasted after the site', () => {
    expect(routeFromPath('/Gitsky/github.com/vitejs/vite', '/Gitsky/')).toEqual({
      repo: 'vitejs/vite',
    });
    expect(routeFromPath('/Gitsky/https://github.com/vitejs/vite', '/Gitsky/')).toEqual({
      repo: 'vitejs/vite',
    });
    expect(routeFromPath('/Gitsky/https:/www.github.com/vitejs/vite', '/Gitsky/')).toEqual({
      repo: 'vitejs/vite',
    });
  });

  it('treats a single name as a person, like a GitHub profile URL', () => {
    expect(routeFromPath('/Gitsky/torvalds', '/Gitsky/')).toEqual({ user: 'torvalds' });
    expect(routeFromPath('/Gitsky/@torvalds/', '/Gitsky/')).toEqual({ user: 'torvalds' });
  });

  it('returns null for the home page, files and anything not a repo', () => {
    expect(routeFromPath('/Gitsky/', '/Gitsky/')).toBeNull();
    expect(routeFromPath('/Gitsky', '/Gitsky/')).toBeNull();
    expect(routeFromPath('/', '/')).toBeNull();
    expect(routeFromPath('/Gitsky/index.html', '/Gitsky/')).toBeNull();
    expect(routeFromPath('/Gitsky/gitlab.com/a/b', '/Gitsky/')).toBeNull();
    expect(routeFromPath('/Gitsky/-bad/name', '/Gitsky/')).toBeNull();
    expect(routeFromPath('/elsewhere/vitejs/vite', '/Gitsky/')).toBeNull();
  });

  it('decodes escaped characters', () => {
    expect(routeFromPath('/Gitsky/vitejs/vite/tree/feat%2Dx', '/Gitsky/')).toEqual({
      repo: 'vitejs/vite',
      branch: 'feat-x',
    });
  });
});
