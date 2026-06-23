const CACHE_NAME = 'note-my-coffee-v1';
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

// Install Event: cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching offline shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate for app assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip Firebase Auth, Firestore dynamic operations, and browser extensions
  if (
    url.origin.includes('googleapis.com') || 
    url.origin.includes('firebase') ||
    url.origin.includes('firestore.googleapis.com') ||
    event.request.url.startsWith('chrome-extension://')
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Start the network fetch in parallel
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // Cache successful responses for our own origin or common CDNs (Three.js, Google Fonts)
            if (
              networkResponse.status === 200 &&
              (url.origin === self.location.origin ||
               url.origin.includes('unpkg.com') ||
               url.origin.includes('fonts.googleapis.com') ||
               url.origin.includes('fonts.gstatic.com'))
            ) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log('[Service Worker] Fetch failed, network offline:', error);
            // Offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
              // Try to find the matching cached page, fallback to app.html or index.html
              if (url.pathname.includes('app.html')) {
                return cache.match('app.html');
              } else if (url.pathname.includes('logbook.html')) {
                return cache.match('logbook.html');
              } else {
                return cache.match('index.html');
              }
            }
          });

        // Return cached response instantly if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});
