import {
    auth,
    onAuthStateChanged,
    track
} from "./firebase-config.js";
import CoffeeNotesStorage from "./storage.js";

document.addEventListener('DOMContentLoaded', () => {
    let currentLang = 'en';
    let recipesCache = []; // for event delegation lookup

    const i18n = {
        en: {
            newRecipe: "NEW RECIPE",
            logbookTitle: "MY RECIPE LOGBOOK",
            noRecipes: "No recipes logged yet. Go create one!",
            deleteConfirm: "Are you sure you want to delete this recipe?",
            beanName: "Bean:", mode: "Mode:", dosing: "Dosing:", temp: "Temp:",
            time: "Time:", yield: "Yield:", tasteNotes: "Notes:",
            overallRating: "Rating:", success: "SUCCESS", fail: "FAIL",
            purchaseLink: "Purchase Link", delete: "Delete", weather: "Weather:",
            share: "Share",
            loadFailed: "Couldn't load your recipes. Your records are safe — this is a connection problem.",
            retry: "Try again",
            deleteFailed: "Couldn't delete this recipe. Check your connection and try again.",
        },
        ko: {
            newRecipe: "새 레시피",
            logbookTitle: "나의 레시피 기록",
            noRecipes: "아직 기록된 레시피가 없습니다. 지금 바로 레시피를 만들어보세요!",
            deleteConfirm: "정말로 이 레시피를 삭제하시겠습니까?",
            beanName: "원두명:", mode: "모드:", dosing: "도징량:", temp: "물 온도:",
            time: "추출 시간:", yield: "추출량:", tasteNotes: "맛 노트:",
            overallRating: "전체 평점:", success: "성공", fail: "실패",
            purchaseLink: "구매처 링크", delete: "삭제", weather: "날씨:",
            share: "공유",
            loadFailed: "기록을 불러오지 못했습니다. 기록은 그대로 있고, 연결 문제입니다.",
            retry: "다시 시도",
            deleteFailed: "삭제하지 못했습니다. 연결을 확인하고 다시 시도해주세요.",
        }
    };

    const elements = {
        btnNewRecipe: document.getElementById('btn-new-recipe'),
        mobileFab: document.getElementById('mobile-fab'),
        btnLangEn: document.getElementById('l-en'),
        btnLangKo: document.getElementById('l-ko'),
        logbookTitle: document.querySelector('.logbook-title'),
        recipeCardsGrid: document.getElementById('recipe-cards-grid'),
    };

    // ── Auth ──────────────────────────────────────────────────────────────
    onAuthStateChanged(auth, async (user) => {
        CoffeeNotesStorage.setCurrentUser(user);
        if (user) await CoffeeNotesStorage.migrateLocalToCloud(); // carry trial recipe into the account
        renderRecipeCards();
    });

    // ── Render ────────────────────────────────────────────────────────────
    const setLang = (lang) => {
        currentLang = lang;
        elements.btnLangEn.classList.toggle('active', lang === 'en');
        elements.btnLangKo.classList.toggle('active', lang === 'ko');
        elements.btnNewRecipe.innerText = i18n[lang].newRecipe;
        elements.logbookTitle.innerText = i18n[lang].logbookTitle;
        renderRecipeCards();
    };

    // 앱 페이지는 지금까지 GA4 히트가 0건이었다. track()이 처음 호출될 때만
    // getAnalytics()가 실행되는 구조라, 자동 page_view조차 발생하지 않았다.
    track('app_page_view', { page: 'logbook' });

    const _stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

    // 사용자 입력·공유 링크에서 온 값을 innerHTML에 넣기 전 이스케이프 (XSS 방지)
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // 링크는 http(s)만 허용 (javascript: 등 차단)
    const safeUrl = (u) => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';

    // 추출 시간 표기: 에스프레소는 "28.5s", 드립은 "3:00".
    // time % 60을 그대로 문자열화하면 부동소수점 오차("2:34.29999…")가 노출되므로 반올림해서 조립한다.
    const fmtBrewTime = (recipe) => {
        const t = Number(recipe.time) || 0;
        if ((recipe.mode || 'espresso') === 'espresso') return `${Math.round(t * 10) / 10}s`;
        const total = Math.round(t);
        return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    };

    const modeLabel = (m) => (m === 'drip' ? 'HAND DRIP' : String(m || 'espresso').toUpperCase());

    const renderRecipeCards = async () => {
        elements.recipeCardsGrid.innerHTML = '<div class="loading">Loading recipes...</div>';
        const recipes = await CoffeeNotesStorage.getRecipes();
        elements.recipeCardsGrid.innerHTML = '';

        // null은 "기록 없음"이 아니라 "읽지 못했다"는 뜻이다(storage.js 규약).
        // 이걸 빈 상태로 렌더하면 일시적 네트워크 오류가 전체 기록 유실로 보인다.
        // recipesCache도 덮어쓰지 않는다 — 직전에 성공적으로 읽은 목록을 남겨둔다.
        if (recipes === null) {
            elements.recipeCardsGrid.innerHTML = `
                <div class="no-recipes-message">
                    <p class="no-recipes-text">${esc(i18n[currentLang].loadFailed)}</p>
                    <button type="button" class="recipe-share-btn" id="btn-retry-load">${esc(i18n[currentLang].retry)}</button>
                </div>`;
            const retry = document.getElementById('btn-retry-load');
            if (retry) retry.addEventListener('click', renderRecipeCards);
            track('recipes_load_failed', { page: 'logbook' });
            return;
        }

        recipesCache = recipes;

        if (!recipesCache.length) {
            // 빈 로그북. 앱은 크림색 라이트 테마라 랜딩의 다크 사진이 맞지 않아
            // 앱 팔레트의 골드 라인아트(인라인 SVG)로 둔다 — 요청 0건이고 어느
            // 화면 폭에서도 선명하다.
            elements.recipeCardsGrid.innerHTML = `
                <div class="no-recipes-message">
                    <svg class="no-recipes-art" viewBox="0 0 120 96" fill="none" aria-hidden="true"
                         stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <!-- 펼친 노트 -->
                        <path d="M60 26v56"/>
                        <path d="M60 26C50 19 34 17 22 19v56c12-2 28 0 38 7"/>
                        <path d="M60 26c10-7 26-9 38-7v56c-12-2-28 0-38 7"/>
                        <!-- 빈 줄 (기록되지 않은 상태) -->
                        <path d="M31 33h18M31 43h18M31 53h13" opacity="0.42"/>
                        <path d="M71 33h18M71 43h18M71 53h13" opacity="0.42"/>
                        <!-- 원두 한 알 -->
                        <ellipse cx="60" cy="12" rx="9" ry="6" transform="rotate(-18 60 12)"/>
                        <path d="M53 14c3-4 11-6 14-4" opacity="0.55"/>
                    </svg>
                    <p class="no-recipes-text">${i18n[currentLang].noRecipes}</p>
                </div>`;
            return;
        }

        recipesCache.forEach(recipe => {
            if (!recipe) return;
            const card = document.createElement('div');
            card.className = 'recipe-card';

            const safeMode  = recipe.mode ? modeLabel(recipe.mode) : 'UNKNOWN';
            const safeRat   = Math.max(0, Math.min(5, parseInt(recipe.overallRating, 10) || 0));
            const safeWeather = recipe.weather || (currentLang === 'ko' ? '정보 없음' : 'No info');
            const timeStr   = fmtBrewTime(recipe);
            const purchase  = safeUrl(recipe.purchaseUrl);

            card.innerHTML = `
                ${recipe.imageUrl ? `<img src="${esc(recipe.imageUrl)}" alt="${esc(recipe.beanName || 'Coffee')}" class="recipe-card-image">` : ''}
                <div class="recipe-card-content">
                    <h4>${esc(recipe.beanName) || (currentLang === 'ko' ? '원두명 미상' : 'Unknown Bean')}</h4>
                    <p><span class="label">${i18n[currentLang].mode}</span> ${esc(safeMode)}</p>
                    <p><span class="label">${i18n[currentLang].dosing}</span> ${Number(recipe.dosing) || 0}g</p>
                    <p><span class="label">${i18n[currentLang].temp}</span> ${Number(recipe.temp) || 0}°C</p>
                    <p><span class="label">${i18n[currentLang].time}</span> ${timeStr}</p>
                    <p><span class="label">${i18n[currentLang].yield}</span> ${Number(recipe.yield) || 0}g</p>
                    <p><span class="label">${i18n[currentLang].tasteNotes}</span> ${esc(recipe.tasteNotes) || '-'}</p>
                    <p class="recipe-card-rating">${_stars(safeRat)}</p>
                    ${purchase ? `<p><a href="${esc(purchase)}" target="_blank" rel="noopener">${i18n[currentLang].purchaseLink}</a></p>` : ''}
                    <p><span class="label">${i18n[currentLang].weather}</span> ${esc(safeWeather)}</p>
                    <p><span class="label">Date:</span> ${recipe.date ? new Date(recipe.date).toLocaleDateString(currentLang === 'ko' ? 'ko-KR' : 'en-US') : '-'}</p>
                    ${recipe.sharedFrom ? '<p class="shared-badge">📨 공유받은 레시피</p>' : ''}
                </div>
                <div class="recipe-card-footer">
                    <span class="status-indicator ${recipe.success ? 'status-success' : 'status-fail'}">
                        ${recipe.success ? i18n[currentLang].success : i18n[currentLang].fail}
                    </span>
                    <div class="recipe-card-actions">
                        <button class="share-btn" data-id="${esc(recipe.id)}">${i18n[currentLang].share}</button>
                        <button class="delete-btn" data-id="${esc(recipe.id)}">${i18n[currentLang].delete}</button>
                    </div>
                </div>
            `;
            elements.recipeCardsGrid.appendChild(card);
        });
    };

    const deleteRecipe = async (id) => {
        if (confirm(i18n[currentLang].deleteConfirm)) {
            // 반환값을 확인한다. 예전에는 무시해서, 권한 오류나 오프라인 삭제가
            // 아무 메시지 없이 재렌더 후 카드가 되살아나는 UI 결함처럼 보였다.
            const ok = await CoffeeNotesStorage.deleteRecipe(id);
            track(ok ? 'recipe_deleted' : 'recipe_delete_failed');
            if (!ok) alert(i18n[currentLang].deleteFailed);
            renderRecipeCards();
        }
    };

    // ── Event delegation ──────────────────────────────────────────────────
    elements.btnNewRecipe.addEventListener('click', () => { window.location.href = 'app.html'; });
    if (elements.mobileFab) {
        elements.mobileFab.addEventListener('click', () => { window.location.href = 'app.html'; });
    }
    elements.btnLangEn.addEventListener('click', () => { track('language_changed', { lang: 'en', page: 'logbook' }); setLang('en'); });
    elements.btnLangKo.addEventListener('click', () => { track('language_changed', { lang: 'ko', page: 'logbook' }); setLang('ko'); });

    elements.recipeCardsGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        if (!id) return;

        if (btn.classList.contains('delete-btn')) {
            deleteRecipe(id);
        } else if (btn.classList.contains('share-btn')) {
            const recipe = recipesCache.find(r => r.id === id);
            if (recipe) { track('recipe_share_opened'); shareRecipe(recipe); }
        }
    });

    // ── Share ─────────────────────────────────────────────────────────────
    function buildShareData(r) {
        return {
            n: r.beanName || '', m: r.mode || 'espresso',
            o: r.origin || '',   d: r.dosing,
            t: r.temp,           e: r.time,
            y: r.yield,          k: r.tasteNotes || '',
            r: r.overallRating || 3, s: !!r.success,
        };
    }

    function buildShareUrl(data) {
        const json = JSON.stringify(data);
        const b64  = btoa(unescape(encodeURIComponent(json)));
        // Use current page URL (works locally with .html and on Firebase with cleanUrls)
        const base = window.location.href.split('?')[0];
        // base64의 +/= 는 쿼리스트링에서 깨지므로(+는 공백으로 복원됨) 반드시 인코딩한다
        return `${base}?share=${encodeURIComponent(b64)}`;
    }

    function parseShareParam() {
        const raw = new URLSearchParams(window.location.search).get('share');
        if (!raw) return null;
        try {
            // 과거에 인코딩 없이 만들어진 링크는 +가 공백으로 도착하므로 되돌린다
            const d = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/ /g, '+')))));
            return { beanName: d.n, mode: d.m, origin: d.o, dosing: d.d,
                     temp: d.t, time: d.e, yield: d.y, tasteNotes: d.k,
                     overallRating: d.r, success: d.s };
        } catch { return null; }
    }

    // Canvas recipe card
    function drawShareCard(recipe) {
        const W = 600, H = 380, S = 2;
        const c   = document.createElement('canvas');
        c.width   = W * S;
        c.height  = H * S;
        const ctx = c.getContext('2d');
        ctx.scale(S, S);

        const GOLD  = '#C8A96E', DARK = '#1A1614', SURF = '#0F0D0C';
        const TEXT  = '#EBE5DC', SUB  = '#9B9087',  MUTED = '#5A544E';
        const BDR   = 'rgba(255,255,255,0.08)';

        // BG
        ctx.fillStyle = DARK;
        ctx.fillRect(0, 0, W, H);

        // Header strip
        ctx.fillStyle = SURF;
        ctx.fillRect(0, 0, W, 48);
        ctx.fillStyle = GOLD;
        ctx.font = "13px 'DM Mono', 'Noto Sans KR', monospace";
        ctx.fillText('☕  NOTE MY COFFEE', 22, 30);

        // Mode badge
        const mode  = modeLabel(recipe.mode);
        ctx.font    = "bold 9px 'DM Mono', 'Noto Sans KR', monospace";
        const modeW = ctx.measureText(mode).width + 20;
        ctx.fillStyle = 'rgba(200,169,110,0.14)';
        _rrect(ctx, W - 22 - modeW, 14, modeW, 20, 3);
        ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.fillText(mode, W - 22 - modeW + 10, 28);

        // Bean name
        ctx.fillStyle = TEXT;
        ctx.font = "bold 26px Georgia, 'Gowun Batang', serif";
        ctx.fillText(_trunc(recipe.beanName || 'Unknown Bean', 34), 22, 92);

        // Origin line
        const sub = [mode, recipe.origin].filter(Boolean).join(' · ');
        ctx.fillStyle = SUB;
        ctx.font      = "12px 'DM Mono', 'Noto Sans KR', monospace";
        ctx.fillText(sub, 22, 112);

        // Divider
        _line(ctx, 22, W - 22, 128, BDR);

        // Params
        const params = [
            { k: 'DOSING', v: `${Number(recipe.dosing) || 0}g` },
            { k: 'TEMP',   v: `${Number(recipe.temp) || 0}°C` },
            { k: 'TIME',   v: fmtBrewTime(recipe) },
            { k: 'YIELD',  v: `${Number(recipe.yield) || 0}g` },
        ];
        const colW = (W - 44) / 4;
        params.forEach(({ k, v }, i) => {
            const x = 22 + i * colW;
            ctx.fillStyle = GOLD;
            ctx.font = "bold 20px 'DM Mono', 'Noto Sans KR', monospace";
            ctx.fillText(v, x, 170);
            ctx.fillStyle = MUTED;
            ctx.font = "9px 'DM Mono', 'Noto Sans KR', monospace";
            ctx.fillText(k, x, 186);
        });

        // Divider
        _line(ctx, 22, W - 22, 202, BDR);

        // Taste notes
        if (recipe.tasteNotes) {
            ctx.fillStyle = SUB;
            ctx.font = "13px 'DM Sans', 'Noto Sans KR', sans-serif";
            ctx.fillText('✦  ' + _trunc(recipe.tasteNotes, 56), 22, 228);
        }

        // Stars
        const rat = parseInt(recipe.overallRating) || 0;
        ctx.fillStyle = GOLD;
        ctx.font = '18px serif';
        ctx.fillText('★'.repeat(rat) + '☆'.repeat(5 - rat), 22, 260);

        // Result badge
        const ok = !!recipe.success;
        ctx.fillStyle = ok ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)';
        _rrect(ctx, 22, 272, ok ? 90 : 64, 22, 3);
        ctx.fill();
        ctx.fillStyle = ok ? '#4ADE80' : '#F87171';
        ctx.font = "bold 10px 'DM Mono', 'Noto Sans KR', monospace";
        ctx.fillText(ok ? '✓  SUCCESS' : '✗  FAIL', 32, 287);

        // Bottom divider
        _line(ctx, 22, W - 22, 314, BDR);

        // Footer
        ctx.fillStyle = MUTED;
        ctx.font = "11px 'DM Mono', 'Noto Sans KR', monospace";
        ctx.fillText('note-my-coffee.web.app', 22, 344);
        const ds = new Date().toLocaleDateString('ko-KR');
        ctx.fillText(ds, W - 22 - ctx.measureText(ds).width, 344);

        return c;
    }

    // canvas helpers
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
    function _trunc(s, max) { return s.length > max ? s.slice(0, max) + '…' : s; }

    function _loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload  = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // Draw an image cover-fit (fill box, center-crop the overflow).
    function _drawCover(ctx, img, W, H) {
        const ir = img.width / img.height, cr = W / H;
        let dw, dh, dx, dy;
        if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
        else         { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
        ctx.drawImage(img, dx, dy, dw, dh);
    }

    // Instagram-friendly 4:5 story card: the recipe photo as background,
    // recipe text laid over a legibility scrim. Returns a Promise<canvas>.
    async function drawStoryCard(recipe) {
        const W = 1080, H = 1350;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');

        const GOLD = '#C8A96E', TEXT = '#F5F0E8', SUB = '#D8CFC4', MUTED = '#A89E92';

        // ── Background: photo → brand plate → gradient ──────────────────
        // 사진 없는 레시피도 이 스타일을 고를 수 있어서, 그 경우엔 랜딩과 같은
        // 다크 플레이트를 깔아 밋밋한 그라데이션 한 장으로 나가지 않게 한다.
        // 플레이트도 못 받으면(오프라인 등) 원래의 그라데이션으로 떨어진다.
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

        // ── Legibility scrims (top + heavy bottom) ──────────────────────
        const topG = ctx.createLinearGradient(0, 0, 0, 320);
        topG.addColorStop(0, 'rgba(0,0,0,0.55)'); topG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topG; ctx.fillRect(0, 0, W, 320);

        const botG = ctx.createLinearGradient(0, H - 760, 0, H);
        botG.addColorStop(0, 'rgba(0,0,0,0)');
        botG.addColorStop(0.45, 'rgba(0,0,0,0.55)');
        botG.addColorStop(1, 'rgba(10,8,7,0.94)');
        ctx.fillStyle = botG; ctx.fillRect(0, H - 760, W, 760);

        const shadowOn  = () => { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2; };
        const shadowOff = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };

        // ── Brand (top-left) ────────────────────────────────────────────
        shadowOn();
        ctx.fillStyle = GOLD;
        ctx.font = "500 30px 'DM Mono', 'Noto Sans KR', monospace";
        ctx.fillText('☕  NOTE MY COFFEE', 64, 84);

        // Mode badge (top-right)
        const mode  = modeLabel(recipe.mode);
        ctx.font    = "bold 22px 'DM Mono', 'Noto Sans KR', monospace";
        const modeW = ctx.measureText(mode).width + 44;
        shadowOff();
        ctx.fillStyle = 'rgba(200,169,110,0.18)';
        _rrect(ctx, W - 64 - modeW, 56, modeW, 44, 8); ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.fillText(mode, W - 64 - modeW + 22, 86);

        // ── Bean name + origin (bottom block) ───────────────────────────
        shadowOn();
        ctx.fillStyle = TEXT;
        ctx.font = "bold 72px Georgia, 'Gowun Batang', serif";
        ctx.fillText(_trunc(recipe.beanName || 'Unknown Bean', 22), 64, 870);

        const sub = [mode, recipe.origin].filter(Boolean).join('  ·  ');
        ctx.fillStyle = SUB;
        ctx.font = "30px 'DM Mono', 'Noto Sans KR', monospace";
        ctx.fillText(_trunc(sub, 42), 64, 916);
        shadowOff();

        _line(ctx, 64, W - 64, 958, 'rgba(255,255,255,0.16)');

        // ── Params row ──────────────────────────────────────────────────
        const params = [
            { k: 'DOSING', v: `${Number(recipe.dosing) || 0}g` },
            { k: 'TEMP',   v: `${Number(recipe.temp) || 0}°C` },
            { k: 'TIME',   v: fmtBrewTime(recipe) },
            { k: 'YIELD',  v: `${Number(recipe.yield) || 0}g` },
        ];
        const colW = (W - 128) / 4;
        shadowOn();
        params.forEach(({ k, v }, i) => {
            const x = 64 + i * colW;
            ctx.fillStyle = GOLD;
            ctx.font = "bold 52px 'DM Mono', 'Noto Sans KR', monospace";
            ctx.fillText(v, x, 1052);
            ctx.fillStyle = MUTED;
            ctx.font = "22px 'DM Mono', 'Noto Sans KR', monospace";
            ctx.fillText(k, x, 1088);
        });
        shadowOff();

        _line(ctx, 64, W - 64, 1128, 'rgba(255,255,255,0.16)');

        // ── Taste notes ─────────────────────────────────────────────────
        if (recipe.tasteNotes) {
            shadowOn();
            ctx.fillStyle = SUB;
            ctx.font = "32px 'DM Sans', 'Noto Sans KR', sans-serif";
            ctx.fillText('✦  ' + _trunc(recipe.tasteNotes, 40), 64, 1190);
            shadowOff();
        }

        // ── Stars (left) + result badge (right) ─────────────────────────
        const rat = parseInt(recipe.overallRating) || 0;
        shadowOn();
        ctx.fillStyle = GOLD;
        ctx.font = '44px serif';
        ctx.fillText('★'.repeat(rat) + '☆'.repeat(5 - rat), 64, 1262);
        shadowOff();

        const ok    = !!recipe.success;
        const bText = ok ? '✓  SUCCESS' : '✗  FAIL';
        ctx.font    = "bold 24px 'DM Mono', 'Noto Sans KR', monospace";
        const bW    = ctx.measureText(bText).width + 40;
        ctx.fillStyle = ok ? 'rgba(74,222,128,0.16)' : 'rgba(248,113,113,0.16)';
        _rrect(ctx, W - 64 - bW, 1232, bW, 44, 8); ctx.fill();
        ctx.fillStyle = ok ? '#4ADE80' : '#F87171';
        ctx.fillText(bText, W - 64 - bW + 20, 1262);

        // ── Footer ──────────────────────────────────────────────────────
        ctx.fillStyle = MUTED;
        ctx.font = "24px 'DM Mono', 'Noto Sans KR', monospace";
        ctx.fillText('note-my-coffee.web.app', 64, 1318);
        const ds = new Date().toLocaleDateString('ko-KR');
        ctx.fillText(ds, W - 64 - ctx.measureText(ds).width, 1318);

        return c;
    }

    // Build the canvas for a given style ('card' = compact, 'story' = photo bg).
    // 캔버스는 웹폰트가 로드되기 전에 그리면 조용히 폴백 서체로 그린다. 게다가
    // 구글 폰트는 한글을 unicode-range 서브셋으로 쪼개 서빙하므로, load()에 그릴
    // 텍스트를 함께 넘겨야 그 글자를 담은 서브셋까지 받아온다 — 원두명처럼 페이지
    // 어디에도 없던 글자가 두부(□)로 찍히는 걸 막는다.
    async function waitForCardFonts(recipe) {
        if (!document.fonts) return;
        const text = [recipe.beanName, recipe.origin, recipe.tasteNotes, recipe.weather,
                      i18n.ko.success, i18n.ko.fail].filter(Boolean).join(' ');
        const faces = [
            "bold 72px 'Gowun Batang'", "bold 26px 'Gowun Batang'",
            "500 30px 'DM Mono'", "24px 'DM Mono'",
            "32px 'DM Sans'", "400 20px 'Noto Sans KR'", "700 20px 'Noto Sans KR'",
        ];
        try {
            await Promise.all(faces.map((f) => document.fonts.load(f, text)));
            await document.fonts.ready;
        } catch (e) {
            console.warn('Share card fonts failed to load; drawing with fallbacks.', e);
        }
    }

    async function renderShareCanvas(recipe, style) {
        await waitForCardFonts(recipe);
        return style === 'story'
            ? drawStoryCard(recipe)              // async → Promise<canvas>
            : drawShareCard(recipe);
    }

    async function shareRecipe(recipe) {
        const url = buildShareUrl(buildShareData(recipe));
        showShareModal(recipe, url);
    }

    function showShareModal(recipe, url) {
        _removeModal('share-modal');
        const overlay = document.createElement('div');
        overlay.id    = 'share-modal';
        overlay.className = 'recipe-share-overlay';
        // Default to the photo-background style when a cover photo exists.
        const defaultStyle = recipe.imageUrl ? 'story' : 'card';
        overlay.innerHTML = `
            <div class="recipe-share-box">
                <div class="recipe-share-header">
                    <span>레시피 공유</span>
                    <button class="recipe-share-close" data-close>✕</button>
                </div>
                <div class="recipe-share-tabs">
                    <button class="recipe-share-tab${defaultStyle === 'card' ? ' is-active' : ''}" data-style="card">🗂️ 카드</button>
                    <button class="recipe-share-tab${defaultStyle === 'story' ? ' is-active' : ''}" data-style="story">🖼️ 사진 배경</button>
                </div>
                <div class="recipe-share-preview" data-style="${defaultStyle}">
                    <img class="recipe-share-img" alt="Recipe Card">
                    <div class="recipe-share-spinner">생성 중…</div>
                </div>
                <div class="recipe-share-actions">
                    <button class="recipe-share-btn" data-action="download">↓ 이미지 저장</button>
                    ${navigator.share ? '<button class="recipe-share-btn" data-action="share">↗ 공유</button>' : ''}
                    <button class="recipe-share-btn recipe-share-btn--gold" data-action="copy">🔗 링크 복사</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const imgEl   = overlay.querySelector('.recipe-share-img');
        const preview = overlay.querySelector('.recipe-share-preview');
        const spinner = overlay.querySelector('.recipe-share-spinner');
        let currentStyle  = defaultStyle;
        let currentCanvas = null;

        async function render(style) {
            currentStyle = style;
            preview.dataset.style = style;
            spinner.style.display = 'flex';
            imgEl.style.opacity = '0.25';
            try {
                currentCanvas = await renderShareCanvas(recipe, style);
                imgEl.src = currentCanvas.toDataURL('image/png');
                imgEl.style.opacity = '1';
                spinner.style.display = 'none';
            } catch (err) {
                console.error('Share card render failed:', err);
                spinner.textContent = '이미지를 만들 수 없습니다';
            }
        }
        render(defaultStyle);

        overlay.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-style], [data-action], [data-close]') || e.target;

            if (target === overlay || target.dataset.close !== undefined) {
                _removeModal('share-modal'); return;
            }

            if (target.dataset.style) {
                if (target.dataset.style === currentStyle) return;
                overlay.querySelectorAll('.recipe-share-tab')
                    .forEach(b => b.classList.toggle('is-active', b === target));
                await render(target.dataset.style);
                return;
            }

            const action = target.dataset.action;
            if (!action || !currentCanvas) return;

            if (action === 'download') {
                // Download via a Blob object URL, not a data: URL. A photo-
                // background PNG is several MB as a data: URL, which mobile
                // browsers refuse to download through <a download>; a blob URL
                // is a small reference that saves reliably regardless of size.
                currentCanvas.toBlob((blob) => {
                    if (!blob) return;
                    const objUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href     = objUrl;
                    a.download = `${recipe.beanName || 'coffee'}-${currentStyle}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
                }, 'image/png');
            } else if (action === 'share') {
                try {
                    const blob = await new Promise(res => currentCanvas.toBlob(res, 'image/png'));
                    const file = new File([blob], 'coffee-recipe.png', { type: 'image/png' });
                    const payload = { url, files: [file], title: recipe.beanName || 'Coffee Recipe' };
                    if (navigator.canShare && navigator.canShare(payload)) await navigator.share(payload);
                    else await navigator.share({ url, title: recipe.beanName || 'Coffee Recipe' });
                } catch (err) { if (err.name !== 'AbortError') console.error(err); }
            } else if (action === 'copy') {
                navigator.clipboard.writeText(url).then(() => {
                    target.textContent = '✓ 복사됨';
                    setTimeout(() => { target.textContent = '🔗 링크 복사'; }, 2000);
                }).catch(() => { prompt('링크를 복사하세요:', url); });
            }
        });
    }

    // ── Import (shared link) ──────────────────────────────────────────────
    function showImportModal(recipe) {
        _removeModal('import-modal');
        const overlay = document.createElement('div');
        overlay.id    = 'import-modal';
        overlay.className = 'recipe-share-overlay';

        // 공유 URL에서 파싱된 값은 신뢰할 수 없으므로 전부 이스케이프한다
        const tStr = fmtBrewTime(recipe);
        const rat  = Math.max(0, Math.min(5, parseInt(recipe.overallRating) || 0));

        overlay.innerHTML = `
            <div class="recipe-share-box">
                <div class="recipe-share-header">
                    <span>📨 받은 레시피</span>
                    <button class="recipe-share-close" data-close>✕</button>
                </div>
                <div class="import-preview">
                    <h3 class="import-bean">${esc(recipe.beanName) || '알 수 없는 원두'}</h3>
                    <p class="import-sub">${esc(modeLabel(recipe.mode))}${recipe.origin ? ' · ' + esc(recipe.origin) : ''}</p>
                    <div class="import-params">
                        <div class="import-param"><span class="ip-v">${Number(recipe.dosing) || 0}g</span><span class="ip-k">DOSING</span></div>
                        <div class="import-param"><span class="ip-v">${Number(recipe.temp) || 0}°C</span><span class="ip-k">TEMP</span></div>
                        <div class="import-param"><span class="ip-v">${tStr}</span><span class="ip-k">TIME</span></div>
                        <div class="import-param"><span class="ip-v">${Number(recipe.yield) || 0}g</span><span class="ip-k">YIELD</span></div>
                    </div>
                    ${recipe.tasteNotes ? `<p class="import-notes">✦ ${esc(recipe.tasteNotes)}</p>` : ''}
                    <p class="import-stars">${'★'.repeat(rat) + '☆'.repeat(5 - rat)}</p>
                    <span class="status-indicator ${recipe.success ? 'status-success' : 'status-fail'}">
                        ${recipe.success ? '✓ SUCCESS' : '✗ FAIL'}
                    </span>
                </div>
                <div class="recipe-share-actions">
                    <button class="recipe-share-btn recipe-share-btn--gold" style="flex:1;" data-action="save">
                        내 로그북에 저장하기
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', async (e) => {
            if (e.target === overlay || e.target.dataset.close !== undefined) {
                _removeModal('import-modal');
                window.history.replaceState({}, '', window.location.pathname);
            } else if (e.target.dataset.action === 'save') {
                const btn = e.target;
                btn.disabled     = true;
                btn.textContent  = '저장 중...';
                // 반환값을 확인해야 한다. 예전에는 결과를 무시하고 무조건
                // '✓ 저장됨!'을 표시해서, 저장 실패(오프라인·권한·문서 크기)에도
                // 성공했다고 알리고 모달을 닫았다.
                const saved = await CoffeeNotesStorage.saveRecipe({
                    ...recipe,
                    id: Date.now().toString(),
                    date: new Date().toISOString(),
                    sharedFrom: true,
                });
                if (!saved) {
                    btn.textContent = '저장 실패 — 다시 시도';
                    btn.disabled = false;
                    track('shared_recipe_import_failed');
                    return;
                }
                btn.textContent = '✓ 저장됨!';
                track('shared_recipe_imported');
                setTimeout(() => {
                    _removeModal('import-modal');
                    window.history.replaceState({}, '', window.location.pathname);
                    renderRecipeCards();
                }, 700);
            }
        });
    }

    function _removeModal(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // ── Init ──────────────────────────────────────────────────────────────
    setLang(currentLang);

    // Check if this page was opened via a share link
    const sharedRecipe = parseShareParam();
    if (sharedRecipe) showImportModal(sharedRecipe);
});
