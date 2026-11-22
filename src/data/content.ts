/**
 * A file's text, for its planet system and the code panel.
 *
 * Fetched from raw.githubusercontent.com, pinned to the commit the sky was charted at,
 * so the content always matches the stars. Raw downloads don't count against the GitHub
 * API's 60-requests-an-hour budget, and no token is ever sent there.
 */
export const MAX_CONTENT_BYTES = 400 * 1024;

export type ContentPlan =
  | { kind: 'fetch'; url: string }
  | { kind: 'binary' }
  | { kind: 'too-big'; size: number }
  | { kind: 'unavailable'; reason: string };

export interface ContentTarget {
  owner: string;
  repo: string;
  /** Commit SHA (preferred) or branch name. */
  ref: string;
  path: string;
  size: number;
  /** The file is an image, font, archive or other binary format. */
  binary: boolean;
  /** Synthetic stress-test files have no content anywhere. */
  synthetic: boolean;
}

export function rawUrl(owner: string, repo: string, ref: string, path: string) {
  const enc = (s: string) => s.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${enc(owner)}/${enc(repo)}/${encodeURIComponent(ref)}/${enc(path)}`;
}

/** Decide what to do before touching the network. */
export function planContent(t: ContentTarget): ContentPlan {
  if (t.synthetic)
    return { kind: 'unavailable', reason: 'This is a generated test file with no content.' };
  if (t.binary) return { kind: 'binary' };
  if (t.size > MAX_CONTENT_BYTES) return { kind: 'too-big', size: t.size };
  return { kind: 'fetch', url: rawUrl(t.owner, t.repo, t.ref, t.path) };
}

const cache = new Map<string, Promise<string>>();
const CACHE_SIZE = 40;

/** Fetch text once per URL (small in-memory LRU). Rejects with 'binary' if it isn't text. */
export function fetchText(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit) {
    cache.delete(url);
    cache.set(url, hit);
    return hit;
  }
  const p = fetch(url, { credentials: 'omit' }).then(async (res) => {
    if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : `http-${res.status}`);
    const text = await res.text();
    if (text.includes('\u0000')) throw new Error('binary');
    return text;
  });
  p.catch(() => cache.delete(url));
  cache.set(url, p);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return p;
}
