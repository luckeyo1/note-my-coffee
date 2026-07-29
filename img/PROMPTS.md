# 랜딩 이미지 생성 프롬프트 (GPT 이미지 생성용)

이 폴더에 들어갈 7장의 이미지를 만드는 프롬프트입니다.
톤은 **다크 무드 실사** — 랜딩의 "골드 & 잉크" 팔레트(`#080604` / `#C8A96E`)에 강제로 구속시킵니다.

## 파일명 규약

생성한 이미지는 아래 이름으로 이 폴더(`img/`)에 넣어주세요. PNG로 받아도 됩니다 —
webp 변환과 압축은 코드 쪽에서 처리합니다.

| 파일명 | 내용 | 요청 크기 | 상태 |
|---|---|---|---|
| `hero-plate.webp` | 히어로 배경 | 1536×1024 | **완료** (2026-07-29 · 40KB) |
| `story-notebook.webp` | 01 스토리 | 1536×1024 | **완료** (2026-07-29 · 52KB) |
| `mid-cta-plate.webp` | 중간 CTA 배너 배경 | 1536×1024 | **완료** (2026-07-29 · 11KB) |
| `profile-a.png` | 취향 A 화사한 향미 탐험가 | **1024×1024 정사각** | 필요 |
| `profile-b.png` | 취향 B 밸런스의 클래식 | **1024×1024 정사각** | 필요 |
| `profile-c.png` | 취향 C 고소한 위로 한 잔 | **1024×1024 정사각** | 필요 |
| `profile-d.png` | 취향 D 묵직한 바디 애호가 | **1024×1024 정사각** | 필요 |
| `og-plate.png` | OG 공유 카드 배경 | 1536×1024 | 선택 (지금 og-image.png로 충분) |

받은 PNG는 제가 크롭 + webp 변환해서 넣습니다. **정사각 4장은 가로 이미지로 대체할 수 없습니다** —
공유 카드 상단 밴드와 결과 화면 배너가 정사각 비율을 전제로 잘라 씁니다.

**8장이 다 모이기 전에도 랜딩은 정상 동작합니다.** 이미지가 없으면 해당 자리는
조용히 비워지고 기존 디자인 그대로 보입니다. 한 장씩 넣어도 됩니다.
(파일이 없는 동안 브라우저 콘솔에 404가 3건 찍히는데, 의도된 동작이라 무해합니다.)

PNG로 그대로 두고 쓰셔도 되고, 용량을 줄이려면 나중에 webp로 바꾸고 코드의
확장자만 고치면 됩니다.

---

## 반드시 알아야 할 3가지

1. **이미지 안에 한글 텍스트를 절대 요청하지 마세요.**
   현재 이미지 모델은 한글을 깨뜨립니다(자모가 뭉개지거나 없는 글자를 만듭니다).
   랜딩의 모든 텍스트는 HTML과 canvas가 그립니다. 그래서 프롬프트마다
   `no text, no letters, no numbers`를 넣어두었습니다.

2. **실제 로스터리의 포장·로고를 절대 만들지 마세요.**
   취향검사는 센터커피·프릳츠·모모스 같은 **실존 브랜드의 실제 상품**을 추천합니다.
   그 브랜드 봉투처럼 보이는 AI 이미지는 실제 회사를 잘못 표현하는 것이 됩니다.
   그래서 프로필 아트는 전부 원두·재료 정물이고, 프롬프트마다 `unbranded` /
   `no packaging`을 못박았습니다.

3. **인물 없음(얼굴도, 손도).** 인물이 들어가면 (a) 스톡 사진 느낌이 나고
   (b) 초상 문제가 생깁니다. 특히 01 스토리 섹션은 "바리스타로 일하면서…"라는
   1인칭 서사라, AI로 만든 얼굴을 두면 없는 사람을 창업자로 내세우는 셈이 됩니다.
   본인 실제 사진이라면 물론 좋습니다.

4. **화면이 켜진 폰·태블릿·모니터를 넣지 마세요.** 모델이 그리는 앱 UI는 항상
   Note My Coffee가 아닌 다른 앱입니다(실제 앱은 크림색 라이트 테마 +
   도징·온도·시간·수율 슬라이더인데, 모델은 다크 테마 + 테이스팅 노트 +
   7각형 플레이버 휠을 그려냅니다). 없는 제품을 보여주는 셈이 됩니다.
   실제 화면은 랜딩이 CSS로 직접 그리고 있으니 사진에는 필요 없습니다.

5. **컵·노트·텀블러에 로고·모노그램을 넣지 마세요.** 모델이 금색 이니셜 마크를
   만들어 붙이는데, Note My Coffee의 실제 로고는 `logo.svg`(북마크 형태)입니다.
   없는 브랜드 굿즈와 없는 로고를 만들어내게 됩니다.

> **1차 생성분(2026-07-29) 후기:** 톤·광원·팔레트·왼쪽 여백은 전부 훌륭했습니다.
> 다만 5장 중 2장에 가짜 앱 화면이, 5장 전부에 가짜 모노그램이, 1장에 얼굴이
> 들어와서 크롭으로 잘라내고 3장만 썼습니다. 위 4·5번을 프롬프트에 넣으면
> 다음 번엔 잘라낼 필요가 없습니다.

---

## 0. 공통 스타일 블록

**7개 프롬프트 전부의 맨 앞에 이 블록을 붙이세요.** 이게 7장을 한 세트로 묶어줍니다.
빼먹으면 톤이 흩어져서 따로 만든 것처럼 보입니다.

```
Dark chiaroscuro still-life photography. A single warm light source from the
upper left, hard falloff into near-black shadow — at least 70% of the frame is
shadow. Background and shadows are almost pure black (hex #080604). The only
bright accents are warm brass/amber (hex #C8A96E). Fully desaturated except for
that warm highlight — absolutely no blue, teal, cyan, green, or magenta tones.
Matte finish, fine analog film grain, subtle lens vignette. Shot on an 85mm lens
at f/2, shallow depth of field, natural imperfect surfaces.
No text, no letters, no numbers, no captions, no watermarks.
No logos, no brand marks, no monograms, no initials, no emblems on any object —
mugs, tumblers, notebooks and cups must be completely plain and unbranded.
No phones, no tablets, no laptops, no screens, no displays, no app interfaces
of any kind.
No people, no faces, no hands. Not a bright airy cafe, not a white background,
not a flat-lay product shot, not glossy commercial advertising lighting.
```

---

## 1. `hero-plate.png` — 히어로 배경 플레이트

**쓰이는 곳:** 히어로 전체 배경. `opacity: 0.28`로 깔리고 오른쪽→왼쪽 그라데이션
마스크가 걸립니다. 왼쪽에 헤드라인("어제의 완벽한 한 잔을, 오늘 그대로."),
오른쪽에 폰 목업이 올라가므로 **왼쪽 2/3가 반드시 비어 있어야** 합니다.

**요청 크기:** 1536×1024 (가로)

```
[공통 스타일 블록]

Extreme close-up of a double espresso extraction. Two thin ropes of dark amber
espresso fall from a plain unbranded stainless steel portafilter spout into a
small clear glass, the liquid glowing where the light passes through it. Faint
wisps of steam catch the light above the glass.

COMPOSITION IS CRITICAL: the portafilter and glass sit entirely in the RIGHT
THIRD of the frame. The left two thirds is empty, uninterrupted, near-black
negative space with only a faint amber glow bleeding in from the right —
deliberately reserved as empty space for text to be placed later. Do not put
any object, texture, or detail in the left two thirds.
```

---

## 2. `story-notebook.png` — 01 스토리 섹션

**쓰이는 곳:** 01 "기억은 흐려진다" 섹션의 풀블리드 밴드(위아래가 `#080604`로 페이드).

**빈 노트가 핵심 은유입니다** — 기록하지 않았다는 것. 그래서 페이지에 글씨가 있으면
의미가 반대로 갑니다. (한글 깨짐 방지와 목적이 일치합니다.)

**요청 크기:** 1536×1024 (가로)

```
[공통 스타일 블록]

An open paper notebook lying on a dark, worn wooden cafe counter. The pages are
stained with overlapping dried coffee ring marks and faint brown smudges. THE
PAGES ARE COMPLETELY BLANK — no handwriting, no printed lines, no letters, no
numbers, no marks that resemble writing of any kind. Only coffee stains and
paper fiber texture.

Beside the notebook: a plain unbranded stainless steel portafilter holding a
spent, cracked puck of used coffee grounds, and a scattering of loose grounds on
the wood. A single warm light rakes low across the counter from the left; the
far side of the frame falls completely into black. Quiet, melancholy,
end-of-day mood.
```

---

## 3. `profile-a~d.png` — 취향검사 프로필 아트 4종

**쓰이는 곳:** 취향검사 결과 화면 + **공유 카드 상단**. 프로필마다 확연히 달라야
"내 결과"라는 감각이 생깁니다.

**요청 크기:** 4장 모두 1024×1024 (정사각)

> ### ⚠️ 4장을 한 대화에서 연속으로 생성하세요
> 첫 장(A)을 만든 뒤, 나머지 3장(B·C·D)에는 아래 **일관성 문장**을 덧붙이세요.
> 따로따로 만들면 조명과 바닥 재질이 달라져서 세트로 안 보입니다.
>
> ```
> Match the previous image exactly: same lighting direction and intensity, same
> camera angle, same dark slate surface, same palette and grain. Change only the
> subject matter described below.
> ```

### `profile-a.png` — A "화사한 향미 탐험가" (#Floral #Fruity #Acidic)

> 세트에서 **가장 밝고 투명한** 한 장

```
[공통 스타일 블록]

Still life at a 45-degree angle on dark slate: pale, light-roast coffee beans
scattered loosely, a few small white jasmine blossoms with green stems, and two
thin slices of dried peach. Beside them a clear glass brewing carafe holds
bright amber-orange coffee that glows luminously where the key light passes
through the glass. This is the LIGHTEST and most translucent image of a set of
four — airy and delicate, though still deep-shadowed overall.
```

### `profile-b.png` — B "밸런스의 클래식" (#Sweet #Caramel #Balanced)

> 세트의 **중간 기준점**

```
[공통 스타일 블록]
[일관성 문장]

Still life on dark slate: evenly roasted medium-brown coffee beans, a single
translucent amber shard of hard caramel catching the light, and one plain
unbranded cream-colored ceramic cup of black coffee with a still, clean, mirror
surface. Warm cinnamon-brown overall tone. This image is the balanced midpoint
of the set — neither the brightest nor the darkest.
```

### `profile-c.png` — C "고소한 위로 한 잔" (#Nutty #Chocolaty #Sweet)

> 세트에서 **가장 부드럽고 따뜻한** 한 장

```
[공통 스타일 블록]
[일관성 문장]

Still life on dark slate: medium-dark roasted coffee beans, whole hazelnuts and
blanched almonds, two broken squares of milk chocolate with a matte fractured
edge, and a thick unbranded stoneware mug of latte. The latte surface is soft
cloudy microfoam — NO latte art, no poured pattern, no drawn shape, no heart,
no rosetta. The light is softer and more diffused than the other images in the
set: comforting and warm rather than dramatic.
```

### `profile-d.png` — D "묵직한 바디 애호가" (#Bitter #DarkChoco #Heavy)

> 세트에서 **가장 어둡고 대비가 센** 한 장

```
[공통 스타일 블록]
[일관성 문장]

Still life on dark slate: very dark, oily coffee beans with a visible wet sheen
on their surfaces, a roughly broken block of 85% dark chocolate, and a small
unbranded white demitasse holding espresso with a thick, dense, tiger-striped
crema. This is the DARKEST and highest-contrast image of the set — almost the
entire frame is black, with a single hard amber rim light tracing the edge of
the cup and the sheen of the beans. Heavy, dense, powerful.
```

---

## 4. `mid-cta-plate.png` — 중간 CTA 배너 배경

**쓰이는 곳:** 페이지 중간(취향 검사 직후)의 가로 배너. 왼쪽에 문구와 버튼이 올라가고
오른쪽에서 사진이 비쳐 보입니다. 어두운 스크림이 덮이므로 **아주 어두워도 괜찮습니다.**

**요청 크기:** 1536×1024 (가로, 가로로 길게 잘라 씁니다)

```
[공통 스타일 블록]

A warm cup of coffee on a dark wooden table beside a scattering of roasted coffee
beans and a closed notebook, seen from a low three-quarter angle. Steam rises
faintly and catches the light. Calm, inviting, end-of-a-good-morning mood.

COMPOSITION IS CRITICAL: all objects sit in the RIGHT HALF of the frame. The left
half is empty near-black space reserved for text. The image will be darkened
heavily and used behind text, so keep it simple and very low key.
```

---

## 5. `og-plate.png` — OG 공유 카드 배경

**쓰이는 곳:** `og-image.png`(1200×630, 카카오톡·트위터·슬랙 공유 썸네일) 재제작용
**배경만**. 한글 텍스트는 이미지가 아니라 HTML이 올립니다 — 아래 참고 참조.

**요청 크기:** 1536×1024 (가로, 1200×630으로 잘라 씁니다)

```
[공통 스타일 블록]

Extreme minimalism: one single coffee bean lying on dark slate, lit by one hard
amber light from the right that carves out its center crease and casts a long
soft shadow stretching to the left.

COMPOSITION IS CRITICAL: the bean sits in the RIGHT QUARTER of the frame. The
left three quarters is empty, uninterrupted near-black space — deliberately
reserved for text to be placed later. Nothing but the bean, its shadow, and
black.
```

### 참고 — og-image.png는 왜 이미지만으로 안 만드나

기존 `og-image.png`는 `og.html`을 헤드리스 크로미움으로 스크린샷해서 만든 것인데
그 `og.html`이 지금 저장소에 없습니다. 한글 제목을 AI가 그리게 하면 깨지므로
원래 방식을 되살립니다:

`og.html` 재작성(`og-plate.png`를 배경으로, 텍스트는 실제 웹폰트로 오버레이)
→ Playwright 1200×630 스크린샷 → `og-image.png` 교체.

---

## 보내주신 기획 보드에서 **만들지 않는 것**

보드에 있던 13장 중 아래 항목은 만들면 사실과 다른 주장이 되거나 코드와 어긋납니다.
그래서 위 8장에서 제외했습니다.

| 보드 항목 | 왜 빼는지 |
|---|---|
| **App Store / Google Play 배지** (01, 09) | Note My Coffee는 PWA입니다. 스토어 등록이 없어서 배지를 붙이면 없는 앱을 있다고 말하는 셈이 됩니다. 대신 "설치 없이 브라우저에서 바로"가 이미 강점으로 쓰이고 있습니다. |
| **기능 아이콘 6종 스트립** (08) | "통계로 보는 나의 취향", "리포트 & 인사이트 한눈에"는 앱에 없는 기능입니다. 실제로 있는 것만 쓰면 4개이고, 그 4개는 이미 기능 섹션에 인라인 SVG로 들어가 있습니다. |
| **취향검사 결과 카드 시안** (06) | 실제 레이더는 5각형이 아니라 **4축**(산미·단맛·바디·로스팅)입니다. 프로필 이름도 "밸런스 탐험가"가 아니라 A~D 네 개(화사한 향미 탐험가 / 밸런스의 클래식 / 고소한 위로 한 잔 / 묵직한 바디 애호가)입니다. 이 카드는 이미지가 아니라 **canvas로 실제 데이터에서 생성**하도록 만들어 뒀습니다. |
| **원두 봉투 제품 이미지** (06) | 취향검사는 센터커피·프릳츠·모모스 등 **실존 브랜드의 실제 상품**을 추천합니다. 그 봉투처럼 보이는 AI 이미지는 실제 회사를 잘못 표현하는 것이 됩니다. |
| **창업자 얼굴 사진** (02) | AI로 만든 얼굴을 "바리스타로 일하면서…"라는 1인칭 스토리 옆에 두면 없는 사람을 만들어내는 것이 됩니다. 본인 실제 사진을 쓰시는 건 물론 좋고, 그게 아니면 얼굴 없이 가는 게 맞습니다. |
| **이미지 안의 한글 문구** (02~07, 09, 11~13) | 보드 시안에도 "곤형 · 향미 · 깊은 여온"처럼 깨진 한글이 이미 보입니다. 모든 문구는 HTML/canvas가 그리므로 이미지에는 글자를 넣지 않습니다. |
| **라이프스타일 3종 / 데모 썸네일 / SNS 카드** (05, 11, 12) | 나쁘지 않지만 **지금 페이지에 들어갈 자리가 없습니다.** 쓰지도 않을 이미지를 미리 만들 필요는 없어서 제외했습니다. 나중에 섹션을 늘릴 때 요청하시면 프롬프트를 추가하겠습니다. |

보드에서 **채택한** 것: 중간 CTA 배너(07) — 실제로 히어로와 최종 CTA 사이가 비어 있어서
넣었습니다. 배경 사진이 위 `mid-cta-plate.png`입니다.

---

## 결과가 마음에 안 들 때 쓸 수 있는 조정 문구

| 증상 | 덧붙일 문구 |
|---|---|
| 너무 밝다 / 스톡 사진 같다 | `Much darker. Crush the shadows — at least 85% of the frame should be near-black. Underexpose by two stops.` |
| 색이 붕 뜬다(파랑·초록 섞임) | `Remove all cool tones completely. The only hues present are black, brown, and warm amber.` |
| 글자가 들어갔다 | `Remove all text, letters, numbers, and symbols from the image entirely.` |
| 광고 사진처럼 매끈하다 | `Less polished. Add surface imperfections, dust, uneven texture, and visible film grain.` |
| 히어로/OG의 왼쪽이 안 비었다 | `The left side of the frame must be completely empty black space. Move the entire subject to the far right edge.` |
