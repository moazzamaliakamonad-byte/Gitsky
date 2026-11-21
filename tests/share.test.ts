import { describe, expect, it } from 'vitest';
import { shareUrl, wrapText, shareStats, shareFileName } from '../src/share/shareLayout';

describe('shareUrl', () => {
  it('builds a ?repo= deep link on the current page, dropping other params and hashes', () => {
    expect(shareUrl('https://me.github.io/gitsky/?x=1#top', 'react/react')).toBe(
      'https://me.github.io/gitsky/?repo=react%2Freact',
    );
  });

  it('keeps the branch when it is not the default', () => {
    expect(shareUrl('http://localhost:5173/', 'o/r', 'dev')).toBe(
      'http://localhost:5173/?repo=o%2Fr%40dev',
    );
  });
});

describe('wrapText', () => {
  // Fake measure: every character is 10px wide.
  const measure = (s: string) => s.length * 10;

  it('wraps on spaces to fit the width', () => {
    expect(wrapText('the quick brown fox', 100, 3, measure)).toEqual(['the quick', 'brown fox']);
  });

  it('truncates with an ellipsis after maxLines', () => {
    const lines = wrapText('aaa bbb ccc ddd eee fff', 70, 2, measure);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(70);
  });

  it('breaks a single word that is too long', () => {
    const lines = wrapText('abcdefghijklmnop', 50, 1, measure);
    expect(lines).toEqual(['abcd…']);
  });

  it('returns no lines for empty text', () => {
    expect(wrapText('', 100, 2, measure)).toEqual([]);
  });
});

describe('shareStats', () => {
  it('formats the stat line with honest labels', () => {
    expect(shareStats({ files: 7282, stars: 252850, commits: 17, capped: null })).toEqual([
      ['7,282', 'files'],
      ['252,850', 'GitHub stars'],
      ['17', 'recent commits traced'],
    ]);
  });

  it('says when the file count is a sample', () => {
    expect(shareStats({ files: 12000, stars: 1, commits: 0, capped: 16442 })[0]).toEqual([
      '16,442',
      'files',
    ]);
  });
});

describe('shareFileName', () => {
  it('is a safe file name', () => {
    expect(shareFileName('vercel/next.js')).toBe('gitsky-vercel-next.js.png');
  });
});
