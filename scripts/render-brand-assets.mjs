// Note My Coffee — 브랜드 자산 생성기 (로고 C · 원두 펜촉)
//
// 원두 가운데 홈이 만년필 펜촉의 갈라진 선으로 이어지는 마크다. 커피와 기록을
// 한 모양에 담았다. 아래 파일은 전부 이 스크립트가 같은 좌표에서 만든다.
// 손으로 고치지 말고 좌표나 색을 여기서 고친 뒤 다시 실행한다.
//
//   SVG  logo.svg            크림 마크 — 어두운 배경용
//        logo-dark.svg       잉크 마크 — 밝은 배경용(현재 모든 페이지)
//        favicon.svg         클레이 타일
//   PNG  icon-192.png, icon-512.png     둥근 클레이 타일(모서리 투명) — manifest "any"
//        icon-maskable-512.png          전면 클레이, 마크를 안전 영역 안으로 줄임 — "maskable"
//        icon-monochrome-512.png        흰 실루엣 — "monochrome"(테마·알림 아이콘)
//        apple-touch-icon.png           180 전면 클레이(iOS가 모서리를 깎는다)
//        badge-96.png                   알림 상태바용 흰 실루엣(안드로이드는 알파만 쓴다)
//        store/android/play-icon-512.png  Play 스토어 등록정보 아이콘(전면 정사각형, 수동 업로드)
//
// 실행: node scripts/render-brand-assets.mjs   (Playwright + Chromium 필요)

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CLAY = '#B4532A';
const CREAM = '#FCFAF6';
const INK = '#241C15';
const WHITE = '#FFFFFF';

// ── 마크 좌표(512 격자). 외곽 상자는 x 142–370, y 100–420, 중심 (256, 260). ──
const NIB = 'M256 100 C332 100 370 168 370 232 C370 300 322 352 256 420 C190 352 142 300 142 232 C142 168 180 100 256 100 Z';
const HOLE = { cx: 256, cy: 212, r: 18 };
// 슬릿은 펜촉 끝(420)보다 조금 더 내려가야 끝이 확실히 갈라진다.
const SLIT = 'M256 230 C246 290 266 346 256 426';
const SLIT_WIDTH = 14;

// 마스커블 아이콘은 런처가 원·물방울 등으로 깎는다. 마크를 0.9배로 줄여
// 가장 먼 점(펜촉 끝)이 중심에서 148 — W3C 안전 영역(반지름 204.8)은 물론
// 안드로이드 적응형 아이콘의 66dp 원(512 기준 반지름 약 156)에도 들어간다.
const MASKABLE_SCALE = 0.9;

function scaled(scale, inner) {
    if (scale === 1) return inner;
    return `<g transform="translate(256 260) scale(${scale}) translate(-256 -260)">${inner}</g>`;
}

// 불투명한 타일 위: 구멍과 슬릿을 배경색으로 칠한다.
function tileSvg({ bg, fg, rx = 0, scale = 1, size }) {
    const dims = size ? ` width="${size}" height="${size}"` : '';
    const mark = [
        `<path d="${NIB}" fill="${fg}"/>`,
        `<circle cx="${HOLE.cx}" cy="${HOLE.cy}" r="${HOLE.r}" fill="${bg}"/>`,
        `<path d="${SLIT}" fill="none" stroke="${bg}" stroke-width="${SLIT_WIDTH}"/>`,
    ].join('\n  ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"${dims}>
  <rect width="512" height="512"${rx ? ` rx="${rx}"` : ''} fill="${bg}"/>
  ${scaled(scale, mark)}
</svg>
`;
}

// 배경 없는 마크: 구멍과 슬릿을 마스크로 뚫어 어떤 배경이든 비쳐 보이게 한다.
function bareSvg({ fg, viewBox, scale = 1, size }) {
    const dims = size ? ` width="${size}" height="${size}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${dims}>
  <defs>
    <mask id="nmc-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <rect width="512" height="512" fill="#fff"/>
      <circle cx="${HOLE.cx}" cy="${HOLE.cy}" r="${HOLE.r}" fill="#000"/>
      <path d="${SLIT}" fill="none" stroke="#000" stroke-width="${SLIT_WIDTH}"/>
    </mask>
  </defs>
  ${scaled(scale, `<path d="${NIB}" fill="${fg}" mask="url(#nmc-cut)"/>`)}
</svg>
`;
}

// 헤더 로고용 뷰박스: 외곽 상자에 사방 8씩 여백(예전 북마크 로고와 같은 비율의 여백).
const LOGO_VIEWBOX = '134 92 244 336';

const svgFiles = {
    'logo.svg': `<!-- 크림 마크 — **어두운 배경용**. 밝은 배경에는 logo-dark.svg를 쓴다. -->
<!-- Note My Coffee 로고 C(원두 펜촉). scripts/render-brand-assets.mjs가 만든다 — 직접 고치지 말 것. -->
${bareSvg({ fg: CREAM, viewBox: LOGO_VIEWBOX })}`,
    'logo-dark.svg': `<!-- 잉크 마크 — **밝은 배경용**(현재 모든 페이지가 밝다). 이름과 용도가 반대이니 주의. -->
<!-- Note My Coffee 로고 C(원두 펜촉). scripts/render-brand-assets.mjs가 만든다 — 직접 고치지 말 것. -->
${bareSvg({ fg: INK, viewBox: LOGO_VIEWBOX })}`,
    'favicon.svg': `<!-- 파비콘 — 클레이 타일 포함. scripts/render-brand-assets.mjs가 만든다 — 직접 고치지 말 것. -->
${tileSvg({ bg: CLAY, fg: CREAM, rx: 112 })}`,
};

const pngFiles = [
    // [출력 경로, 픽셀, SVG]
    ['icon-192.png', 192, tileSvg({ bg: CLAY, fg: CREAM, rx: 112, size: 192 })],
    ['icon-512.png', 512, tileSvg({ bg: CLAY, fg: CREAM, rx: 112, size: 512 })],
    ['icon-maskable-512.png', 512, tileSvg({ bg: CLAY, fg: CREAM, scale: MASKABLE_SCALE, size: 512 })],
    ['icon-monochrome-512.png', 512, bareSvg({ fg: WHITE, viewBox: '0 0 512 512', size: 512 })],
    ['apple-touch-icon.png', 180, tileSvg({ bg: CLAY, fg: CREAM, size: 180 })],
    // 상태바 아이콘은 24dp 중 20dp를 채우는 게 기준이라 마크를 크게(높이의 83%) 잡는다.
    ['badge-96.png', 96, bareSvg({ fg: WHITE, viewBox: '64 68 384 384', size: 96 })],
    // Play Console 요건: 512×512, 32비트 PNG(알파 포함). 모서리는 Play가 깎는다.
    ['store/android/play-icon-512.png', 512, tileSvg({ bg: CLAY, fg: CREAM, size: 512 })],
];

for (const [name, body] of Object.entries(svgFiles)) {
    writeFileSync(join(ROOT, name), body);
    console.log('wrote', name);
}

const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    for (const [name, px, svg] of pngFiles) {
        // SVG를 캔버스에 그려 PNG로 뽑는다. 캔버스 인코더는 항상 RGBA(32비트)로
        // 저장하므로 Play Console의 "32비트 PNG" 요건도 그대로 맞는다.
        const base64 = await page.evaluate(async ({ svg, px }) => {
            const img = new Image(px, px);
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            await img.decode();
            const canvas = document.createElement('canvas');
            canvas.width = px;
            canvas.height = px;
            canvas.getContext('2d').drawImage(img, 0, 0, px, px);
            return canvas.toDataURL('image/png').split(',')[1];
        }, { svg, px });
        writeFileSync(join(ROOT, name), Buffer.from(base64, 'base64'));
        console.log('wrote', name);
    }
} finally {
    await browser.close();
}
