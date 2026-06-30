// Note My Coffee — page bootstrap (classic script, must run before module scripts).
// 1) Auto-reload once when a JS chunk / module fails to load.
// 2) Register the service worker.
(function () {
  'use strict';

  // ── Auto-reload on chunk / module load failure ───────────────────────
  // After a deploy, a client on the old page may request an asset that no
  // longer exists, or the SW may hand back a stale module. A single reload
  // pulls the fresh shell. The sessionStorage flag caps it at one reload per
  // session so a genuinely broken/offline asset can't trigger a refresh loop.
  var RELOAD_KEY = 'chunk-reload-attempted';

  function looksLikeChunkError(message) {
    if (!message) return false;
    return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i
      .test(String(message));
  }

  function reloadOnce() {
    try {
      if (sessionStorage.getItem(RELOAD_KEY)) return; // already retried this session
      sessionStorage.setItem(RELOAD_KEY, '1');
    } catch (e) {
      return; // no sessionStorage → don't risk a reload loop
    }
    location.reload();
  }

  // Failed <script src> / <link> loads surface as capture-phase error events.
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target.tagName === 'SCRIPT' && target.src) {
      reloadOnce();
    } else if (looksLikeChunkError(event.message)) {
      reloadOnce();
    }
  }, true);

  // Dynamic import() failures reject a promise (e.g. landing.js' import('three')).
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    var message = reason && reason.message ? reason.message : reason;
    if (looksLikeChunkError(message)) reloadOnce();
  });

  // ── Service worker registration ──────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
