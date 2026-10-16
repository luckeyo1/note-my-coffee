// discover.js — 발견 피드. community.js에서 공개 게시물을 최신순으로 불러와
// 기존 recipe-card 스타일로 렌더한다. 카드 클릭 → post.html?id=<postId>.
import { track, bumpVisit, auth, onAuthStateChanged } from "./firebase-config.js";
import { fetchFeed, getBlockedUids } from "./community.js";
import { fmtBrewTime, modeLabel } from "./brew-card.js";
import { isDemo } from "./demo.js";
import { openPostActions } from "./moderation.js";

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('feed-grid');
    const moreBtn = document.getElementById('feed-more');
    const filters = document.getElementById('discover-filters');

    // 데모 모드 안내: 가짜 데이터로 흐름만 보여준다는 표시 + 끄는 링크.
    if (isDemo()) {
        const container = document.getElementById('discover-container');
        const sub = container && container.querySelector('.discover-sub');
        if (sub) {
            const b = document.createElement('p');
            b.className = 'demo-banner';
            b.innerHTML = '🧪 데모 모드예요 — 예시 데이터입니다(실제 게시·저장 안 됨). ' +
                '<a href="?demo=0">데모 끄기</a>';
            sub.insertAdjacentElement('afterend', b);
        }
    }

    let mode = 'all';
    let cursor = null;
    let loading = false;
    let done = false;
    let started = false;
    let currentUser = null;
    let blocked = new Set(); // 내가 차단한 uid — 피드에서 제외한다.

    track('app_page_view', { page: 'discover' });
    bumpVisit('discover');

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const num = (v, unit) => `<span class="rc-metric"><b>${esc(v)}</b>${unit ? `<i>${esc(unit)}</i>` : ''}</span>`;

    function cardHtml(post) {
        const p = post.params || {};
        const dose = Number(p.dose) || 0;
        const yld = Number(p.yield) || 0;
        const ratio = dose > 0 && yld > 0 ? '1:' + (yld / dose).toFixed(1) : '—';
        const timeStr = fmtBrewTime({ mode: post.method, time: p.timeSec });
        const modeStr = modeLabel(post.method);
        const yieldLabel = post.method === 'drip' ? '투입' : '추출';

        const hero = post.hasPhoto && post.photoUrl
            ? `<div class="recipe-card-photo"><img src="${esc(post.photoUrl)}" alt="${esc(post.title || 'Coffee')}" class="recipe-card-image" loading="lazy"></div>`
            : `<div class="recipe-card-photo recipe-card-photo--data" aria-hidden="true">
                   ${num(dose ? dose.toFixed(1) : '—', dose ? 'g' : '')}
                   ${num(ratio, '')}
                   ${num(timeStr, '')}
               </div>`;

        return `
            <a class="recipe-card feed-card" href="post.html?id=${encodeURIComponent(post.id)}" data-owner-uid="${esc(post.ownerId || '')}">
                <span class="feed-card-menu" role="button" tabindex="0" aria-label="게시물 신고·차단" data-menu data-postid="${esc(post.id)}" data-uid="${esc(post.ownerId || '')}" data-owner="${esc(post.ownerName || '')}">⋯</span>
                ${hero}
                <div class="recipe-card-content">
                    <h4>${esc(post.title) || (esc(post.bean) || '이름 없는 레시피')}</h4>
                    <p class="recipe-card-sub">${esc(post.bean ? post.bean + ' · ' : '')}${esc(modeStr)}</p>
                    <div class="recipe-card-metrics">
                        <div><span class="label">도징</span>${num(dose.toFixed(1), 'g')}</div>
                        <div><span class="label">물 온도</span>${num(Number(p.waterTemp) || 0, '°C')}</div>
                        <div><span class="label">시간</span>${num(timeStr, '')}</div>
                        <div><span class="label">${yieldLabel}</span>${num(yld.toFixed(1), 'g')}</div>
                    </div>
                    <span class="feed-card-author" role="link" tabindex="0" data-uid="${esc(post.ownerId || '')}">☕ ${esc(post.ownerName || '커피메이트')}</span>
                </div>
            </a>`;
    }

    function renderEmpty() {
        grid.innerHTML = `
            <div class="no-recipes-message">
                <svg class="no-recipes-art" viewBox="0 0 120 96" fill="none" aria-hidden="true"
                     stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <ellipse cx="60" cy="20" rx="10" ry="6.5" transform="rotate(-18 60 20)"/>
                    <path d="M52 22c3-4 12-6 15-4" opacity="0.5"/>
                    <path d="M30 44h60v18a14 14 0 0 1-14 14H44a14 14 0 0 1-14-14z"/>
                    <path d="M90 48h8a7 7 0 0 1 0 14h-8" />
                </svg>
                <p class="no-recipes-text">아직 공개된 레시피가 없어요.<br>첫 레시피를 공유해보세요.</p>
                <a class="recipe-share-btn recipe-share-btn--gold" href="logbook.html" style="display:inline-block;margin-top:6px;">내 기록에서 공유하기</a>
            </div>`;
    }

    async function load(reset) {
        if (loading) return;
        loading = true;
        if (reset) { cursor = null; done = false; grid.innerHTML = '<div class="loading">Loading…</div>'; }
        moreBtn.hidden = true;
        try {
            const res = await fetchFeed({ method: mode, cursor });
            if (reset) grid.innerHTML = '';
            if (reset && res.items.length === 0) { renderEmpty(); return; }
            // 차단한 작성자의 글은 피드에서 제외한다(규칙은 조인을 못 하므로 클라이언트가 거른다).
            res.items.filter((post) => !blocked.has(post.ownerId)).forEach((post) => {
                const wrap = document.createElement('div');
                wrap.innerHTML = cardHtml(post);
                grid.appendChild(wrap.firstElementChild);
            });
            cursor = res.cursor;
            done = res.done;
            moreBtn.hidden = done || res.items.length === 0;
        } catch (e) {
            console.error('[discover] 피드 로드 실패', e);
            if (reset) {
                grid.innerHTML = `<div class="no-recipes-message"><p class="no-recipes-text">피드를 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p><button type="button" class="recipe-share-btn" id="feed-retry">다시 시도</button></div>`;
                const rb = document.getElementById('feed-retry');
                if (rb) rb.addEventListener('click', () => load(true));
            }
        } finally {
            loading = false;
        }
    }

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
