// Note My Coffee — service worker
// Strategy: network-first (always try the network, fall back to cache offline).
// Cache name is versioned; old versions are deleted on activate.

const VERSION = 'v20';
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
  'pay.js',
  'pay-success.html',
  'pay-fail.html',
  'storage.js',
  'firebase-config.js',
  'auth-ui.js',
  'logo.svg',
  'logo-dark.svg',
  'favicon.svg',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'privacy.html',
  'delete-account.html',
  // Pretendard의 @font-face 선언만 미리 받는다. woff2 서브셋 92개(3.1MB)는
  // 여기 넣지 않는다 — unicode-range 덕에 브라우저가 실제로 쓰인 글자 범위만
  // 내려받고, 동일 출처라 아래 network-first 경로가 알아서 캐시한다.
  'font/pretendard/pretendard.css'
];

// Optional assets: art that may not be in the repo yet. addAll() rejects the
// whole install if a single entry 404s, so these are added one by one and their
// failures ignored. share-card.js is deliberately absent — it is lazily
// imported and left to runtime caching.
const OPTIONAL_ASSETS = [
  'img/hero-plate.webp',
  'img/story-notebook.webp',
  'img/mid-cta-plate.webp'
];

// ── Install: warm the cache, then take over immediately ────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(PRECACHE_ASSETS);
        await Promise.all(
          OPTIONAL_ASSETS.map((url) => cache.add(url).catch(() => {}))
        );
      })
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
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );
}

// Auth / API / analytics / extension traffic must bypass the SW entirely.
// Analytics beacons in particular must never be cached or replayed from cache —
// a network-first SW would otherwise write /g/collect responses into the cache.
function isPassthrough(req, url) {
  return (
    req.url.startsWith('chrome-extension://') ||
    url.hostname === 'apis.google.com' ||
    url.hostname === 'www.gstatic.com' ||
    // GA4 collects via regional subdomains (region1., region2., …), so match the
    // whole suffix rather than listing hosts that will change out from under us.
    url.hostname.endsWith('google-analytics.com') ||
    url.hostname === 'analytics.google.com' ||
    url.hostname.endsWith('googletagmanager.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.hostname.endsWith('tosspayments.com') ||
    // 카카오 로그인(OIDC): kauth.kakao.com은 인증·토큰 엔드포인트라 절대 캐시하면 안 되고,
    // kakaocdn.net은 프로필 사진 호스트다. 여기 없으면 network-first SW가 인증 응답을
    // 캐시에 써두고, 오프라인이나 느린 연결에서 만료된 응답을 되돌려 로그인이 깨진다.
    url.hostname.endsWith('kakao.com') ||
    url.hostname.endsWith('kakaocdn.net') ||
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
