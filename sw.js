const CACHE_NAME = 'note-my-coffee-v2';
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
    caches.keys().then((names) =>
      Promise.all(names.map((n) => n !== CACHE_NAME && caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Pass through Firebase/Google auth and extensions
  if (
    url.origin.includes('googleapis.com') ||
    url.origin.includes('firebase') ||
    url.origin.includes('gstatic.com') ||
    event.request.url.startsWith('chrome-extension://')
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((res) => {
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
          })
          .catch(() => {
            // Offline navigation fallback — matches both /app.html and /app (cleanUrls)
            if (event.request.mode === 'navigate') {
              const p = url.pathname;
              if (p.includes('app') && !p.includes('logbook')) {
                return cache.match('app.html');
              } else if (p.includes('logbook')) {
                return cache.match('logbook.html');
              }
              return cache.match('index.html');
            }
          });

        return cached || network;
      });
    })
  );
});
