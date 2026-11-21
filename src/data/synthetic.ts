import { hashString } from './hash';
import type { Commit, FileEntry, RepoData } from './types';

/**
 * A synthetic repo for performance testing only (`?stress=50000`). It is named and
 * described as synthetic everywhere it appears, so it can't be mistaken for real data.
 * Shape: a few big top-level folders, nested 1–4 levels, mixed languages, uneven sizes.
 */
export function syntheticRepo(n: number): RepoData {
  const tops = [
    'src',
    'packages',
    'test',
    'docs',
    'examples',
    'vendor',
    'tools',
    'assets',
    'scripts',
  ];
  const exts = ['ts', 'tsx', 'js', 'go', 'rs', 'md', 'json', 'css', 'py', 'c', 'h', 'png'];
  const files: FileEntry[] = [];
  for (let i = 0; i < n; i++) {
    const h = hashString(`f${i}`);
    const top = tops[(h % 97) % tops.length];
    const depth = 1 + ((h >>> 8) % 4);
    const parts = [top];
    for (let d = 1; d < depth; d++) parts.push(`m${(h >>> (10 + d * 3)) % (6 + d * 4)}`);
    const ext = exts[(h >>> 20) % exts.length];
    files.push({
      path: `${parts.join('/')}/file${i}.${ext}`,
      size: Math.round(Math.exp((((h >>> 4) % 1000) / 1000) * 12)), // 1 B … ~160 KB, log-uniform
    });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : 1));

  const commits: Commit[] = [];
  for (let c = 0; c < 25; c++) {
    const touched = new Set<number>();
    const count = 1 + (hashString(`c${c}`) % 12);
    for (let k = 0; k < count; k++) touched.add(hashString(`c${c}:${k}`) % n);
    commits.push({
      sha: hashString(`sha${c}`).toString(16).padStart(8, '0'),
      message: `Synthetic commit ${c + 1}`,
      author: `author-${c % 5}`,
      date: new Date(Date.UTC(2025, 0, 1 + c)).toISOString(),
      files: [...touched],
      changedCount: touched.size,
    });
  }

  return {
    meta: {
      owner: 'synthetic',
      repo: `stress-${n}`,
      fullName: `synthetic/stress-${n}`,
      description: 'Generated for performance testing. Not a real repository.',
      stars: 0,
      language: null,
      defaultBranch: 'main',
      htmlUrl: 'https://github.com',
    },
    branch: 'main',
    headSha: 'synthetic',
    truncated: false,
    files,
    commits,
    sampling: { listed: 25, detailed: 25, withToken: false },
    fetchedAt: new Date(Date.UTC(2025, 0, 26)).toISOString(),
    capped: null,
  };
}
