---
name: verify
description: How to build, launch, and drive note-my-coffee for runtime verification
---

# Verifying note-my-coffee

Static web app (no build step). Serve the repo root and drive pages headlessly.

## Launch

```bash
python3 -m http.server 8787   # from repo root, background it
```

Pages: `app.html` (main brewing UI), `logbook.html`, `index.html` (landing).

## Drive

System Chromium lives at `/nix/store/lpdrfl6n16q5zdf8acp4bni7yczzcx3h-idx-builtins/bin/chromium`
(path may drift across nix rebuilds — fall back to `which chromium`).
`npm i playwright-core` in the scratchpad, then `chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] })`.

- Language: app defaults to EN; click `#l-ko` / `#l-en` to switch. `currentLang` drives i18n + API locales.
- Weather strip: `#weather-info span:last-child` (text), `#env-hint` (brewing hint). Wait until text no longer contains `…` / `확인 중` / `Getting location`.
- Geolocation: grant via Playwright context `{ geolocation: {...}, permissions: ['geolocation'] }`; omit permissions to test the denied → IP-fallback path.
- Weather fallback chain: GPS → ipapi.co (IP) → Seoul coords. Block hosts with `ctx.route('**ipapi.co**', r => r.abort())` etc. to force each stage. Data comes from api.open-meteo.com; city names from api.bigdatacloud.net.

## Gotchas

- Sandbox has zero fonts (`fc-list` empty) → screenshots render blank glyphs. Assert on DOM `textContent`, not pixels.
- Firestore/auth flows need real Google login — verify guest/local paths instead (`localStorage` via storage.js).
- The sandbox's egress IP geolocates to Taipei — IP-fallback tests will show Taipei, not Seoul.
- `innerText` reads back as `''` in the font-less sandbox even right after being set — read `textContent` instead.
- `page.reload()` intermittently crashes the headless renderer. Seed localStorage via `context.addInitScript` + a single `goto` instead of set-then-reload.
- Buttons with looping CSS animations (e.g. `#btn-save`) never pass Playwright's "stable" actionability check — click via `page.evaluate(() => el.click())`.
- Stopwatch buttons inside `#stopwatch-panel` (max-height transition) also misfire with `page.click` — a click can silently land without triggering the handler. Use `page.evaluate` clicks for everything in that panel.
