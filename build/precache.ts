/**
 * What the service worker saves on the first visit: the app itself (its scripts and
 * styles), the icon and manifest, and the list of featured skies. Featured skies
 * themselves are saved the first time each is opened, so a first visit on a slow
 * connection doesn't download megabytes it may never show.
 */
const PUBLIC_KEEP =
  /^(favicon\.svg|apple-touch-icon\.png|manifest\.webmanifest|icon-\d+\.png|snapshots\/index\.json)$/;

export function precacheList(bundleFiles: string[], publicFiles: string[]): string[] {
  const app = bundleFiles.filter((f) => /\.(js|css)$/.test(f)).sort();
  return ['./', ...app, ...publicFiles.filter((f) => PUBLIC_KEEP.test(f))];
}
