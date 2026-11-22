import { describe, expect, it } from 'vitest';
import { MAX_CONTENT_BYTES, planContent, rawUrl } from '../src/data/content';

const base = {
  owner: 'vitejs',
  repo: 'vite',
  ref: 'abc123',
  path: 'packages/vite/src/node/server/index.ts',
  size: 4000,
  binary: false,
  synthetic: false,
};

describe('rawUrl', () => {
  it('pins the file to a commit and encodes each path segment', () => {
    expect(rawUrl('o', 'r', 'abc', 'docs/a b/#c.md')).toBe(
      'https://raw.githubusercontent.com/o/r/abc/docs/a%20b/%23c.md',
    );
  });
});

describe('planContent', () => {
  it('fetches ordinary text files from raw.githubusercontent.com', () => {
    expect(planContent(base)).toEqual({
      kind: 'fetch',
      url: 'https://raw.githubusercontent.com/vitejs/vite/abc123/packages/vite/src/node/server/index.ts',
    });
  });

  it('never downloads binaries, huge files or synthetic ones', () => {
    expect(planContent({ ...base, binary: true }).kind).toBe('binary');
    expect(planContent({ ...base, size: MAX_CONTENT_BYTES + 1 })).toEqual({
      kind: 'too-big',
      size: MAX_CONTENT_BYTES + 1,
    });
    expect(planContent({ ...base, synthetic: true }).kind).toBe('unavailable');
  });
});
