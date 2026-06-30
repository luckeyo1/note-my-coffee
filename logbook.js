import {
    auth,
    onAuthStateChanged
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

    const _stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

    const renderRecipeCards = async () => {
        elements.recipeCardsGrid.innerHTML = '<div class="loading">Loading recipes...</div>';
        const recipes = await CoffeeNotesStorage.getRecipes();
        recipesCache = Array.isArray(recipes) ? recipes : [];
        elements.recipeCardsGrid.innerHTML = '';

        if (!recipesCache.length) {
            elements.recipeCardsGrid.innerHTML =
                `<p class="no-recipes-message">${i18n[currentLang].noRecipes}</p>`;
            return;
        }

        recipesCache.forEach(recipe => {
            if (!recipe) return;
            const card = document.createElement('div');
            card.className = 'recipe-card';

            const safeMode  = recipe.mode ? recipe.mode.toUpperCase() : 'UNKNOWN';
            const safeRat   = parseInt(recipe.overallRating, 10) || 0;
            const safeWeather = recipe.weather || (currentLang === 'ko' ? '정보 없음' : 'No info');
            const isEsp     = (recipe.mode || 'espresso') === 'espresso';
            const timeStr   = isEsp
                ? `${recipe.time || 0}sec`
                : `${Math.floor((recipe.time || 0) / 60)}:${((recipe.time || 0) % 60).toString().padStart(2, '0')}min`;

            card.innerHTML = `
                ${recipe.imageUrl ? `<img src="${recipe.imageUrl}" alt="${recipe.beanName || 'Coffee'}" class="recipe-card-image">` : ''}
                <div class="recipe-card-content">
                    <h4>${recipe.beanName || (currentLang === 'ko' ? '원두명 미상' : 'Unknown Bean')}</h4>
                    <p><span class="label">${i18n[currentLang].mode}</span> ${safeMode}</p>
                    <p><span class="label">${i18n[currentLang].dosing}</span> ${recipe.dosing || 0}g</p>
                    <p><span class="label">${i18n[currentLang].temp}</span> ${recipe.temp || 0}°C</p>
                    <p><span class="label">${i18n[currentLang].time}</span> ${timeStr}</p>
                    <p><span class="label">${i18n[currentLang].yield}</span> ${recipe.yield || 0}g</p>
                    <p><span class="label">${i18n[currentLang].tasteNotes}</span> ${recipe.tasteNotes || '-'}</p>
                    <p class="recipe-card-rating">${_stars(safeRat)}</p>
                    ${recipe.purchaseUrl ? `<p><a href="${recipe.purchaseUrl}" target="_blank" rel="noopener">${i18n[currentLang].purchaseLink}</a></p>` : ''}
                    <p><span class="label">${i18n[currentLang].weather}</span> ${safeWeather}</p>
                    <p><span class="label">Date:</span> ${recipe.date ? new Date(recipe.date).toLocaleDateString(currentLang === 'ko' ? 'ko-KR' : 'en-US') : '-'}</p>
                    ${recipe.sharedFrom ? '<p class="shared-badge">📨 공유받은 레시피</p>' : ''}
                </div>
                <div class="recipe-card-footer">
                    <span class="status-indicator ${recipe.success ? 'status-success' : 'status-fail'}">
                        ${recipe.success ? i18n[currentLang].success : i18n[currentLang].fail}
                    </span>
                    <div class="recipe-card-actions">
                        <button class="share-btn" data-id="${recipe.id}">${i18n[currentLang].share}</button>
                        <button class="delete-btn" data-id="${recipe.id}">${i18n[currentLang].delete}</button>
                    </div>
                </div>
            `;
            elements.recipeCardsGrid.appendChild(card);
        });
    };

    const deleteRecipe = async (id) => {
        if (confirm(i18n[currentLang].deleteConfirm)) {
            await CoffeeNotesStorage.deleteRecipe(id);
            renderRecipeCards();
        }
    };

    // ── Event delegation ──────────────────────────────────────────────────
    elements.btnNewRecipe.addEventListener('click', () => { window.location.href = 'app.html'; });
    if (elements.mobileFab) {
        elements.mobileFab.addEventListener('click', () => { window.location.href = 'app.html'; });
    }
    elements.btnLangEn.addEventListener('click', () => setLang('en'));
    elements.btnLangKo.addEventListener('click', () => setLang('ko'));

    elements.recipeCardsGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        if (!id) return;

        if (btn.classList.contains('delete-btn')) {
            deleteRecipe(id);
        } else if (btn.classList.contains('share-btn')) {
            const recipe = recipesCache.find(r => r.id === id);
            if (recipe) shareRecipe(recipe);
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
        return `${base}?share=${b64}`;
    }

    function parseShareParam() {
        const raw = new URLSearchParams(window.location.search).get('share');
        if (!raw) return null;
        try {
            const d = JSON.parse(decodeURIComponent(escape(atob(raw))));
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
        ctx.font = '13px monospace';
        ctx.fillText('☕  NOTE MY COFFEE', 22, 30);

        // Mode badge
        const mode  = (recipe.mode || 'espresso').toUpperCase();
        ctx.font    = 'bold 9px monospace';
        const modeW = ctx.measureText(mode).width + 20;
        ctx.fillStyle = 'rgba(200,169,110,0.14)';
        _rrect(ctx, W - 22 - modeW, 14, modeW, 20, 3);
        ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.fillText(mode, W - 22 - modeW + 10, 28);

        // Bean name
        ctx.fillStyle = TEXT;
        ctx.font = 'bold 26px Georgia, serif';
        ctx.fillText(_trunc(recipe.beanName || 'Unknown Bean', 34), 22, 92);

        // Origin line
        const sub = [mode, recipe.origin].filter(Boolean).join(' · ');
        ctx.fillStyle = SUB;
        ctx.font      = '12px monospace';
        ctx.fillText(sub, 22, 112);

        // Divider
        _line(ctx, 22, W - 22, 128, BDR);

        // Params
        const isEsp  = (recipe.mode || 'espresso') === 'espresso';
        const tStr   = isEsp
            ? `${recipe.time || 0}s`
            : `${Math.floor((recipe.time || 0) / 60)}:${((recipe.time || 0) % 60).toString().padStart(2, '0')}`;
        const params = [
            { k: 'DOSING', v: `${recipe.dosing || 0}g` },
            { k: 'TEMP',   v: `${recipe.temp || 0}°C` },
            { k: 'TIME',   v: tStr },
            { k: 'YIELD',  v: `${recipe.yield || 0}g` },
        ];
        const colW = (W - 44) / 4;
        params.forEach(({ k, v }, i) => {
            const x = 22 + i * colW;
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 20px monospace';
            ctx.fillText(v, x, 170);
            ctx.fillStyle = MUTED;
            ctx.font = '9px monospace';
            ctx.fillText(k, x, 186);
        });

        // Divider
        _line(ctx, 22, W - 22, 202, BDR);

        // Taste notes
        if (recipe.tasteNotes) {
            ctx.fillStyle = SUB;
            ctx.font = '13px sans-serif';
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
        ctx.font = 'bold 10px monospace';
        ctx.fillText(ok ? '✓  SUCCESS' : '✗  FAIL', 32, 287);

        // Bottom divider
        _line(ctx, 22, W - 22, 314, BDR);

        // Footer
        ctx.fillStyle = MUTED;
        ctx.font = '11px monospace';
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

        // ── Background: photo (cover-fit) or gradient fallback ──────────
        let hasPhoto = false;
        if (recipe.imageUrl) {
            try { _drawCover(ctx, await _loadImage(recipe.imageUrl), W, H); hasPhoto = true; }
            catch (e) { /* fall through to gradient */ }
        }
        if (!hasPhoto) {
            const g = ctx.createLinearGradient(0, 0, W, H);
            g.addColorStop(0, '#2A2320'); g.addColorStop(1, '#0F0D0C');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
        ctx.font = '500 30px monospace';
        ctx.fillText('☕  NOTE MY COFFEE', 64, 84);

        // Mode badge (top-right)
        const mode  = (recipe.mode || 'espresso').toUpperCase();
        ctx.font    = 'bold 22px monospace';
        const modeW = ctx.measureText(mode).width + 44;
        shadowOff();
        ctx.fillStyle = 'rgba(200,169,110,0.18)';
        _rrect(ctx, W - 64 - modeW, 56, modeW, 44, 8); ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.fillText(mode, W - 64 - modeW + 22, 86);

        // ── Bean name + origin (bottom block) ───────────────────────────
        shadowOn();
        ctx.fillStyle = TEXT;
        ctx.font = 'bold 72px Georgia, serif';
        ctx.fillText(_trunc(recipe.beanName || 'Unknown Bean', 22), 64, 870);

        const sub = [mode, recipe.origin].filter(Boolean).join('  ·  ');
        ctx.fillStyle = SUB;
        ctx.font = '30px monospace';
        ctx.fillText(_trunc(sub, 42), 64, 916);
        shadowOff();

        _line(ctx, 64, W - 64, 958, 'rgba(255,255,255,0.16)');

        // ── Params row ──────────────────────────────────────────────────
        const isEsp = (recipe.mode || 'espresso') === 'espresso';
        const tStr  = isEsp
            ? `${recipe.time || 0}s`
            : `${Math.floor((recipe.time || 0) / 60)}:${((recipe.time || 0) % 60).toString().padStart(2, '0')}`;
        const params = [
            { k: 'DOSING', v: `${recipe.dosing || 0}g` },
            { k: 'TEMP',   v: `${recipe.temp || 0}°C` },
            { k: 'TIME',   v: tStr },
            { k: 'YIELD',  v: `${recipe.yield || 0}g` },
        ];
        const colW = (W - 128) / 4;
        shadowOn();
        params.forEach(({ k, v }, i) => {
            const x = 64 + i * colW;
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 52px monospace';
            ctx.fillText(v, x, 1052);
            ctx.fillStyle = MUTED;
            ctx.font = '22px monospace';
            ctx.fillText(k, x, 1088);
        });
        shadowOff();

        _line(ctx, 64, W - 64, 1128, 'rgba(255,255,255,0.16)');

        // ── Taste notes ─────────────────────────────────────────────────
        if (recipe.tasteNotes) {
            shadowOn();
            ctx.fillStyle = SUB;
            ctx.font = '32px sans-serif';
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
        ctx.font    = 'bold 24px monospace';
        const bW    = ctx.measureText(bText).width + 40;
        ctx.fillStyle = ok ? 'rgba(74,222,128,0.16)' : 'rgba(248,113,113,0.16)';
        _rrect(ctx, W - 64 - bW, 1232, bW, 44, 8); ctx.fill();
        ctx.fillStyle = ok ? '#4ADE80' : '#F87171';
        ctx.fillText(bText, W - 64 - bW + 20, 1262);

        // ── Footer ──────────────────────────────────────────────────────
        ctx.fillStyle = MUTED;
        ctx.font = '24px monospace';
        ctx.fillText('note-my-coffee.web.app', 64, 1318);
        const ds = new Date().toLocaleDateString('ko-KR');
        ctx.fillText(ds, W - 64 - ctx.measureText(ds).width, 1318);

        return c;
    }

    // Build the canvas for a given style ('card' = compact, 'story' = photo bg).
    function renderShareCanvas(recipe, style) {
        return style === 'story'
            ? drawStoryCard(recipe)              // async → Promise<canvas>
            : Promise.resolve(drawShareCard(recipe));
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

        const isEsp  = (recipe.mode || 'espresso') === 'espresso';
        const tStr   = isEsp
            ? `${recipe.time || 0}sec`
            : `${Math.floor((recipe.time || 0) / 60)}:${((recipe.time || 0) % 60).toString().padStart(2, '0')}`;
        const rat    = parseInt(recipe.overallRating) || 0;

        overlay.innerHTML = `
            <div class="recipe-share-box">
                <div class="recipe-share-header">
                    <span>📨 받은 레시피</span>
                    <button class="recipe-share-close" data-close>✕</button>
                </div>
                <div class="import-preview">
                    <h3 class="import-bean">${recipe.beanName || '알 수 없는 원두'}</h3>
                    <p class="import-sub">${(recipe.mode || 'ESPRESSO').toUpperCase()}${recipe.origin ? ' · ' + recipe.origin : ''}</p>
                    <div class="import-params">
                        <div class="import-param"><span class="ip-v">${recipe.dosing || 0}g</span><span class="ip-k">DOSING</span></div>
                        <div class="import-param"><span class="ip-v">${recipe.temp || 0}°C</span><span class="ip-k">TEMP</span></div>
                        <div class="import-param"><span class="ip-v">${tStr}</span><span class="ip-k">TIME</span></div>
                        <div class="import-param"><span class="ip-v">${recipe.yield || 0}g</span><span class="ip-k">YIELD</span></div>
                    </div>
                    ${recipe.tasteNotes ? `<p class="import-notes">✦ ${recipe.tasteNotes}</p>` : ''}
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
                await CoffeeNotesStorage.saveRecipe({
                    ...recipe,
                    id: Date.now().toString(),
                    date: new Date().toISOString(),
                    sharedFrom: true,
                });
                btn.textContent = '✓ 저장됨!';
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
