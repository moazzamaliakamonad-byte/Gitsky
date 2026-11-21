import { hashString } from './hash';
import type { Commit, FileEntry, RepoData, RepoMeta, Sampling } from './types';

/**
 * Compact on-disk format (bundled snapshots and the IndexedDB cache).
 *
 * Paths share long prefixes, so we store each directory once in `dirs` and each
 * file as [dirIndex, name, bytes]. Commits reference files by index. For a 6k-file
 * repo this roughly halves the JSON before gzip.
 */
export interface SnapshotV1 {
  v: 1;
  meta: RepoMeta;
  branch: string;
  head: string;
  truncated: boolean;
  fetchedAt: string;
  sampling: Sampling;
  capped: { originalFileCount: number } | null;
  dirs: string[];
  files: [number, string, number][];
  /** s=sha, m=message, a=author, d=unix seconds, f=file indices, n=changed count */
  commits: { s: string; m: string; a: string; d: number; f: number[]; n: number }[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export interface ApiTreeEntry {
  path: string;
  type: string;
  size?: number;
}

/** Keep blobs (files), drop trees (dirs) and commits (submodules). Sorted by path. */
export function normalizeTree(entries: ApiTreeEntry[]): FileEntry[] {
  const files: FileEntry[] = [];
  for (const e of entries) {
    if (e.type === 'blob') files.push({ path: e.path, size: e.size ?? 0 });
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * Keep at most `max` files. Files in `keep` (e.g. touched by sampled commits) always
 * survive; the rest are chosen by a stable hash of the path, which is an unbiased,
 * deterministic sample that preserves the folder structure's shape.
 */
export function capFiles(
  files: FileEntry[],
  keep: Set<string>,
  max: number,
): { files: FileEntry[]; capped: { originalFileCount: number } | null } {
  if (files.length <= max) return { files, capped: null };
  const chosen = new Set<number>();
  files.forEach((f, i) => {
    if (keep.has(f.path) && chosen.size < max) chosen.add(i);
  });
  const rest = files
    .map((f, i) => ({ i, h: hashString(f.path) }))
    .filter(({ i }) => !chosen.has(i))
    .sort((a, b) => a.h - b.h);
  for (const { i } of rest) {
    if (chosen.size >= max) break;
    chosen.add(i);
  }
  return {
    files: files.filter((_, i) => chosen.has(i)),
    capped: { originalFileCount: files.length },
  };
}

export function encodeSnapshot(data: RepoData): SnapshotV1 {
  const dirIndex = new Map<string, number>();
  const dirs: string[] = [];
  const files = data.files.map((f): [number, string, number] => {
    const slash = f.path.lastIndexOf('/');
    const dir = slash < 0 ? '' : f.path.slice(0, slash);
    let di = dirIndex.get(dir);
    if (di === undefined) {
      di = dirs.length;
      dirs.push(dir);
      dirIndex.set(dir, di);
    }
    return [di, f.path.slice(slash + 1), f.size];
  });
  return {
    v: 1,
    meta: data.meta,
    branch: data.branch,
    head: data.headSha,
    truncated: data.truncated,
    fetchedAt: data.fetchedAt,
    sampling: data.sampling,
    capped: data.capped,
    dirs,
    files,
    commits: data.commits.map((c) => ({
      s: c.sha,
      m: c.message,
      a: c.author,
      d: Math.round(Date.parse(c.date) / 1000),
      f: c.files,
      n: c.changedCount,
    })),
  };
}

export function decodeSnapshot(raw: unknown): RepoData {
  if (!isObj(raw)) throw new SnapshotError('Snapshot is not an object');
  if (raw.v !== 1) throw new SnapshotError(`Unsupported snapshot version: ${String(raw.v)}`);
  const s = raw as unknown as SnapshotV1;
  if (
    !isObj(s.meta) ||
    !Array.isArray(s.dirs) ||
    !Array.isArray(s.files) ||
    !Array.isArray(s.commits)
  ) {
    throw new SnapshotError('Snapshot is missing fields');
  }

  const files: FileEntry[] = s.files.map(([di, name, size]) => {
    const dir = s.dirs[di];
    if (typeof dir !== 'string' || typeof name !== 'string' || typeof size !== 'number') {
      throw new SnapshotError('Bad file entry');
    }
    return { path: dir ? `${dir}/${name}` : name, size };
  });

  const commits: Commit[] = s.commits.map((c) => {
    for (const fi of c.f) {
      if (!Number.isInteger(fi) || fi < 0 || fi >= files.length) {
        throw new SnapshotError(`Commit ${c.s} references missing file ${fi}`);
      }
    }
    return {
      sha: c.s,
      message: c.m,
      author: c.a,
      date: new Date(c.d * 1000).toISOString(),
      files: c.f,
      changedCount: c.n,
    };
  });

  return {
    meta: s.meta,
    branch: s.branch,
    headSha: s.head,
    truncated: Boolean(s.truncated),
    files,
    commits,
    sampling: s.sampling,
    fetchedAt: s.fetchedAt,
    capped: s.capped ?? null,
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
