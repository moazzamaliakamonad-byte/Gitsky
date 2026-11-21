import { decodeSnapshot, encodeSnapshot, type SnapshotV1 } from './snapshot';
import type { RepoData } from './types';

/**
 * IndexedDB cache. Two object stores:
 *
 *   repos   key "owner/repo@branch#sha" → compact snapshot + how deep we sampled
 *   latest  key "owner/repo@branch"     → the newest SHA we saved, and when
 *
 * `latest` is what makes a reload cost zero API calls: if we saved this repo
 * recently we can render it without asking GitHub anything.
 *
 * The cache is best-effort. Private windows, blocked storage, or quota errors
 * all degrade to "no cache", never to an error screen.
 */

export interface CachedRepo {
  data: RepoData;
  desiredSamples: number;
  savedAt: number;
}

export interface RepoCache {
  get(fullName: string, branch: string, sha: string): Promise<CachedRepo | null>;
  /** Newest saved SHA for a repo+branch key, plus the real branch name it was saved under. */
  latest(
    fullName: string,
    branchKey: string,
  ): Promise<{ headSha: string; branch: string; savedAt: number } | null>;
  put(data: RepoData, desiredSamples: number): Promise<void>;
}

/** Branch key meaning "whatever the default branch is" (when the URL named none). */
export const DEFAULT_BRANCH_KEY = '@default';

const VERSION = 1;

interface RepoRow {
  key: string;
  snap: SnapshotV1;
  desiredSamples: number;
  savedAt: number;
}

interface LatestRow {
  key: string;
  headSha: string;
  branch: string;
  savedAt: number;
}

const norm = (fullName: string) => fullName.toLowerCase();
const latestKey = (fullName: string, branch: string) => `${norm(fullName)}@${branch}`;
const repoKey = (fullName: string, branch: string, sha: string) =>
  `${latestKey(fullName, branch)}#${sha}`;

const NOOP: RepoCache = {
  get: async () => null,
  latest: async () => null,
  put: async () => {},
};

export async function openRepoCache(
  dbName = 'gitsky',
  factory: IDBFactory | null = globalThis.indexedDB ?? null,
): Promise<RepoCache> {
  if (!factory) return NOOP;
  let db: IDBDatabase;
  try {
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(dbName, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('repos')) d.createObjectStore('repos', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('latest'))
          d.createObjectStore('latest', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
  } catch {
    return NOOP;
  }

  function read<T>(store: string, key: string): Promise<T | null> {
    return new Promise((resolve) => {
      try {
        const req = db.transaction(store, 'readonly').objectStore(store).get(key);
        req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  return {
    async get(fullName, branch, sha) {
      const row = await read<RepoRow>('repos', repoKey(fullName, branch, sha));
      if (!row) return null;
      try {
        return {
          data: decodeSnapshot(row.snap),
          desiredSamples: row.desiredSamples,
          savedAt: row.savedAt,
        };
      } catch {
        return null; // stale or corrupt format: treat as a miss
      }
    },

    async latest(fullName, branchKey) {
      const row = await read<LatestRow>('latest', latestKey(fullName, branchKey));
      return row ? { headSha: row.headSha, branch: row.branch, savedAt: row.savedAt } : null;
    },

    async put(data, desiredSamples) {
      const savedAt = Date.now();
      const { fullName, defaultBranch } = data.meta;
      const branches =
        data.branch === defaultBranch ? [data.branch, DEFAULT_BRANCH_KEY] : [data.branch];
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(['repos', 'latest'], 'readwrite');
          tx.objectStore('repos').put({
            key: repoKey(fullName, data.branch, data.headSha),
            snap: encodeSnapshot(data),
            desiredSamples,
            savedAt,
          } satisfies RepoRow);
          for (const b of branches) {
            tx.objectStore('latest').put({
              key: latestKey(fullName, b),
              headSha: data.headSha,
              branch: data.branch,
              savedAt,
            } satisfies LatestRow);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      });
    },
  };
}
