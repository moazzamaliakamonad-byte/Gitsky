import type { RepoRef } from './types';

export type ParseResult = { ok: true; ref: RepoRef } | { ok: false; error: string };

// GitHub's own rules: owners are alphanumeric + single hyphens (max 39);
// repo names allow letters, digits, '.', '-', '_' (max 100).
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Turn whatever the user pasted into `{ owner, repo, branch? }`.
 *
 * Accepts: `owner/repo`, `https://github.com/owner/repo`, `github.com/owner/repo`,
 * `git@github.com:owner/repo.git`, trailing `.git` or `/`, `?query`, `#hash`,
 * and `/tree/<branch>/...` or `/blob/<branch>/...` (first segment taken as the branch:
 * a URL can't tell us whether `feature/x/src` is branch `feature/x` or `feature`).
 */
export function parseRepoInput(raw: string): ParseResult {
  let s = raw.trim();
  if (!s) return { ok: false, error: 'Paste a GitHub repo, like facebook/react.' };

  s = s.replace(/[?#].*$/, '');

  // SSH: git@github.com:owner/repo.git
  const ssh = /^git@github\.com:(.+)$/i.exec(s);
  if (ssh) {
    s = ssh[1];
  } else if (
    /^(https?:\/\/)?(www\.)?[a-z0-9.-]+\.[a-z]{2,}\//i.test(s) ||
    /^https?:\/\//i.test(s)
  ) {
    // Looks like a URL. Only github.com is supported.
    const m = /^(?:https?:\/\/)?(?:www\.)?([^/]+)\/?(.*)$/i.exec(s);
    const host = m?.[1].toLowerCase() ?? '';
    if (host !== 'github.com') {
      return { ok: false, error: 'Only github.com repositories are supported.' };
    }
    s = m?.[2] ?? '';
  }

  const parts = s.split('/').filter(Boolean);
  if (parts.length === 0) return { ok: false, error: 'Paste a GitHub repo, like facebook/react.' };
  if (parts.length === 1) {
    if (raw.includes('github.com')) {
      return { ok: false, error: 'That link is missing the repository name (owner/repo).' };
    }
    return { ok: false, error: 'Use the owner/repo form, like facebook/react.' };
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');

  if (!OWNER_RE.test(owner)) {
    return { ok: false, error: `"${owner}" isn't a valid GitHub owner name.` };
  }
  if (!REPO_RE.test(repo) || repo === '.' || repo === '..') {
    return { ok: false, error: `"${repo}" isn't a valid repository name.` };
  }

  const ref: RepoRef = { owner, repo };
  if ((parts[2] === 'tree' || parts[2] === 'blob') && parts[3]) {
    ref.branch = decodeURIComponent(parts[3]);
  }
  return { ok: true, ref };
}
