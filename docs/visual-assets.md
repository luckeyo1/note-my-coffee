# Visual assets — October 2026

## Coffee journal photograph

`img/coffee-journal-bright.webp`: 1536×1024, 72,068 bytes. Generated with the
built-in ImageGen tool, then encoded as WebP (quality 82). Existing artwork was
preserved. Used as a decorative, lazy-loaded image in the landing story band.
The image has an empty alt attribute because the surrounding text supplies its
meaning. The container reserves its height to prevent layout movement.

Generation prompt:

> Use case: photorealistic-natural. Asset type: Note My Coffee website hero photo.
> Generate a wide landscape editorial still-life photograph, 1536x1024 composition.
> Warm off-white cream matte plaster surface (#FCFAF6), soft natural window daylight,
> gentle shadows. A completely plain terracotta ceramic cup filled with dark coffee
> on the RIGHT third, beside a small pile of roasted coffee beans and the corner of
> a blank cream notebook, delicate pale oak texture. Left half largely empty cream
> negative space; coffee cup visible in right center and not cut off. Bright airy
> minimal calm premium coffee journal mood, warm low saturation terracotta #B4532A
> palette, natural real materials, no black backdrop. No text, letters, numbers,
> logos, brand packaging, hands, people, screens or watermarks. Single coherent
> photo, not collage.

The hero placement was inspected and rejected because the product preview covered
the cup. The final placement replaces the empty story band and works on mobile.

## Telepathy social preview

`og-telepathy.png`: 1200×630. Text and vector primitives rendered with Pillow,
using the telepathy page's espresso, cream and clay palette. Open Graph and Twitter
metadata both reference this dedicated image, leaving the main site's card intact.

Rebuild with Pillow and a Korean font:

```sh
python scripts/render-telepathy-og.py --font /path/to/Korean-Regular.ttf
```

The original render used Windows Malgun Gothic. This build script is excluded from
Firebase Hosting by the existing `scripts/**` rule; no runtime dependency is added.

## Validation

- Local desktop and 390px mobile render inspected; photograph loads and no horizontal
  overflow is present.
- New PNG dimensions match the 1200×630 metadata and Korean text is rendered correctly.
- Image files are under 90 KB each; photograph uses lazy loading and async decoding.
- `git diff --check` passes.
- Live social crawler refresh and production authentication/payments are outside
  this visual change. A social preview becomes reachable only after deployment.

Do not merge until the visual change has been reviewed: merging to main triggers
the repository's production hosting workflow. PR creation also triggers existing
preview hosting workflows; those are separate from production.

## Logo C — coffee-bean nib (November 2026)

The mark is a coffee bean whose centre crease becomes the slit of a fountain-pen
nib: coffee and note-taking in one shape. It replaces the bookmark-and-cup mark.
Colours follow the app tokens: clay `#B4532A` tile, cream `#FCFAF6` mark,
ink `#241C15` for the bare mark on light pages.

`scripts/render-brand-assets.mjs` is the single source of truth. It writes, from one
set of coordinates on a 512 grid:

| File | What it is |
|---|---|
| `logo-dark.svg` / `logo.svg` | Bare ink / cream mark; the hole and slit are masked out so any background shows through |
| `favicon.svg` | Clay rounded tile |
| `icon-192.png`, `icon-512.png` | Clay rounded tile, transparent corners (manifest `any`) |
| `icon-maskable-512.png` | Full-bleed clay, mark scaled to 0.9 so its farthest point sits 148px from centre — inside both the W3C safe zone (204.8) and Android's 66dp circle (~156) |
| `icon-monochrome-512.png` | White silhouette (manifest `monochrome`) |
| `apple-touch-icon.png` | 180px full-bleed clay; iOS rounds the corners |
| `badge-96.png` | White silhouette for the Android status bar (`firebase-messaging-sw.js`) |
| `store/android/play-icon-512.png` | Play Console listing icon: full-bleed square, 32-bit PNG |

Run `node scripts/render-brand-assets.mjs` (needs Playwright with Chromium) after
changing the coordinates or colours; do not edit the generated files by hand.

`og-image.png`, the store screenshots and `img/screenshot-*.webp` are raster images
whose HTML sources are not in the repository. In those, only the old mark was swapped
for the new one in place (background rebuilt from the surrounding pixels, new mark
composited at the same height and centre). The Play Console icon and screenshots
must be uploaded by hand. The installed Android app's launcher icon changes only
after the TWA is rebuilt (`bubblewrap update` then `bubblewrap build`).
