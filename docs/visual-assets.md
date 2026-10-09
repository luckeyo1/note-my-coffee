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
