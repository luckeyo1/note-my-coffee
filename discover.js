// discover.js — 발견 피드. community.js에서 공개 게시물을 최신순으로 불러와
// 기존 recipe-card 스타일로 렌더한다. 카드 클릭 → post.html?id=<postId>.
import { track, bumpVisit, auth, onAuthStateChanged } from "./firebase-config.js";
import { fetchFeed, getBlockedUids } from "./community.js";
import { fmtBrewTime, modeLabel } from "./brew-card.js";
import { isDemo } from "./demo.js";
import { openPostActions } from "./moderation.js";
import { loadLang } from "./storage.js";
import { initLangToggle } from "./lang-toggle.js";

// 둘러보기 화면 문자열(ko/en/ja/zh). 카드 지표 라벨은 메인 콘솔과 같은 어휘를 쓴다.
const I18N = {
    ko: { title: '둘러보기', sub: '다른 사람의 한 잔에서 시작해보세요.',
          chipAll: '전체', chipEsp: '에스프레소', chipDrip: '핸드드립', more: '더 보기',
          dose: '도징', temp: '물 온도', time: '시간', yieldOut: '추출', yieldIn: '투입',
          mate: '커피메이트', untitled: '이름 없는 레시피', menuAria: '게시물 신고·차단',
          emptyHtml: '아직 공개된 레시피가 없어요.<br>첫 레시피를 공유해보세요.', shareFromLog: '내 기록에서 공유하기',
          loadErr: '피드를 불러오지 못했어요. 잠시 후 다시 시도해주세요.', retry: '다시 시도',
          demo: '🧪 데모 모드예요 — 예시 데이터입니다(실제 게시·저장 안 됨). ', demoOff: '데모 끄기' },
    en: { title: 'Discover', sub: 'Start from someone else’s cup.',
          chipAll: 'All', chipEsp: 'Espresso', chipDrip: 'Hand drip', more: 'Load more',
          dose: 'DOSE', temp: 'TEMP', time: 'TIME', yieldOut: 'YIELD', yieldIn: 'WATER',
          mate: 'Coffee mate', untitled: 'Untitled recipe', menuAria: 'Report or block post',
          emptyHtml: 'No public recipes yet.<br>Share the first one.', shareFromLog: 'Share from my log',
          loadErr: 'Couldn’t load the feed. Please try again in a moment.', retry: 'Try again',
          demo: '🧪 Demo mode — sample data (nothing is really posted or saved). ', demoOff: 'Turn off demo' },
    ja: { title: '発見', sub: 'ほかの人の一杯から始めてみましょう。',
          chipAll: 'すべて', chipEsp: 'エスプレッソ', chipDrip: 'ハンドドリップ', more: 'もっと見る',
          dose: '粉量', temp: '湯温', time: '時間', yieldOut: '抽出', yieldIn: '湯量',
          mate: 'コーヒーメイト', untitled: '無題のレシピ', menuAria: '投稿を通報・ブロック',
          emptyHtml: 'まだ公開レシピがありません。<br>最初の一杯をシェアしましょう。', shareFromLog: '自分の記録からシェア',
          loadErr: 'フィードを読み込めませんでした。しばらくして再度お試しください。', retry: '再試行',
          demo: '🧪 デモモードです — サンプルデータです（実際には投稿・保存されません）。 ', demoOff: 'デモを終了' },
    zh: { title: '探索', sub: '從別人的一杯開始吧。',
          chipAll: '全部', chipEsp: '義式濃縮', chipDrip: '手沖', more: '載入更多',
          dose: '粉量', temp: '水溫', time: '時間', yieldOut: '萃取', yieldIn: '注水',
          mate: '咖啡夥伴', untitled: '未命名食譜', menuAria: '檢舉或封鎖貼文',
          emptyHtml: '目前還沒有公開食譜。<br>分享第一杯吧。', shareFromLog: '從我的紀錄分享',
          loadErr: '無法載入動態，請稍後再試。', retry: '重試',
          demo: '🧪 示範模式 — 範例資料（不會真的發布或儲存）。 ', demoOff: '關閉示範' },
};

document.addEventListener('DOMContentLoaded', () => {
    let lang = loadLang();
    const t = () => I18N[lang] || I18N.en;

    const grid = document.getElementById('feed-grid');
    const moreBtn = document.getElementById('feed-more');
    const filters = document.getElementById('discover-filters');
    const container = document.getElementById('discover-container');

    let mode = 'all';
    let cursor = null;
    let loading = false;
    let done = false;
    let started = false;
    let loadedOnce = false;
    let currentUser = null;
    let blocked = new Set(); // 내가 차단한 uid — 피드에서 제외한다.
    let items = [];          // 지금까지 불러온(차단 제외) 게시물 — 언어 바뀌면 이걸 다시 그린다.

    track('app_page_view', { page: 'discover' });
    bumpVisit('discover');

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const num = (v, unit) => `<span class="rc-metric"><b>${esc(v)}</b>${unit ? `<i>${esc(unit)}</i>` : ''}</span>`;

    // 제목·부제·필터칩·더보기 버튼을 현재 언어로. (카드는 renderCards가 담당.)
    function applyStatic() {
        const L = t();
        const titleEl = container && container.querySelector('.logbook-title');
        const subEl = container && container.querySelector('.discover-sub');
        if (titleEl) titleEl.textContent = L.title;
        if (subEl) subEl.textContent = L.sub;
        const chip = (m) => filters && filters.querySelector(`[data-mode="${m}"]`);
        if (chip('all')) chip('all').textContent = L.chipAll;
        if (chip('espresso')) chip('espresso').textContent = L.chipEsp;
        if (chip('drip')) chip('drip').textContent = L.chipDrip;
        if (moreBtn) moreBtn.textContent = L.more;
    }

    // 데모 안내 배너: 가짜 데이터임을 표시 + 끄는 링크. (문구는 우리 상수라 안전.)
    function syncDemoBanner() {
        if (!isDemo() || !container) return;
        const L = t();
        let b = container.querySelector('.demo-banner');
        if (!b) {
            const sub = container.querySelector('.discover-sub');
            if (!sub) return;
            b = document.createElement('p');
            b.className = 'demo-banner';
            sub.insertAdjacentElement('afterend', b);
        }
        b.innerHTML = L.demo + '<a href="?demo=0">' + L.demoOff + '</a>';
    }

    function cardHtml(post) {
        const L = t();
        const p = post.params || {};
        const dose = Number(p.dose) || 0;
        const yld = Number(p.yield) || 0;
        const ratio = dose > 0 && yld > 0 ? '1:' + (yld / dose).toFixed(1) : '—';
        const timeStr = fmtBrewTime({ mode: post.method, time: p.timeSec });
        const modeStr = modeLabel(post.method);
        const yieldLabel = post.method === 'drip' ? L.yieldIn : L.yieldOut;

        const hero = post.hasPhoto && post.photoUrl
            ? `<div class="recipe-card-photo"><img src="${esc(post.photoUrl)}" alt="${esc(post.title || 'Coffee')}" class="recipe-card-image" loading="lazy"></div>`
            : `<div class="recipe-card-photo recipe-card-photo--data" aria-hidden="true">
                   ${num(dose ? dose.toFixed(1) : '—', dose ? 'g' : '')}
                   ${num(ratio, '')}
                   ${num(timeStr, '')}
               </div>`;

        return `
            <a class="recipe-card feed-card" href="post.html?id=${encodeURIComponent(post.id)}" data-owner-uid="${esc(post.ownerId || '')}">
                <span class="feed-card-menu" role="button" tabindex="0" aria-label="${esc(L.menuAria)}" data-menu data-postid="${esc(post.id)}" data-uid="${esc(post.ownerId || '')}" data-owner="${esc(post.ownerName || '')}">⋯</span>
                ${hero}
                <div class="recipe-card-content">
                    <h4>${esc(post.title) || (esc(post.bean) || esc(L.untitled))}</h4>
                    <p class="recipe-card-sub">${esc(post.bean ? post.bean + ' · ' : '')}${esc(modeStr)}</p>
                    <div class="recipe-card-metrics">
                        <div><span class="label">${esc(L.dose)}</span>${num(dose.toFixed(1), 'g')}</div>
                        <div><span class="label">${esc(L.temp)}</span>${num(Number(p.waterTemp) || 0, '°C')}</div>
                        <div><span class="label">${esc(L.time)}</span>${num(timeStr, '')}</div>
                        <div><span class="label">${esc(yieldLabel)}</span>${num(yld.toFixed(1), 'g')}</div>
                    </div>
                    <span class="feed-card-author" role="link" tabindex="0" data-uid="${esc(post.ownerId || '')}">☕ ${esc(post.ownerName || L.mate)}</span>
                </div>
            </a>`;
    }

    function renderEmpty() {
        const L = t();
        grid.innerHTML = `
            <div class="no-recipes-message">
                <svg class="no-recipes-art" viewBox="0 0 120 96" fill="none" aria-hidden="true"
                     stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <ellipse cx="60" cy="20" rx="10" ry="6.5" transform="rotate(-18 60 20)"/>
                    <path d="M52 22c3-4 12-6 15-4" opacity="0.5"/>
                    <path d="M30 44h60v18a14 14 0 0 1-14 14H44a14 14 0 0 1-14-14z"/>
                    <path d="M90 48h8a7 7 0 0 1 0 14h-8" />
                </svg>
                <p class="no-recipes-text">${L.emptyHtml}</p>
                <a class="recipe-share-btn recipe-share-btn--gold" href="logbook.html" style="display:inline-block;margin-top:6px;">${esc(L.shareFromLog)}</a>
            </div>`;
    }

    // 누적된 items를 현재 언어로 통째로 다시 그린다(언어 토글/로드 공용).
    function renderCards() {
        if (!items.length) { renderEmpty(); return; }
        grid.innerHTML = '';
        items.forEach((post) => {
            const wrap = document.createElement('div');
            wrap.innerHTML = cardHtml(post);
            if (wrap.firstElementChild) grid.appendChild(wrap.firstElementChild);
        });
    }

    async function load(reset) {
        if (loading) return;
        loading = true;
        if (reset) { cursor = null; done = false; items = []; grid.innerHTML = '<div class="loading">Loading…</div>'; }
        moreBtn.hidden = true;
        try {
            const res = await fetchFeed({ method: mode, cursor });
            // 차단한 작성자의 글은 피드에서 제외한다(규칙은 조인을 못 하므로 클라이언트가 거른다).
            const fresh = res.items.filter((post) => !blocked.has(post.ownerId));
            items = items.concat(fresh);
            loadedOnce = true;
            cursor = res.cursor;
            done = res.done;
            renderCards();
            moreBtn.hidden = done || items.length === 0;
        } catch (e) {
            console.error('[discover] 피드 로드 실패', e);
            if (reset) {
                const L = t();
                grid.innerHTML = `<div class="no-recipes-message"><p class="no-recipes-text">${L.loadErr}</p><button type="button" class="recipe-share-btn" id="feed-retry">${esc(L.retry)}</button></div>`;
                const rb = document.getElementById('feed-retry');
                if (rb) rb.addEventListener('click', () => load(true));
            }
        } finally {
            loading = false;
        }
    }

    // 정적 텍스트·데모 배너를 먼저 칠하고, 언어 토글 배선(헤더+설정 세그).
    applyStatic();
    syncDemoBanner();
    initLangToggle((newLang) => {
        lang = newLang;
        applyStatic();
        syncDemoBanner();
        if (loadedOnce) renderCards();
    });

    filters.addEventListener('click', (e) => {
        const chip = e.target.closest('.lb-chip');
        if (!chip) return;
        const m = chip.dataset.mode || 'all';
        if (m === mode) return;
        mode = m;
        track('discover_filter', { mode });
        filters.querySelectorAll('.lb-chip').forEach((c) => c.classList.toggle('is-active', c === chip));
        load(true);
    });

    moreBtn.addEventListener('click', () => load(false));

    // 작성자 이름 클릭 → 공개 프로필. 카드 전체가 post.html <a>라 여기서 가로채
    // 기본 이동(상세)을 막고 프로필로 보낸다. 중첩 anchor를 피하려 span[role=link]을 쓴다.
    const goProfile = (el) => {
        const uid = el.getAttribute('data-uid');
        if (uid) { track('profile_open', { from: 'discover' }); location.href = 'profile.html?uid=' + encodeURIComponent(uid); }
    };
    grid.addEventListener('click', (e) => {
        const a = e.target.closest('.feed-card-author');
        if (!a) return;
        e.preventDefault(); e.stopPropagation();
        goProfile(a);
    });
    grid.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const a = e.target.closest('.feed-card-author');
        if (!a) return;
        e.preventDefault(); e.stopPropagation();
        goProfile(a);
    });

    // ⋯ 메뉴 → 신고·차단. 차단 성공 시 해당 작성자의 카드를 바로 제거한다.
    async function onMenu(el) {
        const result = await openPostActions({
            postId: el.getAttribute('data-postid'),
            ownerId: el.getAttribute('data-uid'),
            ownerName: el.getAttribute('data-owner'),
            user: currentUser,
        });
        if (result === 'blocked') {
            const uid = el.getAttribute('data-uid');
            if (uid) {
                blocked.add(uid);
                items = items.filter((p) => p.ownerId !== uid);
                const sel = (window.CSS && CSS.escape) ? CSS.escape(uid) : uid;
                grid.querySelectorAll(`[data-owner-uid="${sel}"]`).forEach((c) => c.remove());
            }
        }
    }
    grid.addEventListener('click', (e) => {
        const m = e.target.closest('.feed-card-menu');
        if (!m) return;
        e.preventDefault(); e.stopPropagation();
        onMenu(m);
    });
    grid.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const m = e.target.closest('.feed-card-menu');
        if (!m) return;
        e.preventDefault(); e.stopPropagation();
        onMenu(m);
    });

    // 피드는 차단 목록을 먼저 확보한 뒤 로드한다(로그인 사용자면 첫 화면부터 반영).
    if (isDemo()) {
        load(true);
    } else {
        onAuthStateChanged(auth, async (user) => {
            currentUser = user || null;
            try { blocked = await getBlockedUids(user); } catch (e) { blocked = new Set(); }
            if (!started) { started = true; load(true); }
        });
    }
});
