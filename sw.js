const CACHE_NAME = 'note-my-coffee-v3';
const ASSETS_TO_CACHE = [
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
  'manifest.json',
  'icon.svg',
  'icon-maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.map((n) => n !== CACHE_NAME && caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Pass through: Firebase/Google auth, extensions, cross-origin CDN auth
  if (
    url.origin.includes('googleapis.com') ||
    url.origin.includes('firebase') ||
    url.origin.includes('gstatic.com') ||
    event.request.url.startsWith('chrome-extension://')
  ) {
    return;
  }

  // ── Navigation requests (HTML page loads) ────────────────────────────
  // Use redirect:'follow' so server-side redirects (cleanUrls, Cloudflare)
  // are followed transparently. DO NOT serve stale cache for navigation —
  // let the network decide the canonical URL, then fall back to cache offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(event.request, { redirect: 'follow' }))
        .then((res) => {
          // Cache a fresh copy for offline use
          if (res.ok) {
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, res.clone())
            );
          }
          return res;
        })
        .catch(() => {
          // Offline: serve the closest cached HTML page
          return caches.open(CACHE_NAME).then((cache) => {
            const p = url.pathname;
            if (p.includes('logbook')) return cache.match('logbook.html');
            if (p.includes('app'))     return cache.match('app.html');
            return cache.match('index.html');
          });
        })
    );
    return;
  }

  // ── Static assets: stale-while-revalidate ────────────────────────────
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cached) => {
        const network = fetch(event.request).then((res) => {
          if (
            res.status === 200 &&
            (url.origin === self.location.origin ||
             url.origin.includes('unpkg.com') ||
             url.origin.includes('fonts.googleapis.com') ||
             url.origin.includes('fonts.gstatic.com'))
          ) {
            cache.put(event.request, res.clone());
          }
          return res;
        });
        return cached || network;
      });
    })
  );
});
