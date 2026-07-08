// Note My Coffee — page bootstrap (classic script, must run before module scripts).
// 1) Auto-reload once when a JS chunk / module fails to load.
// 2) Register the service worker.
// 3) PWA install pill: shown only when the browser fires beforeinstallprompt.
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

  // ── PWA install pill ─────────────────────────────────────────────────
  // Chrome/Edge/Android only fire beforeinstallprompt when the app is
  // installable and not yet installed, so the pill costs nothing otherwise.
  // Dismissing hides it for 14 days. Styles are inline because index.html
  // does not load style.css.
  var INSTALL_DISMISS_KEY = 'pwa-install-dismissed-at';
  var DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  var deferredInstallPrompt = null;
  var installPill = null;

  function installDismissedRecently() {
    try {
      var at = parseInt(localStorage.getItem(INSTALL_DISMISS_KEY), 10);
      return at && (Date.now() - at) < DISMISS_TTL_MS;
    } catch (e) { return false; }
  }

  function removeInstallPill() {
    if (installPill && installPill.parentNode) installPill.parentNode.removeChild(installPill);
    installPill = null;
  }

  function showInstallPill() {
    if (installPill || installDismissedRecently()) return;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;

    installPill = document.createElement('div');
    installPill.id = 'pwa-install-pill';
    installPill.style.cssText =
      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9000;' +
      'display:flex;align-items:center;gap:4px;padding:6px 6px 6px 16px;' +
      'background:#1A1614;color:#F0E5D5;border:1px solid rgba(200,169,110,0.35);' +
      'border-radius:999px;box-shadow:0 8px 28px rgba(0,0,0,0.35);' +
      'font-family:"DM Sans",system-ui,sans-serif;font-size:13px;font-weight:500;';

    var installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.textContent = '📲 앱으로 설치 · Install App';
    installBtn.style.cssText =
      'background:none;border:none;color:inherit;font:inherit;cursor:pointer;padding:6px 4px;';
    installBtn.addEventListener('click', function () {
      if (!deferredInstallPrompt) return;
      var p = deferredInstallPrompt;
      deferredInstallPrompt = null;
      p.prompt();
      p.userChoice.then(function () { removeInstallPill(); }).catch(function () {});
    });

    var dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.textContent = '✕';
    dismissBtn.style.cssText =
      'background:none;border:none;color:rgba(240,229,213,0.5);font-size:12px;' +
      'cursor:pointer;padding:8px 10px;border-radius:50%;';
    dismissBtn.addEventListener('click', function () {
      try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch (e) {}
      removeInstallPill();
    });

    installPill.appendChild(installBtn);
    installPill.appendChild(dismissBtn);
    document.body.appendChild(installPill);
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault(); // keep the mini-infobar away; we show our own pill
    deferredInstallPrompt = event;
    if (document.body) showInstallPill();
    else document.addEventListener('DOMContentLoaded', showInstallPill);
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    removeInstallPill();
  });
})();
