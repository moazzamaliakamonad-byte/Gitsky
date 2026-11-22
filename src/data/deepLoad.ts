import { RequestBudget } from './budget';
import { fetchDeepHistory } from './deepFetch';
import { decodeHistory, deepFileOf, encodeHistory, type DeepHistory } from './deepTime';
import { createGitHubClient } from './github';
import { getToken } from './token';
import type { BundledEntry, RepoData } from './types';

const PREFIX = 'gitsky:deep:';

function cacheKey(data: RepoData) {
  return `${PREFIX}${data.meta.fullName}@${data.headSha}`;
}

function readCache(data: RepoData): DeepHistory | null {
  try {
    const raw = localStorage.getItem(cacheKey(data));
    return raw ? decodeHistory(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Keep only the newest few histories: each can be a few hundred KB. */
function writeCache(data: RepoData, h: DeepHistory) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX) && k !== cacheKey(data)) keys.push(k);
    }
    for (const k of keys.slice(0, Math.max(0, keys.length - 3))) localStorage.removeItem(k);
    localStorage.setItem(cacheKey(data), JSON.stringify(encodeHistory(h)));
  } catch {
    // Storage full or blocked: the history still works, it just isn't kept.
  }
}

/**
 * A repo's deep history: from the featured sky's prebuilt file, else this browser's
 * cache, else GitHub (about 21 requests, fewer if the budget is low).
 */
export async function loadDeepHistory(
  data: RepoData,
  opts: {
    bundled?: BundledEntry;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<DeepHistory> {
  if (opts.bundled?.deep) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}snapshots/${deepFileOf(opts.bundled)}`, {
        signal: opts.signal,
      });
      if (res.ok) {
        const h = decodeHistory(await res.json());
        if (h.born.length === data.files.length) return h;
      }
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      // Fall through to the cache and the network.
    }
  }
  const cached = readCache(data);
  if (cached && cached.born.length === data.files.length) return cached;

  const token = getToken() ?? undefined;
  const budget = new RequestBudget({ limit: token ? 5000 : 60 });
  const client = createGitHubClient({ budget, token, signal: opts.signal });
  await client.rateLimit();
  const h = await fetchDeepHistory(data, {
    client,
    budget,
    onProgress: opts.onProgress,
  });
  writeCache(data, h);
  return h;
}
