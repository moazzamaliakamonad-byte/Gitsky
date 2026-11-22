import { parseRepoInput } from './parseRepoInput';

export type PathRoute = { repo: string; branch?: string } | { user: string };

const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/**
 * The "swap the domain" trick: take a GitHub URL, replace `github.com` with the site,
 * and land on that repo's sky. Reads the address-bar path below the site's base:
 *
 * - `/owner/repo` (and anything GitHub puts after it: `/pulls`, `/tree/<branch>/…`)
 * - a whole GitHub URL pasted after the site: `/https://github.com/owner/repo`
 * - `/login` or `/@login`, like a GitHub profile URL: that person's universe
 *
 * Returns null for the home page and for anything that isn't a valid GitHub name.
 */
export function routeFromPath(pathname: string, base: string): PathRoute | null {
  const root = base.endsWith('/') ? base : `${base}/`;
  let rest: string;
  if (pathname.startsWith(root)) rest = pathname.slice(root.length);
  else if (`${pathname}/` === root) rest = '';
  else return null;

  rest = rest
    .replace(/^https?:\/+/i, '')
    .replace(/^www\./i, '')
    .replace(/^github\.com(?=\/|$)/i, '');
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  if (parts.length === 1) {
    const login = safeDecode(parts[0]).replace(/^@/, '');
    return LOGIN_RE.test(login) ? { user: login } : null;
  }

  const parsed = parseRepoInput(parts.join('/'));
  if (!parsed.ok) return null;
  const { owner, repo, branch } = parsed.ref;
  return branch ? { repo: `${owner}/${repo}`, branch } : { repo: `${owner}/${repo}` };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
