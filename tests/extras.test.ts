import { describe, expect, it } from 'vitest';
import { badgeMarkdown, siteRoot } from '../src/share/badge';
import { nextSky } from '../src/state/driftPlan';
import { precacheList } from '../build/precache';

describe('badge', () => {
  it('links the badge image to the repo’s sky', () => {
    expect(badgeMarkdown('https://u.github.io/Gitsky/', 'pmndrs/zustand')).toBe(
      '[![View in Gitsky](https://u.github.io/Gitsky/badge.svg)](https://u.github.io/Gitsky/?repo=pmndrs/zustand)',
    );
  });
  it('finds the site root from the configured URL, or from the page', () => {
    expect(siteRoot('https://u.github.io/Gitsky/', 'http://x/', '/')).toBe(
      'https://u.github.io/Gitsky/',
    );
    expect(siteRoot('', 'http://localhost:5173/?repo=a/b', '/')).toBe('http://localhost:5173/');
    expect(siteRoot('/', 'http://localhost:5173/x', '/')).toBe('http://localhost:5173/');
    expect(siteRoot(undefined, 'https://h.io/Gitsky/vitejs/vite', '/Gitsky/')).toBe(
      'https://h.io/Gitsky/',
    );
  });
});

describe('nextSky: drift mode moves through the featured skies in order', () => {
  const sky = (fullName: string) => ({ fullName, file: '', blurb: '', fileCount: 1 });
  const list = [sky('a/a'), sky('b/b'), sky('c/c')];
  it('takes the next one, wrapping around', () => {
    expect(nextSky(list, 'a/a')?.fullName).toBe('b/b');
    expect(nextSky(list, 'c/c')?.fullName).toBe('a/a');
  });
  it('starts at the first when the current sky is not featured', () => {
    expect(nextSky(list, 'x/y')?.fullName).toBe('a/a');
    expect(nextSky([], 'x/y')).toBeNull();
  });
});

describe('precacheList: what the offline copy saves on first visit', () => {
  it('keeps the app shell and the featured index, and skips source maps and big skies', () => {
    const list = precacheList(
      ['assets/index-abc.js', 'assets/index-abc.css', 'assets/three-x.js', 'assets/a.js.map'],
      [
        'favicon.svg',
        'manifest.webmanifest',
        'snapshots/index.json',
        'snapshots/react__react.json',
        'og-image.jpg',
        'badge.svg',
      ],
    );
    expect(list).toEqual([
      './',
      'assets/index-abc.css',
      'assets/index-abc.js',
      'assets/three-x.js',
      'favicon.svg',
      'manifest.webmanifest',
      'snapshots/index.json',
    ]);
  });
});
