import {
    auth,
    onAuthStateChanged,
    track,
    bumpVisit
} from "./firebase-config.js";
import CoffeeNotesStorage, { loadLang, saveLang } from "./storage.js";
import { openBrewShareModal } from "./brew-card.js";

document.addEventListener('DOMContentLoaded', () => {
    // app.html에서 고른 언어를 그대로 이어받는다(storage.js)
    let currentLang = loadLang();
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
        saveLang(lang);
        elements.btnLangEn.classList.toggle('active', lang === 'en');
        elements.btnLangKo.classList.toggle('active', lang === 'ko');
        elements.btnNewRecipe.innerText = i18n[lang].newRecipe;
        elements.logbookTitle.innerText = i18n[lang].logbookTitle;
        renderRecipeCards();
    };

    // 앱 페이지는 지금까지 GA4 히트가 0건이었다. track()이 처음 호출될 때만
    // getAnalytics()가 실행되는 구조라, 자동 page_view조차 발생하지 않았다.
    track('app_page_view', { page: 'logbook' });
    bumpVisit('logbook');

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

            // 기록을 스프레드시트 행이 아니라 '기억'처럼 보이게 한다(Airbnb 숙소 카드 문법).
            // 사용자가 찍은 사진이 주인공이고, 그 아래에 제목 → 부제 → 수치 순으로 조판한다.
            // 사진이 없으면 빈 회색 박스를 두지 않고 **핵심 수치를 타이포그래피로** 그 자리에 채운다.
            const dose  = Number(recipe.dosing) || 0;
            const yld   = Number(recipe.yield) || 0;
            const ratio = dose > 0 && yld > 0 ? '1:' + (yld / dose).toFixed(1) : '—';
            const dateStr = recipe.date
                ? new Date(recipe.date).toLocaleDateString(currentLang === 'ko' ? 'ko-KR' : 'en-US',
                    { month: 'long', day: 'numeric' })
                : '';

            const metric = (v, unit) =>
                `<span class="rc-metric"><b>${v}</b>${unit ? `<i>${unit}</i>` : ''}</span>`;

            const hero = recipe.imageUrl
                ? `<div class="recipe-card-photo"><img src="${esc(recipe.imageUrl)}" alt="${esc(recipe.beanName || 'Coffee')}" class="recipe-card-image" loading="lazy"></div>`
                : `<div class="recipe-card-photo recipe-card-photo--data" aria-hidden="true">
                       ${metric(dose ? dose.toFixed(1) : '—', dose ? 'g' : '')}
                       ${metric(ratio, '')}
                       ${metric(timeStr, '')}
                   </div>`;

            card.innerHTML = `
                ${hero}
                <div class="recipe-card-content">
                    <h4>${esc(recipe.beanName) || (currentLang === 'ko' ? '원두명 미상' : 'Unknown Bean')}</h4>
                    <p class="recipe-card-sub">${dateStr ? esc(dateStr) + ' · ' : ''}${esc(safeMode)}</p>

                    <div class="recipe-card-metrics">
                        <div><span class="label">${i18n[currentLang].dosing}</span>${metric(dose.toFixed(1), 'g')}</div>
                        <div><span class="label">${i18n[currentLang].temp}</span>${metric(Number(recipe.temp) || 0, '°C')}</div>
                        <div><span class="label">${i18n[currentLang].time}</span>${metric(timeStr, '')}</div>
                        <div><span class="label">${i18n[currentLang].yield}</span>${metric(yld.toFixed(1), 'g')}</div>
                    </div>

                    ${recipe.tasteNotes ? `<p class="recipe-card-notes">${esc(recipe.tasteNotes)}</p>` : ''}
                    <p class="recipe-card-rating">${_stars(safeRat)}</p>
                    ${purchase ? `<p class="recipe-card-link"><a href="${esc(purchase)}" target="_blank" rel="noopener">${i18n[currentLang].purchaseLink}</a></p>` : ''}
                    <p class="recipe-card-weather"><span class="label">${i18n[currentLang].weather}</span> ${esc(safeWeather)}</p>
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

    // 브루 카드 렌더링·공유 모달은 brew-card.js가 담당한다(저장 직후 화면과 공유).
    // 여기서는 공유 링크(레시피 전달용)를 만들어 넘기고, 개인 기록(PR) 계산용으로
    // 현재 로그북 목록(recipesCache)을 함께 준다.
    function shareRecipe(recipe) {
        openBrewShareModal(recipe, {
            shareUrl: buildShareUrl(buildShareData(recipe)),
            allRecipes: recipesCache,
            lang: currentLang,
            onEvent: (name, params) => track(name, params),
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
