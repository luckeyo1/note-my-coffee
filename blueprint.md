# Current release: Coupang Partners connection (2026-11-12)

Purpose: connect the existing coffee recommendations to the owner's Coupang
Partners account without adding interruptive ads to the brewing workflow.

Scope and steps:
1. Publish the four previously generated equipment affiliate links. Preserve the
   four working bean links and the existing profile-specific recommendations.
2. Show a clear commission disclosure before recommendations in both quizzes,
   including the landing page's translated content. Distinguish quiz bean clicks
   from telepathy bean/equipment clicks in the existing analytics event.
3. Refresh the service-worker cache so returning web/PWA users receive the links.
4. Check syntax, the repository's bean-link check, a hosted preview, and production.
5. Register the public website and Play Store listing in Partners and verify the
   saved state separately. Registration and actual sales are not established by a
   source-code change or a successful redirect alone.

The existing production design and PWA are retained. The older plan below is
historical and does not describe this release's current design or PWA status.

# Coffee Notes App - Google Login & PWA Implementation Blueprint

## Overview
This project is a coffee brewing recipe logger that uses Firebase for authentication and data storage. Users can log their espresso or hand drip recipes, including dosing, temperature, time, and yield.

## Current State
- HTML/CSS/JS frontend is mostly complete.
- Firebase SDKs are integrated via CDN in `firebase-config.js`.
- `main.js` and `logbook.js` handle authentication state changes.
- `storage.js` implements a dual-storage strategy: Firestore for logged-in users and localStorage for guests.
- **Landing Page:** A basic functional landing page exists but needs UI/UX sophistication (Modern CSS, 3D graphics, responsiveness).

## Planned Changes
1.  **Landing Page Enhancement (High Priority):**
    - Integrate Three.js 3D background for a premium feel.
    - Use Modern CSS (Container Queries, `:has()`, Cascade Layers).
    - Implement smooth scroll animations and hover effects (glow).
    - Align typography and color palette with the core app's luxury aesthetic (Gold & Ink).
2.  **Firebase Configuration & Offline Support:**
    - Update `firebase-config.js` to prompt the user or provide a clear structure for their configuration.
    - Enable multi-tab offline persistence in Firebase Firestore to support seamless offline interactions.
3.  **CSS Polish:**
    - Ensure the landing page and app shell share a unified token system.
4.  **Storage & Performance Optimization:**
    - Implement client-side image compression in `main.js` to prevent quota issues.
5.  **Remove Progressive Web App (PWA) Features:**
    - Clean up all PWA-related code and files, including Service Worker, manifest link, and iOS home screen meta tags.

## Action Steps
1.  [x] Fix `style.css` variables.
2.  [x] Refine `firebase-config.js structure.
3.  [x] **Enhance `index.html` UI/UX.**
    - [x] Add `three-canvas` container.
    - [x] Import `landing.js`.
    - [x] Apply Modern CSS features.
4.  [ ] Implement client-side image compression in `main.js`.
5.  [ ] Reduce maximum photo size limit in `main.js`.
6.  [x] **Remove PWA Features:**
    - [x] Delete `manifest.json`.
    - [x] Delete `icon.svg` and `icon-maskable.svg`.
    - [x] Delete `sw.js` for Service Worker caching.
    - [x] Remove Service Worker registration script in `index.html`, `app.html`, and `logbook.html`.
    - [x] Remove manifest, apple-touch-icon, and PWA-related meta tags in `index.html`, `app.html`, and `logbook.html`.

