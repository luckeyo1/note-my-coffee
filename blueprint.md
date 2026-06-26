# Coffee Notes App - Google Login & PWA Implementation Blueprint

## Overview
This project is a coffee brewing recipe logger that uses Firebase for authentication and data storage. Users can log their espresso or hand drip recipes, including dosing, temperature, time, and yield.

## Current State
- HTML/CSS/JS frontend is mostly complete.
- Firebase SDKs are integrated via CDN in `firebase-config.js`.
- `main.js` and `logbook.js` handle authentication state changes.
- `storage.js` implements a dual-storage strategy: Firestore for logged-in users and localStorage for guests.
- **Landing Page:** A basic functional landing page exists but needs UI/UX sophistication (Modern CSS, 3D graphics, responsiveness).
- **PWA Capabilities:** Initial setup of manifest.json, Service Worker for asset caching/offline support, and deep offline synchronization is being added.

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
5.  **Progressive Web App (PWA) Implementation:**
    - Design and integrate `manifest.json` with an elegant gold-and-ink themed SVG icon.
    - Implement a robust Service Worker (`sw.js`) utilizing a Stale-While-Revalidate strategy to cache static and CDN assets.
    - Add real-time online/offline indicators to notify the user when they are working offline.
    - Create a custom, premium "Add to Home Screen" banner or promotion for an app-like feel.

## Action Steps
1.  [x] Fix `style.css` variables.
2.  [x] Refine `firebase-config.js structure.
3.  [x] **Enhance `index.html` UI/UX.**
    - [x] Add `three-canvas` container.
    - [x] Import `landing.js`.
    - [x] Apply Modern CSS features.
4.  [ ] Implement client-side image compression in `main.js`.
5.  [ ] Reduce maximum photo size limit in `main.js`.
6.  [ ] **Implement PWA Features:**
    - [ ] Create `manifest.json`.
    - [ ] Create `icon.svg` and `icon-maskable.svg` for icons.
    - [ ] Create `sw.js` for Service Worker caching & offline capabilities.
    - [ ] Register Service Worker in `index.html`, `app.html`, and `logbook.html`.
    - [ ] Add offline indicators to UI in `app.html` and `logbook.html`.
    - [ ] Integrate Firestore offline persistence.
    - [ ] Add custom App Install prompt flow.

