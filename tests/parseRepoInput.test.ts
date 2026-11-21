import { describe, expect, it } from 'vitest';
import { parseRepoInput } from '../src/data/parseRepoInput';

function ok(input: string) {
  const r = parseRepoInput(input);
  if (!r.ok) throw new Error(`expected ok for "${input}", got: ${r.error}`);
  return r.ref;
}

function err(input: string) {
  const r = parseRepoInput(input);
  if (r.ok) throw new Error(`expected error for "${input}"`);
  return r.error;
}

describe('parseRepoInput', () => {
  it('accepts owner/repo', () => {
    expect(ok('facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('trims whitespace', () => {
    expect(ok('  facebook/react \n')).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('accepts full https URLs', () => {
    expect(ok('https://github.com/facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('accepts URLs without scheme and with www and trailing slash', () => {
    expect(ok('www.github.com/vitejs/vite/')).toEqual({ owner: 'vitejs', repo: 'vite' });
    expect(ok('github.com/vitejs/vite')).toEqual({ owner: 'vitejs', repo: 'vite' });
    expect(ok('http://github.com/vitejs/vite')).toEqual({ owner: 'vitejs', repo: 'vite' });
  });

  it('strips a trailing .git', () => {
    expect(ok('https://github.com/golang/go.git')).toEqual({ owner: 'golang', repo: 'go' });
    expect(ok('golang/go.git')).toEqual({ owner: 'golang', repo: 'go' });
  });

  it('accepts SSH clone URLs', () => {
    expect(ok('git@github.com:pmndrs/zustand.git')).toEqual({ owner: 'pmndrs', repo: 'zustand' });
  });

  it('reads the branch from /tree/<branch> and /blob/<branch>', () => {
    expect(ok('https://github.com/facebook/react/tree/main/packages')).toEqual({
      owner: 'facebook',
      repo: 'react',
      branch: 'main',
    });
    expect(ok('https://github.com/facebook/react/blob/v18/README.md')).toEqual({
      owner: 'facebook',
      repo: 'react',
      branch: 'v18',
    });
  });

  it('ignores query strings, hashes and other sub-pages', () => {
    expect(ok('https://github.com/facebook/react?tab=readme#top')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
    expect(ok('https://github.com/facebook/react/issues/123')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('keeps dots, dashes and underscores in repo names', () => {
    expect(ok('vercel/next.js')).toEqual({ owner: 'vercel', repo: 'next.js' });
    expect(ok('some-org/my_repo-2')).toEqual({ owner: 'some-org', repo: 'my_repo-2' });
  });

  it('rejects empty input', () => {
    expect(err('')).toMatch(/paste/i);
    expect(err('   ')).toMatch(/paste/i);
  });

  it('rejects a bare word with no slash', () => {
    expect(err('react')).toMatch(/owner\/repo/);
  });

  it('rejects a URL with only an owner', () => {
    expect(err('https://github.com/facebook')).toMatch(/repository name/i);
  });

  it('rejects other hosts', () => {
    expect(err('https://gitlab.com/a/b')).toMatch(/github\.com/);
  });

  it('rejects characters GitHub does not allow', () => {
    expect(err('face book/react')).toMatch(/owner/i);
    expect(err('facebook/re act')).toMatch(/repository/i);
  });
});
