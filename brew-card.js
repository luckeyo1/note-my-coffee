// Note My Coffee — 브루 카드 (추출 기록 공유 카드)
//
// 로그북 카드에 갇혀 있던 캔버스 렌더링을 재사용 가능한 모듈로 꺼냈다. 이제
// 저장 직후(몰입도 최고점, main.js)와 로그북(logbook.js) 두 곳에서 같은 카드를
// 그린다. Untappd/Strava가 그랬듯, 기록을 "전달"이 아니라 "체크인 자랑"으로
// 내보내는 게 목적이다 — 그래서 개인 기록(PR) 뱃지를 함께 얹는다.
//
// 외부 SDK(카카오·인스타)를 쓰지 않으므로 도메인 등록·키가 필요 없다.
// Web Share API(모바일) → 다운로드/링크복사(데스크톱) 순으로 떨어진다.

// ── 포맷 헬퍼 (logbook.js와 동일 규칙, 자립성을 위해 여기에도 둔다) ──────────
// 추출 시간 표기: 에스프레소는 "28.5s", 드립은 "3:00".
export function fmtBrewTime(recipe) {
    const t = Number(recipe.time) || 0;
    if ((recipe.mode || 'espresso') === 'espresso') return `${Math.round(t * 10) / 10}s`;
    const total = Math.round(t);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function modeLabel(m) {
    return m === 'drip' ? 'HAND DRIP' : String(m || 'espresso').toUpperCase();
}

// ── 개인 기록(PR) 뱃지 ───────────────────────────────────────────────────────
/**
 * 이 한 잔이 "자랑할 만한" 이유를 최대 2개 뽑는다. Strava의 PR 알림과 같은 동기다.
 * 근거가 확실한 것만(과장 없이) 고른다 — 평점 자랑은 4점 이상일 때만 한다.
 *
 * @param {Object} recipe  방금 저장한(또는 공유하려는) 레시피
 * @param {Object[]} all   내 전체 기록(방금 저장한 것 포함). 신뢰 못 하면 빈 배열.
 * @param {'ko'|'en'} lang
 * @returns {string[]} 뱃지 문자열 배열 (0~2개)
 */
export function computeHighlights(recipe, all, lang = 'ko') {
    const t = (ko, en) => (lang === 'en' ? en : ko);
    const list = Array.isArray(all) ? all.filter(Boolean) : [];

    // 전체 목록에서 "이 레시피 자신"을 딱 하나만 뺀 나머지(others)를 만든다.
    // 저장 직후(main.js)의 getRecipes()는 방금 저장한 것과 값은 같지만 참조가 다른
    // 객체를 돌려주므로, 참조로 못 찾으면 핵심 필드 서명으로 한 건만 제거한다.
    // 이렇게 하면 목록이 자신을 포함하든(로그북) 아니든(클라우드 반영 지연) 항상
    // others = 이전 기록, total = others + 1 로 일관되게 계산된다.
    const others = list.slice();
    let idx = others.indexOf(recipe);
    if (idx === -1) {
        const sig = (r) => [r.date, r.beanName, r.dosing, r.temp, r.time, r.yield,
            r.overallRating, r.success].join('|');
        const s = sig(recipe);
        idx = others.findIndex((r) => sig(r) === s);
    }
    if (idx !== -1) others.splice(idx, 1);

    const total = others.length + 1; // 자신은 항상 한 번만 센다
    const rating = Math.max(0, Math.min(5, parseInt(recipe.overallRating, 10) || 0));
    const bean = (recipe.beanName || '').trim();
    const out = [];

    // 첫 기록 — 가장 강력한 순간이라 이것만 나오면 충분하다.
    if (total === 1) return [t('첫 기록 ☕', 'First brew ☕')];

    // 같은 원두 안에서의 성취 (원두명이 있을 때만)
    if (bean) {
        const earlier = others.filter((r) => (r.beanName || '').trim() === bean);
        if (recipe.success && earlier.length && !earlier.some((r) => r.success)) {
            out.push(t('이 원두 첫 성공', 'First success on this bean'));
        }
        if (earlier.length >= 1 && rating >= 4) {
            const maxOther = earlier.reduce(
                (m, r) => Math.max(m, parseInt(r.overallRating, 10) || 0), 0);
            if (rating > maxOther) out.push(t('이 원두 최고 기록', 'New best on this bean'));
        }
    }

    // 역대 최고 평점 (4점 이상 + 단독 최고일 때만)
    if (out.length < 2 && rating >= 4 && total >= 3) {
        const maxOther = others.reduce(
            (m, r) => Math.max(m, parseInt(r.overallRating, 10) || 0), 0);
        if (rating > maxOther) out.push(t('★ 역대 최고 평점', '★ Your best cup yet'));
    }

    // 마일스톤 — 아무 뱃지도 못 뽑았을 때만, 딱 떨어지는 회차에서.
    if (out.length === 0 && total >= 10 && (total % 10 === 0 || total % 25 === 0)) {
        out.push(t(`${total}번째 기록 🎉`, `Brew #${total} 🎉`));
    }

    return out.slice(0, 2);
}

// ── 캔버스 헬퍼 ──────────────────────────────────────────────────────────────
function _line(ctx, x1, x2, y, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
}
function _rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
function _trunc(s, max) { s = String(s ?? ''); return s.length > max ? s.slice(0, max) + '…' : s; }

function _loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// 이미지를 박스에 cover-fit (꽉 채우고 넘치는 부분은 가운데 기준으로 잘라낸다).
function _drawCover(ctx, img, W, H) {
    const ir = img.width / img.height, cr = W / H;
    let dw, dh, dx, dy;
    if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
    else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
}

// 골드 알약형 뱃지(자랑 뱃지)를 그린다. 중심 x 기준.
function _drawPill(ctx, text, cx, y, { font, padX = 22, h = 44 }) {
    ctx.font = font;
    const w = ctx.measureText(text).width + padX * 2;
    ctx.fillStyle = 'rgba(200,169,110,0.16)';
    _rrect(ctx, cx - w / 2, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,169,110,0.55)';
    ctx.lineWidth = 1.6;
    _rrect(ctx, cx - w / 2, y, w, h, h / 2); ctx.stroke();
    ctx.fillStyle = '#C8A96E';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, y + h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    return w;
}

// ── 카드 렌더러 ──────────────────────────────────────────────────────────────
// compact 카드 (600×380) — 텍스트 위주, SNS 프리뷰/링크 카드용.
function drawShareCard(recipe, highlights) {
    const W = 600, H = 380, S = 2;
    const c = document.createElement('canvas');
    c.width = W * S; c.height = H * S;
    const ctx = c.getContext('2d');
    ctx.scale(S, S);

    const GOLD = '#C8A96E', DARK = '#1A1614', SURF = '#0F0D0C';
    const TEXT = '#EBE5DC', SUB = '#9B9087', MUTED = '#5A544E';
    const BDR = 'rgba(255,255,255,0.08)';

    ctx.fillStyle = DARK; ctx.fillRect(0, 0, W, H);

    // 헤더 띠
    ctx.fillStyle = SURF; ctx.fillRect(0, 0, W, 48);
    ctx.fillStyle = GOLD;
    ctx.font = "13px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    ctx.fillText('☕  NOTE MY COFFEE', 22, 30);

    const mode = modeLabel(recipe.mode);
    ctx.font = "bold 9px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    const modeW = ctx.measureText(mode).width + 20;
    ctx.fillStyle = 'rgba(200,169,110,0.14)';
    _rrect(ctx, W - 22 - modeW, 14, modeW, 20, 3); ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.fillText(mode, W - 22 - modeW + 10, 28);

    // 자랑 뱃지(있으면) — 원두명 위에 골드 아이브로로.
    let topY = 92;
    const hl = (highlights && highlights[0]) || '';
    if (hl) {
        ctx.fillStyle = GOLD;
        ctx.font = "bold 11px 'IBM Plex Mono', 'Pretendard Variable', monospace";
        ctx.fillText(hl.toUpperCase(), 22, 78);
        topY = 108;
    }

    // 원두명
    ctx.fillStyle = TEXT;
    ctx.font = "bold 26px Georgia, 'Pretendard Variable', serif";
    ctx.fillText(_trunc(recipe.beanName || 'Unknown Bean', 34), 22, topY);

    const sub = [mode, recipe.origin].filter(Boolean).join(' · ');
    ctx.fillStyle = SUB;
    ctx.font = "12px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    ctx.fillText(sub, 22, topY + 20);

    _line(ctx, 22, W - 22, 128, BDR);

    const params = [
        { k: 'DOSING', v: `${Number(recipe.dosing) || 0}g` },
        { k: 'TEMP', v: `${Number(recipe.temp) || 0}°C` },
        { k: 'TIME', v: fmtBrewTime(recipe) },
        { k: 'YIELD', v: `${Number(recipe.yield) || 0}g` },
    ];
    const colW = (W - 44) / 4;
    params.forEach(({ k, v }, i) => {
        const x = 22 + i * colW;
        ctx.fillStyle = GOLD;
        ctx.font = "bold 20px 'IBM Plex Mono', 'Pretendard Variable', monospace";
        ctx.fillText(v, x, 170);
        ctx.fillStyle = MUTED;
        ctx.font = "9px 'IBM Plex Mono', 'Pretendard Variable', monospace";
        ctx.fillText(k, x, 186);
    });

    _line(ctx, 22, W - 22, 202, BDR);

    if (recipe.tasteNotes) {
        ctx.fillStyle = SUB;
        ctx.font = "13px 'Pretendard Variable', sans-serif";
        ctx.fillText('✦  ' + _trunc(recipe.tasteNotes, 56), 22, 228);
    }

    const rat = parseInt(recipe.overallRating) || 0;
    ctx.fillStyle = GOLD;
    ctx.font = '18px serif';
    ctx.fillText('★'.repeat(rat) + '☆'.repeat(5 - rat), 22, 260);

    const ok = !!recipe.success;
    ctx.fillStyle = ok ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)';
    _rrect(ctx, 22, 272, ok ? 90 : 64, 22, 3); ctx.fill();
    ctx.fillStyle = ok ? '#4ADE80' : '#F87171';
    ctx.font = "bold 10px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    ctx.fillText(ok ? '✓  SUCCESS' : '✗  FAIL', 32, 287);

    _line(ctx, 22, W - 22, 314, BDR);

    ctx.fillStyle = MUTED;
    ctx.font = "11px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    ctx.fillText('note-my-coffee.web.app', 22, 344);
    const ds = new Date().toLocaleDateString('ko-KR');
    ctx.fillText(ds, W - 22 - ctx.measureText(ds).width, 344);

    return c;
}

// 인스타 스토리 친화 4:5 카드 (1080×1350) — 사진을 배경으로, 텍스트를 위에 얹는다.
async function drawStoryCard(recipe, highlights) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    const GOLD = '#C8A96E', TEXT = '#F5F0E8', SUB = '#D8CFC4', MUTED = '#A89E92';

    // 배경: 사진 → 브랜드 플레이트 → 그라데이션 순으로 떨어진다.
    let hasPhoto = false;
    if (recipe.imageUrl) {
        try { _drawCover(ctx, await _loadImage(recipe.imageUrl), W, H); hasPhoto = true; }
        catch (e) { /* fall through */ }
    }
    if (!hasPhoto) {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#2A2320'); g.addColorStop(1, '#0F0D0C');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        try { _drawCover(ctx, await _loadImage('img/hero-plate.webp'), W, H); }
        catch (e) { /* 그라데이션만으로 충분하다 */ }
    }

    // 가독성 스크림 (상단 + 진한 하단)
    const topG = ctx.createLinearGradient(0, 0, 0, 320);
    topG.addColorStop(0, 'rgba(0,0,0,0.55)'); topG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topG; ctx.fillRect(0, 0, W, 320);

    const botG = ctx.createLinearGradient(0, H - 760, 0, H);
    botG.addColorStop(0, 'rgba(0,0,0,0)');
    botG.addColorStop(0.45, 'rgba(0,0,0,0.55)');
    botG.addColorStop(1, 'rgba(10,8,7,0.94)');
    ctx.fillStyle = botG; ctx.fillRect(0, H - 760, W, 760);

    const shadowOn = () => { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2; };
    const shadowOff = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };

    // 브랜드 (좌상단)
    shadowOn();
    ctx.fillStyle = GOLD;
    ctx.font = "500 30px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    ctx.fillText('☕  NOTE MY COFFEE', 64, 84);

    // 모드 뱃지 (우상단)
    const mode = modeLabel(recipe.mode);
    ctx.font = "bold 22px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    const modeW = ctx.measureText(mode).width + 44;
    shadowOff();
    ctx.fillStyle = 'rgba(200,169,110,0.18)';
    _rrect(ctx, W - 64 - modeW, 56, modeW, 44, 8); ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.fillText(mode, W - 64 - modeW + 22, 86);

    // 자랑 뱃지(있으면) — 원두명 블록 위에 골드 알약으로. 최대 2개를 가로로.
    const hls = (highlights || []).slice(0, 2);
    if (hls.length) {
        shadowOff();
        const font = "bold 24px 'Pretendard Variable', sans-serif";
        ctx.font = font;
        const gap = 16;
        const widths = hls.map((h) => ctx.measureText(h).width + 44);
        // _drawPill는 중심 x 기준이라, 왼쪽 정렬로 놓으려고 누적 시작점을 옮겨가며 그린다.
        let cursor = 64;
        hls.forEach((h, i) => {
            _drawPill(ctx, h, cursor + widths[i] / 2, 784, { font, padX: 22, h: 46 });
            cursor += widths[i] + gap;
        });
    }

    // 원두명 + 원산지 (하단 블록)
    shadowOn();
    ctx.fillStyle = TEXT;
    ctx.font = "bold 72px Georgia, 'Pretendard Variable', serif";
    ctx.fillText(_trunc(recipe.beanName || 'Unknown Bean', 22), 64, 870);

    const sub = [mode, recipe.origin].filter(Boolean).join('  ·  ');
    ctx.fillStyle = SUB;
    ctx.font = "30px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    ctx.fillText(_trunc(sub, 42), 64, 916);
    shadowOff();

    _line(ctx, 64, W - 64, 958, 'rgba(255,255,255,0.16)');

    const params = [
        { k: 'DOSING', v: `${Number(recipe.dosing) || 0}g` },
        { k: 'TEMP', v: `${Number(recipe.temp) || 0}°C` },
        { k: 'TIME', v: fmtBrewTime(recipe) },
        { k: 'YIELD', v: `${Number(recipe.yield) || 0}g` },
    ];
    const colW = (W - 128) / 4;
    shadowOn();
    params.forEach(({ k, v }, i) => {
        const x = 64 + i * colW;
        ctx.fillStyle = GOLD;
        ctx.font = "bold 52px 'IBM Plex Mono', 'Pretendard Variable', monospace";
        ctx.fillText(v, x, 1052);
        ctx.fillStyle = MUTED;
        ctx.font = "22px 'IBM Plex Mono', 'Pretendard Variable', monospace";
        ctx.fillText(k, x, 1088);
    });
    shadowOff();

    _line(ctx, 64, W - 64, 1128, 'rgba(255,255,255,0.16)');

    if (recipe.tasteNotes) {
        shadowOn();
        ctx.fillStyle = SUB;
        ctx.font = "32px 'Pretendard Variable', sans-serif";
        ctx.fillText('✦  ' + _trunc(recipe.tasteNotes, 40), 64, 1190);
        shadowOff();
    }

    const rat = parseInt(recipe.overallRating) || 0;
    shadowOn();
    ctx.fillStyle = GOLD;
    ctx.font = '44px serif';
    ctx.fillText('★'.repeat(rat) + '☆'.repeat(5 - rat), 64, 1262);
    shadowOff();

    const ok = !!recipe.success;
    const bText = ok ? '✓  SUCCESS' : '✗  FAIL';
    ctx.font = "bold 24px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    const bW = ctx.measureText(bText).width + 40;
    ctx.fillStyle = ok ? 'rgba(74,222,128,0.16)' : 'rgba(248,113,113,0.16)';
    _rrect(ctx, W - 64 - bW, 1232, bW, 44, 8); ctx.fill();
    ctx.fillStyle = ok ? '#4ADE80' : '#F87171';
    ctx.fillText(bText, W - 64 - bW + 20, 1262);

    ctx.fillStyle = MUTED;
    ctx.font = "24px 'IBM Plex Mono', 'Pretendard Variable', monospace";
    ctx.fillText('note-my-coffee.web.app', 64, 1318);
    const ds = new Date().toLocaleDateString('ko-KR');
    ctx.fillText(ds, W - 64 - ctx.measureText(ds).width, 1318);

    return c;
}

// 캔버스는 웹폰트가 로드되기 전에 그리면 조용히 폴백 서체로 그린다. 게다가
// 웹폰트는 한글을 unicode-range 서브셋으로 쪼개 서빙하므로, load()에 그릴
// 텍스트를 함께 넘겨야 그 글자를 담은 서브셋까지 받아온다 — 원두명·자랑 뱃지처럼
// 페이지 어디에도 없던 글자가 두부(□)로 찍히는 걸 막는다.
async function waitForCardFonts(recipe, highlights) {
    if (!document.fonts) return;
    const text = [recipe.beanName, recipe.origin, recipe.tasteNotes, recipe.weather,
        ...(highlights || []), '성공', '실패', '첫 기록', '역대 최고 평점',
        '이 원두 최고 기록', '이 원두 첫 성공', '번째 기록'].filter(Boolean).join(' ');
    const faces = [
        "bold 72px 'Pretendard Variable'", "bold 26px 'Pretendard Variable'",
        "bold 24px 'Pretendard Variable'", "500 30px 'IBM Plex Mono'",
        "24px 'IBM Plex Mono'", "32px 'Pretendard Variable'",
    ];
    try {
        await Promise.all(faces.map((f) => document.fonts.load(f, text)));
        await document.fonts.ready;
    } catch (e) {
        console.warn('[BrewCard] 웹폰트 로드 실패, 폴백 서체로 그립니다.', e);
    }
}

/**
 * 주어진 스타일로 브루 카드 캔버스를 그린다.
 * @param {Object} recipe
 * @param {'card'|'story'} style
 * @param {string[]} highlights 자랑 뱃지
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderBrewCanvas(recipe, style, highlights) {
    await waitForCardFonts(recipe, highlights);
    return style === 'story'
        ? drawStoryCard(recipe, highlights)
        : drawShareCard(recipe, highlights);
}

// ── 공유 모달 ────────────────────────────────────────────────────────────────
function _removeModal(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// XSS: 자랑 뱃지·안내 문구를 innerHTML에 넣기 전 이스케이프.
const _esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * 브루 카드 공유 모달을 연다. 저장 직후(celebrate)와 로그북 양쪽에서 쓴다.
 *
 * @param {Object} recipe
 * @param {Object} [opts]
 * @param {string} [opts.shareUrl]        링크 복사용 URL (레시피 전달 링크)
 * @param {Object[]} [opts.allRecipes]    개인 기록(PR) 계산용 전체 기록
 * @param {'ko'|'en'} [opts.lang]
 * @param {boolean} [opts.celebrate]      저장 직후 축하 모드 — 헤더/버튼이 바뀐다
 * @param {string} [opts.notice]          모달 상단 안내 한 줄(예: 게스트 로그인 유도)
 * @param {Function} [opts.onContinue]    "로그북으로 →" 클릭 시 실행(축하 모드)
 * @param {Function} [opts.onEvent]       (name, params) 계측 콜백
 */
export function openBrewShareModal(recipe, opts = {}) {
    const {
        shareUrl = '', allRecipes = [], lang = 'ko',
        celebrate = false, notice = '', onContinue, onEvent,
    } = opts;
    const emit = (name, params) => { try { onEvent?.(name, params); } catch (e) { /* 계측이 본 기능을 막지 않는다 */ } };
    const T = lang === 'en' ? {
        celebrateTitle: '☕ Brew logged — show it off',
        shareTitle: '☕ Show off this cup',
        tabCard: '🗂️ Card', tabStory: '🖼️ Photo',
        making: 'Generating…', cantMake: "Couldn't create the image",
        download: '↓ Save image', share: '↗ Share', copy: '🔗 Copy link', copied: '✓ Copied',
        toLogbook: 'To logbook →',
        brag: (n) => `Here's the ${n || 'coffee'} I just brewed ☕ #NoteMyCoffee`,
    } : {
        celebrateTitle: '☕ 기록 완료 — 자랑해보세요',
        shareTitle: '☕ 이 한 잔 자랑하기',
        tabCard: '🗂️ 카드', tabStory: '🖼️ 사진 배경',
        making: '생성 중…', cantMake: '이미지를 만들 수 없습니다',
        download: '↓ 이미지 저장', share: '↗ 공유', copy: '🔗 링크 복사', copied: '✓ 복사됨',
        toLogbook: '로그북으로 →',
        brag: (n) => `제가 방금 내린 "${n || '커피'}" 한 잔이에요 ☕ #NoteMyCoffee`,
    };

    _removeModal('brew-share-modal');
    const highlights = computeHighlights(recipe, allRecipes, lang);
    const overlay = document.createElement('div');
    overlay.id = 'brew-share-modal';
    overlay.className = 'recipe-share-overlay';

    // 사진이 있으면 사진 배경 스타일을 기본으로 — 자랑 카드는 이쪽이 강하다.
    const defaultStyle = recipe.imageUrl ? 'story' : 'card';
    const chips = highlights.map((h) => `<span class="brew-chip">${_esc(h)}</span>`).join('');

    overlay.innerHTML = `
        <div class="recipe-share-box">
            <div class="recipe-share-header">
                <span>${celebrate ? T.celebrateTitle : T.shareTitle}</span>
                <button class="recipe-share-close" data-close>✕</button>
            </div>
            ${notice ? `<p class="brew-notice">${_esc(notice)}</p>` : ''}
            ${chips ? `<div class="brew-highlights">${chips}</div>` : ''}
            <div class="recipe-share-tabs">
                <button class="recipe-share-tab${defaultStyle === 'card' ? ' is-active' : ''}" data-style="card">${T.tabCard}</button>
                <button class="recipe-share-tab${defaultStyle === 'story' ? ' is-active' : ''}" data-style="story">${T.tabStory}</button>
            </div>
            <div class="recipe-share-preview" data-style="${defaultStyle}">
                <img class="recipe-share-img" alt="Brew Card">
                <div class="recipe-share-spinner">${T.making}</div>
            </div>
            <div class="recipe-share-actions">
                <button class="recipe-share-btn" data-action="download">${T.download}</button>
                ${navigator.share ? `<button class="recipe-share-btn" data-action="share">${T.share}</button>` : ''}
                ${shareUrl ? `<button class="recipe-share-btn" data-action="copy">${T.copy}</button>` : ''}
            </div>
            ${celebrate ? `<button class="recipe-share-btn recipe-share-btn--gold recipe-share-continue" data-action="continue">${T.toLogbook}</button>` : ''}
        </div>
    `;
    document.body.appendChild(overlay);

    const imgEl = overlay.querySelector('.recipe-share-img');
    const preview = overlay.querySelector('.recipe-share-preview');
    const spinner = overlay.querySelector('.recipe-share-spinner');
    let currentStyle = defaultStyle;
    let currentCanvas = null;

    const finish = () => {
        _removeModal('brew-share-modal');
        if (celebrate && onContinue) onContinue();
    };

    async function render(style) {
        currentStyle = style;
        preview.dataset.style = style;
        spinner.style.display = 'flex';
        imgEl.style.opacity = '0.25';
        try {
            currentCanvas = await renderBrewCanvas(recipe, style, highlights);
            imgEl.src = currentCanvas.toDataURL('image/png');
            imgEl.style.opacity = '1';
            spinner.style.display = 'none';
            emit('brew_card_generate', { style, celebrate });
        } catch (err) {
            console.error('[BrewCard] 렌더 실패:', err);
            spinner.textContent = T.cantMake;
        }
    }
    render(defaultStyle);

    overlay.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-style], [data-action], [data-close]') || e.target;

        // 오버레이 배경 클릭 또는 ✕ → 닫기(축하 모드면 로그북으로 이어간다).
        if (target === overlay || target.dataset.close !== undefined) { finish(); return; }

        if (target.dataset.style) {
            if (target.dataset.style === currentStyle) return;
            overlay.querySelectorAll('.recipe-share-tab')
                .forEach((b) => b.classList.toggle('is-active', b === target));
            await render(target.dataset.style);
            return;
        }

        const action = target.dataset.action;
        if (action === 'continue') { finish(); return; }
        if (!action || !currentCanvas) return;

        if (action === 'download') {
            // data: URL이 아니라 Blob 객체 URL로 내린다 — 사진 배경 PNG는 수 MB라
            // data: URL로는 모바일에서 저장이 막힌다.
            currentCanvas.toBlob((blob) => {
                if (!blob) return;
                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = `${recipe.beanName || 'coffee'}-${currentStyle}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
            }, 'image/png');
            emit('brew_card_download', { style: currentStyle });
        } else if (action === 'share') {
            try {
                const blob = await new Promise((res) => currentCanvas.toBlob(res, 'image/png'));
                const file = new File([blob], 'brew-card.png', { type: 'image/png' });
                const text = T.brag(recipe.beanName);
                const payload = { files: [file], title: recipe.beanName || 'Note My Coffee', text };
                if (shareUrl) payload.url = shareUrl;
                if (navigator.canShare && navigator.canShare(payload)) await navigator.share(payload);
                else await navigator.share(shareUrl ? { url: shareUrl, text } : { text });
                emit('brew_card_share', { style: currentStyle });
            } catch (err) { if (err.name !== 'AbortError') console.error(err); }
        } else if (action === 'copy') {
            navigator.clipboard.writeText(shareUrl).then(() => {
                target.textContent = T.copied;
                setTimeout(() => { target.textContent = T.copy; }, 2000);
                emit('brew_card_share', { style: currentStyle, method: 'copy' });
            }).catch(() => { prompt('링크를 복사하세요:', shareUrl); });
        }
    });

    return overlay;
}
