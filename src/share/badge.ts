import { repoParam } from './shareLayout';

/**
 * The site's root URL: the one the build was told about (VITE_SITE_URL, set in CI),
 * or else this page's origin plus the base path.
 */
export function siteRoot(configured: string | undefined, href: string, base: string): string {
  if (configured && /^https?:\/\//.test(configured))
    return configured.endsWith('/') ? configured : `${configured}/`;
  return `${new URL(href).origin}${base}`;
}

/** A README badge that opens the repo's sky. */
export function badgeMarkdown(site: string, fullName: string): string {
  return `[![View in Gitsky](${site}badge.svg)](${site}?repo=${repoParam(fullName)})`;
}
