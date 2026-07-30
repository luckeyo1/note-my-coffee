// Note My Coffee — 취향 검사 결과 공유 카드
//
// 검사를 끝낸 직후가 페이지에서 몰입도 최고점인데 결과를 밖으로 내보낼 방법이 없었다.
// 1080×1080 PNG를 캔버스로 그려 Web Share API(모바일) 또는 다운로드(데스크톱)로 넘긴다.
// 카카오/인스타 SDK를 쓰지 않으므로 외부 키와 도메인 등록이 필요 없다.
//
// 랜딩 인라인 스크립트에서 첫 클릭 시 동적 import로 불러온다 — 검사를 안 하거나
// 공유를 누르지 않은 방문자는 이 파일과 프로필 아트를 아예 받지 않는다.

const SIZE = 1080;

// 랜딩 :root 토큰과 같은 값. 여기서 CSS 변수를 읽지 않는 이유는 캔버스가
// 문서 스타일과 무관하게 항상 같은 결과를 내야 하기 때문이다(다운로드 산출물).
const C = {
    bg: '#080604',
    gold: '#C8A96E',
    goldLine: 'rgba(200,169,110,0.25)',
    goldGrid: 'rgba(200,169,110,0.16)',
    goldFill: 'rgba(200,169,110,0.18)',
    text: '#EBE5DC',
    sub: '#9B9087',
    muted: '#8A8179',
};

// 화면 레이더(index.html의 flavorRadar)와 축 순서가 반드시 같아야 한다.
const FLAVOR_AXES = ['산미', '단맛', '바디', '로스팅'];

/**
 * 프로필 아트를 불러온다. 파일이 아직 없거나 확장자가 다르면 null을 돌려주고,
 * 호출부는 아트 없이 카드를 그린다 — 이미지가 준비되기 전에도 공유가 동작한다.
 * @param {string} base 확장자 없는 경로 (예: 'img/profile-a')
 * @returns {Promise<HTMLImageElement|null>}
 */
const artCache = new Map();

async function loadArt(base) {
    if (artCache.has(base)) return artCache.get(base);
    const img = await probeArt(base);
    artCache.set(base, img); // 아트가 없다는 사실도 캐시한다 — 매번 404를 세 번 때리지 않게
    return img;
}

async function probeArt(base) {
    for (const ext of ['.webp', '.png', '.jpg']) {
        const img = await new Promise((resolve) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => resolve(null);
            el.src = base + ext;
        });
        if (img) return img;
    }
    return null;
}

/**
 * 웹폰트가 실제로 로드된 뒤에 그려야 한다 — 아니면 조용히 폴백 서체로 그려진다.
 *
 * 중요: document.fonts.load()에 **그릴 문자열을 반드시 함께 넘겨야 한다.**
 * 구글 폰트는 한글을 unicode-range 서브셋 수십 개로 쪼개 서빙하는데, 텍스트
 * 인자가 없으면 라틴 서브셋만 받아온다. 그래서 페이지 어디에도 없는 글자
 * (예: "밸런스의 클래식"의 '밸')가 두부(□)로 찍혔다. 텍스트를 넘기면 그 글자를
 * 담은 서브셋까지 받아온다.
 *
 * @param {string[]} texts 이 카드에 실제로 그릴 문자열들
 */
async function waitForFonts(texts) {
    if (!document.fonts) return;
    const all = texts.join(' ');
    const jobs = [
        ["700 64px 'Gowun Batang'", all],
        ["400 22px 'DM Mono'", all],
        ["500 26px 'DM Sans'", all],
        ["400 20px 'Noto Sans KR'", all],
    ];
    try {
        await Promise.all(jobs.map(([f, t]) => document.fonts.load(f, t)));
        await document.fonts.ready;
    } catch (e) {
        // 폰트를 못 받아도 카드는 폴백 서체로 나가는 게 낫다.
        console.warn('[ShareCard] 웹폰트 로드 실패, 폴백 서체로 그립니다.', e);
    }
}

/** 이미지를 지정 영역에 cover 방식(비율 유지 + 꽉 채움)으로 그린다. */
function drawCover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
}

/** letter-spacing이 캔버스에 없어서 글자를 하나씩 옮겨 그린다. 중앙 정렬 기준. */
function drawTracked(ctx, text, cx, y, tracking) {
    const chars = [...text];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    let x = cx - total / 2;
    ctx.textAlign = 'left';
    chars.forEach((ch, i) => {
        ctx.fillText(ch, x, y);
        x += widths[i] + tracking;
    });
    ctx.textAlign = 'center';
}

/**
 * 태그 칩들을 한 줄로 중앙 정렬해 그린다.
 * @returns {number} 그린 줄의 높이
 */
function drawTags(ctx, tags, cx, y) {
    const padX = 20;
    const h = 44;
    const gap = 10;
    ctx.font = "400 22px 'DM Mono', monospace";
    const widths = tags.map((t) => ctx.measureText(t).width + padX * 2);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (tags.length - 1);

    let x = cx - total / 2;
    tags.forEach((t, i) => {
        const w = widths[i];
        ctx.beginPath();
        // roundRect가 없는 구형 사파리에서는 각진 칩으로 떨어진다 — 공유가 막히는 것보다 낫다.
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2);
        else ctx.rect(x, y, w, h);
        ctx.strokeStyle = C.goldLine;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = C.gold;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t, x + w / 2, y + h / 2 + 1);
        x += w + gap;
    });
    ctx.textBaseline = 'alphabetic';
    return h;
}

/**
 * 플레이버 레이더. 화면 SVG(flavorRadar)와 같은 좌표 수식을 쓴다:
 * 200 뷰박스 안에서 중심 100, 반지름 58, 각도 -PI/2 + i*PI/2.
 */
function drawRadar(ctx, values, cx, cy, size) {
    const k = size / 200;
    const R = 58 * k;
    const pt = (i, s) => {
        const a = -Math.PI / 2 + i * Math.PI / 2;
        return [cx + Math.cos(a) * R * s, cy + Math.sin(a) * R * s];
    };
    const poly = (pts) => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
    };

    // 격자
    ctx.strokeStyle = C.goldGrid;
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach((s) => {
        poly([0, 1, 2, 3].map((i) => pt(i, s)));
        ctx.stroke();
    });
    // 축
    [0, 1, 2, 3].forEach((i) => {
        const [x, y] = pt(i, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();
    });

    // 값 도형
    poly(values.map((s, i) => pt(i, s)));
    ctx.fillStyle = C.goldFill;
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 3.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 꼭지점
    ctx.fillStyle = C.gold;
    values.forEach((s, i) => {
        const [x, y] = pt(i, s);
        ctx.beginPath();
        ctx.arc(x, y, 5.4, 0, Math.PI * 2);
        ctx.fill();
    });

    // 축 이름
    ctx.fillStyle = C.muted;
    ctx.font = "400 20px 'DM Mono', 'Noto Sans KR', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    FLAVOR_AXES.forEach((t, i) => {
        const [x, y] = pt(i, 1.4);
        ctx.fillText(t, x, y);
    });
    ctx.textBaseline = 'alphabetic';
}

/** 폭에 맞춰 글자 단위로 줄바꿈한다(한글은 단어 경계가 공백과 무관하다). */
function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const ch of text) {
        if (ctx.measureText(line + ch).width > maxWidth && line) {
            lines.push(line);
            line = ch;
        } else {
            line += ch;
        }
    }
    if (line) lines.push(line);
    return lines;
}

/**
 * 취향 검사 결과 공유 카드를 그려 PNG Blob으로 돌려준다.
 * @param {Object} o
 * @param {string} o.profile 프로필 키 (A~D)
 * @param {string} o.title 프로필 이름
 * @param {string[]} o.tags 해시태그 배열
 * @param {number[]} o.flavor 축 4개의 0~1 값 (산미·단맛·바디·로스팅)
 * @returns {Promise<Blob>}
 */
export async function buildQuizShareCard({ profile, title, tags, flavor }) {
    await waitForFonts([
        title, ...tags, ...FLAVOR_AXES,
        'YOUR COFFEE PROFILE', 'Note My Coffee', 'note-my-coffee.web.app',
    ]);
    const art = await loadArt('img/profile-' + String(profile).toLowerCase());

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const cx = SIZE / 2;
    // 아트가 없으면 띠를 아예 두지 않는다 — 빈 검은 여백을 남기는 대신 본문을
    // 위로 올려 이미지 전에도 완성된 카드로 보이게 한다.
    const ART_H = art ? 390 : 0;

    if (art) {
        drawCover(ctx, art, 0, 0, SIZE, ART_H);
        // 아트 하단을 배경색으로 녹여 텍스트 영역과 이어붙인다.
        const fade = ctx.createLinearGradient(0, ART_H - 220, 0, ART_H);
        fade.addColorStop(0, 'rgba(8,6,4,0)');
        fade.addColorStop(1, C.bg);
        ctx.fillStyle = fade;
        ctx.fillRect(0, ART_H - 220, SIZE, 220);
    } else {
        const glow = ctx.createRadialGradient(cx, 210, 0, cx, 210, 620);
        glow.addColorStop(0, 'rgba(200,169,110,0.13)');
        glow.addColorStop(1, 'rgba(200,169,110,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, SIZE, SIZE * 0.62);
    }

    let y = art ? ART_H + 74 : 250;

    // 아이브로
    ctx.fillStyle = C.gold;
    ctx.font = "400 22px 'DM Mono', monospace";
    drawTracked(ctx, 'YOUR COFFEE PROFILE', cx, y, 3.4);
    y += 66;

    // 프로필 이름 — 길면 두 줄로 흘린다.
    ctx.fillStyle = C.text;
    // Gowun Batang에 없는 글자가 나와도 두부가 아니라 실제 한글이 찍히도록
    // 전역 커버리지가 있는 Noto Sans KR을 폴백에 둔다(Cormorant는 라틴 전용이라 무의미).
    ctx.font = "700 64px 'Gowun Batang', 'Noto Sans KR', Georgia, serif";
    ctx.textAlign = 'center';
    wrapText(ctx, title, SIZE - 200).forEach((line) => {
        ctx.fillText(line, cx, y);
        y += 78;
    });
    y += 6;

    // 태그
    y += drawTags(ctx, tags, cx, y) + 44;

    // 레이더는 태그와 푸터 사이 남은 공간의 정중앙에 놓고, 그 공간에 맞춰 크기를 정한다.
    // 축 이름이 1.4R(= 0.406 * size) 밖에 앉으므로 전체 높이는 약 0.81 * size다.
    // 아트가 없으면 공간이 넓어 레이더가 커지고, 제목이 두 줄로 늘어나면 작아진다 —
    // 어느 경우에도 푸터 워드마크를 침범하지 않는다.
    const FOOTER_TOP = SIZE - 150;
    const space = FOOTER_TOP - y;
    const radarSize = Math.max(170, Math.min(330, space / 0.95));
    drawRadar(ctx, flavor, cx, y + space / 2, radarSize);

    // 푸터 워드마크
    ctx.fillStyle = C.gold;
    ctx.font = "500 26px 'DM Sans', 'Noto Sans KR', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('Note My Coffee', cx, SIZE - 92);
    ctx.fillStyle = C.muted;
    ctx.font = "400 21px 'DM Mono', monospace";
    ctx.fillText('note-my-coffee.web.app', cx, SIZE - 56);

    // 골드 헤어라인 프레임
    ctx.strokeStyle = C.goldLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, SIZE - 56, SIZE - 56);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('카드 이미지를 만들지 못했습니다.'))),
            'image/png'
        );
    });
}

/**
 * 카드를 공유하거나 내려받는다.
 * @returns {Promise<'share'|'download'>} 실제로 사용된 경로
 */
export async function shareQuizCard(result) {
    const blob = await buildQuizShareCard(result);
    const file = new File([blob], 'my-coffee-profile.png', { type: 'image/png' });

    // Web Share API Level 2(파일 공유)는 주로 모바일에서만 된다.
    // canShare로 먼저 물어보고, 안 되면 다운로드로 내린다.
    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: 'Note My Coffee — 내 커피 취향',
                text: `제 커피 취향은 "${result.title}"이래요. 30초 취향 검사로 원두 추천까지 받아보세요.`,
            });
            return 'share';
        } catch (e) {
            // 사용자가 공유 시트를 닫은 건 오류가 아니다 — 다운로드로 떨어지지 않고 끝낸다.
            if (e && e.name === 'AbortError') return 'share';
            console.warn('[ShareCard] 공유 실패, 다운로드로 대체합니다.', e);
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-coffee-profile.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // revoke를 즉시 하면 일부 브라우저에서 저장이 취소된다.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'download';
}
