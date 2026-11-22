/* Gitsky's service worker, generated at build time from build/sw.template.js.
 *
 * - The app itself (scripts, styles, icon, the list of featured skies) is saved on the
 *   first visit, so the next visit opens instantly and works with no network.
 * - Featured skies, fonts, file contents (pinned to a commit, so they never change) and
 *   avatars are saved the first time they're used.
 * - Pages try the network first (so updates arrive) but give up after a few seconds on a
 *   slow connection and use the saved copy.
 * - GitHub API calls are never cached here: the app keeps its own cache with expiry.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = `gitsky-shell-${VERSION}`;
const RUNTIME = 'gitsky-runtime-v1';
const NAV_TIMEOUT_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('gitsky-shell-') && k !== SHELL)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function fromNetwork(request, cacheName) {
  return fetch(request).then((res) => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(request, copy));
    }
    return res;
  });
}

function cacheFirst(request) {
  return caches.match(request).then((hit) => hit || fromNetwork(request, RUNTIME));
}

/** The saved copy right away, refreshed in the background for next time. */
function staleWhileRevalidate(request) {
  return caches.match(request).then((hit) => {
    const fresh = fromNetwork(request, RUNTIME).catch(() => hit);
    return hit || fresh;
  });
}

function navigate(request) {
  const shell = new URL('./', self.registration.scope).href;
  const network = fetch(request).then((res) => {
    // Any path under the site (/owner/repo links included) is the same app page.
    if (res.status === 200 && new URL(request.url).href === shell) {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put(shell, copy));
    }
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
  return Promise.race([network.catch(() => null), timeout.then(() => null)]).then(
    (res) => res || caches.match(shell).then((hit) => hit || network),
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.href.startsWith(self.registration.scope)) {
    event.respondWith(navigate(request));
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/assets/')) event.respondWith(cacheFirst(request));
    else if (url.pathname.includes('/snapshots/')) event.respondWith(staleWhileRevalidate(request));
    else if (PRECACHE.some((p) => url.href === new URL(p, self.registration.scope).href))
      event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.hostname === 'raw.githubusercontent.com') {
    // Contents are fetched by commit SHA: the same URL always means the same bytes.
    event.respondWith(cacheFirst(request));
  } else if (
    url.hostname === 'avatars.githubusercontent.com' ||
    (url.hostname === 'github.com' && url.pathname.endsWith('.png'))
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
