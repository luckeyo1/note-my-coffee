# Coffee Notes App - Google Login Implementation Blueprint

## Overview
This project is a coffee brewing recipe logger that uses Firebase for authentication and data storage. Users can log their espresso or hand drip recipes, including dosing, temperature, time, and yield.

## Current State
- HTML/CSS/JS frontend is mostly complete.
- Firebase SDKs are integrated via CDN in `firebase-config.js`.
- `main.js` and `logbook.js` handle authentication state changes.
- `storage.js` implements a dual-storage strategy: Firestore for logged-in users and localStorage for guests.
- **Issue:** `firebase-config.js` contains placeholders (`YOUR_API_KEY`, etc.).
- **Issue:** `style.css` has missing tokens (`--ink-dark`, `--font-brand`).

## Planned Changes
1.  **Firebase Configuration:**
    - Update `firebase-config.js` to prompt the user or provide a clear structure for their configuration.
    - Ensure all necessary Firebase modules are correctly imported and exported.
2.  **CSS Polish:**
    - Fix missing CSS variables in `:root`.
    - Ensure the login/logout buttons are visually consistent with the brand.
3.  **UI/UX Improvements for Auth:**
    - Add a "Login Nudge" when saving a recipe as a guest, explaining the benefits of syncing (Firestore).
    - Ensure the user profile display is polished.
4.  **Verification:**
    - Check for any console errors.
    - Verify the auth flow logic.

## Action Steps
1.  [ ] Fix `style.css` variables.
2.  [ ] Refine `firebase-config.js` structure.
3.  [ ] Add a login nudge in `main.js` when saving as a guest.
4.  [ ] Provide instructions for the user to insert their Firebase config.
