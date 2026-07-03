// Note My Coffee — service worker
// Strategy: network-first (always try the network, fall back to cache offline).
// Cache name is versioned; old versions are deleted on activate.

const VERSION = 'v7';
const CACHE_NAME = `note-my-coffee-${VERSION}`;

const PRECACHE_ASSETS = [
  './',
  'index.html',
  'app.html',
  'logbook.html',
  'style.css',
  'main.js',
  'logbook.js',
  'landing.js',
  'storage.js',
  'firebase-config.js',
  'logo.svg',
  'logo-dark.svg',
  'favicon.svg'
];

// ── Install: warm the cache, then take over immediately ────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: drop every cache that isn't the current version ──────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith('note-my-coffee-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Only same-origin + known static CDNs should ever be written to the cache.
function isCacheable(url) {
  return (
    url.origin === self.location.origin ||
    url.hostname === 'unpkg.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );
}

// Auth / API / extension traffic must bypass the SW entirely.
function isPassthrough(req, url) {
  return (
    req.url.startsWith('chrome-extension://') ||
    url.hostname === 'apis.google.com' ||
    url.hostname === 'www.gstatic.com' ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    (url.hostname.endsWith('googleapis.com') && url.hostname !== 'fonts.googleapis.com')
  );
}

// A redirected response cannot be handed back to a navigation request: the
// browser fails the navigation with ERR_FAILED. Firebase `cleanUrls` 301s the
// `*.html` links used for in-app navigation (logbook.html → /logbook, etc.),
// so re-wrap any redirected response into a fresh, non-redirected one. The
// body the SW sees is already decoded, so drop content-encoding/length to
// avoid a double-decode (ERR_CONTENT_DECODING_FAILED).
function undoRedirect(res) {
  if (!res || !res.redirected) return res;
  const headers = new Headers(res.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers
  });
}

// ── Fetch: network-first with cache fallback ───────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (isPassthrough(req, url)) return;

  event.respondWith(networkFirst(req, url));
});

async function networkFirst(req, url) {
  const cache = await caches.open(CACHE_NAME);
  const isNav = req.mode === 'navigate';

  try {
    // For navigations, fetch the URL string (not the Request object): a
    // navigate-mode Request ignores redirect:'follow', producing an
    // opaqueredirect response the SW cannot use behind Firebase/CDN redirects.
    let res = isNav ? await fetch(req.url) : await fetch(req);
    if (isNav) res = undoRedirect(res); // never return a redirected nav response

    if (res && res.status === 200 && isCacheable(url)) {
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return isNav ? undoRedirect(cached) : cached;

    if (isNav) {
      const p = url.pathname;
      if (p.includes('logbook')) return undoRedirect(await cache.match('logbook.html'));
      if (p.includes('app')) return undoRedirect(await cache.match('app.html'));
      return undoRedirect(await cache.match('index.html'));
    }
    throw err;
  }
}
