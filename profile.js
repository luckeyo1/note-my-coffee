// profile.js — 공개 프로필. 특정 사용자의 공개 닉네임·소개 + 공개 레시피를 모아 보여준다.
//   ?uid=<ownerId>  → 그 사람의 공개 프로필
//   (uid 없음)      → 내 프로필(로그인 필요). 본인이면 닉네임·소개를 편집할 수 있다.
// 공개로 노출하는 건 닉네임·소개·공개 게시물뿐이다 — 이메일·개인 기록은 담기지 않는다.
import { auth, onAuthStateChanged, track, bumpVisit } from "./firebase-config.js";
import { signInWithChooser } from "./auth-ui.js";
import { fetchUserPosts, getProfile, saveProfile } from "./community.js";
import { fmtBrewTime, modeLabel } from "./brew-card.js";
import { isDemo } from "./demo.js";

document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('profile-container');
    const paramUid = new URLSearchParams(location.search).get('uid');
    let currentUser = null;
    let started = false;

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v, unit) => `<span class="rc-metric"><b>${esc(v)}</b>${unit ? `<i>${esc(unit)}</i>` : ''}</span>`;

    function message(title, actionHtml) {
        box.innerHTML = `
            <div class="no-recipes-message">
                <p class="no-recipes-text">${esc(title)}</p>
                ${actionHtml || ''}
            </div>`;
    }

    // 발견 피드와 동일한 레시피 카드(작성자 줄은 프로필에선 중복이라 뺀다).
    function cardHtml(post) {
        const p = post.params || {};
        const dose = Number(p.dose) || 0;
        const yld = Number(p.yield) || 0;
        const timeStr = fmtBrewTime({ mode: post.method, time: p.timeSec });
        const modeStr = modeLabel(post.method);
        const ratio = dose > 0 && yld > 0 ? '1:' + (yld / dose).toFixed(1) : '—';
        const yieldLabel = post.method === 'drip' ? '투입' : '추출';

        const hero = post.hasPhoto && post.photoUrl
            ? `<div class="recipe-card-photo"><img src="${esc(post.photoUrl)}" alt="${esc(post.title || 'Coffee')}" class="recipe-card-image" loading="lazy"></div>`
            : `<div class="recipe-card-photo recipe-card-photo--data" aria-hidden="true">
                   ${num(dose ? dose.toFixed(1) : '—', dose ? 'g' : '')}
                   ${num(ratio, '')}
                   ${num(timeStr, '')}
               </div>`;

        return `
            <a class="recipe-card feed-card" href="post.html?id=${encodeURIComponent(post.id)}">
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
                </div>
            </a>`;
    }

    function render(uid, profile, posts, isSelf) {
        const name = (profile && profile.displayName) || (posts[0] && posts[0].ownerName) || '커피메이트';
        const bio = (profile && profile.bio) || '';
        const initial = esc([...String(name)][0] || '☕');

        const grid = posts.length
            ? `<div class="recipe-grid">${posts.map(cardHtml).join('')}</div>`
            : `<div class="no-recipes-message"><p class="no-recipes-text">${isSelf
                    ? '아직 공개한 레시피가 없어요.<br>내 기록에서 공유해보세요.'
                    : '아직 공개한 레시피가 없어요.'}</p>${isSelf
                    ? '<a class="recipe-share-btn recipe-share-btn--gold" href="logbook.html" style="display:inline-block;margin-top:6px;">내 기록으로 가기</a>' : ''}</div>`;

        box.innerHTML = `
            <div class="profile-head">
                <div class="profile-avatar" aria-hidden="true">${initial}</div>
                <div class="profile-id">
                    <h2 class="profile-name">${esc(name)}</h2>
                    <p class="profile-count">공개 레시피 ${posts.length}개</p>
                </div>
                ${isSelf ? '<button type="button" class="recipe-share-btn" id="btn-edit-profile">프로필 편집</button>' : ''}
            </div>
            ${bio ? `<p class="profile-bio">${esc(bio)}</p>` : (isSelf ? '<p class="profile-bio profile-bio--empty">소개를 추가해보세요.</p>' : '')}
            <div class="profile-edit" id="profile-edit" hidden>
                <label class="compose-label" for="pf-name">공개 닉네임</label>
                <input id="pf-name" class="compose-input" type="text" maxlength="40" value="${esc(name)}">
                <label class="compose-label" for="pf-bio">한 줄 소개 <span class="compose-optional">(선택)</span></label>
                <textarea id="pf-bio" class="compose-input compose-textarea" maxlength="200" placeholder="예: 아침마다 에스프레소 한 잔.">${esc(bio)}</textarea>
                <p class="compose-error" id="pf-error" hidden></p>
                <div class="profile-edit-actions">
                    <button type="button" class="recipe-share-btn" id="pf-cancel">취소</button>
                    <button type="button" class="recipe-share-btn recipe-share-btn--gold" id="pf-save">저장</button>
                </div>
            </div>
            ${grid}`;

        if (isSelf) wireEdit(uid, name, bio);
    }

    function wireEdit(uid, name, bio) {
        const editBtn = document.getElementById('btn-edit-profile');
        const panel = document.getElementById('profile-edit');
        const err = document.getElementById('pf-error');
        const showErr = (m) => { err.textContent = m; err.hidden = false; };

        editBtn?.addEventListener('click', () => {
            panel.hidden = !panel.hidden;
            if (!panel.hidden) document.getElementById('pf-name')?.focus();
        });
        document.getElementById('pf-cancel')?.addEventListener('click', () => { panel.hidden = true; });

        document.getElementById('pf-save')?.addEventListener('click', async () => {
            err.hidden = true;
            const newName = document.getElementById('pf-name').value.trim();
            const newBio = document.getElementById('pf-bio').value.trim();
            if (!newName) { showErr('공개 닉네임을 입력해주세요.'); return; }
            const saveBtn = document.getElementById('pf-save');
            saveBtn.disabled = true; saveBtn.textContent = '저장 중…';
            try {
                await saveProfile(uid, { displayName: newName, bio: newBio });
                track('profile_saved', {});
                // 저장 성공 → 헤더·소개를 갱신해 다시 그린다(게시물은 그대로).
                const posts = await fetchUserPosts(uid);
                render(uid, { displayName: newName, bio: newBio }, posts, true);
                if (isDemo()) {
                    const b = document.querySelector('.profile-id');
                    if (b) b.insertAdjacentHTML('beforeend', '<p class="profile-count" style="color:var(--accent,#B4532A)">🧪 데모라 실제 저장은 안 돼요</p>');
                }
            } catch (e) {
                console.error('[profile] 저장 실패', e);
                saveBtn.disabled = false; saveBtn.textContent = '저장';
                showErr('저장에 실패했어요. 잠시 후 다시 시도해주세요.');
            }
        });
    }

    async function load(uid, isSelf) {
        try {
            const [profile, posts] = await Promise.all([getProfile(uid), fetchUserPosts(uid)]);
            if (!profile && posts.length === 0 && !isSelf) {
                message('이용할 수 없는 프로필이에요.',
                    '<a class="recipe-share-btn recipe-share-btn--gold" href="discover.html" style="display:inline-block;margin-top:6px;">발견으로 가기</a>');
                return;
            }
            render(uid, profile, posts, isSelf);
        } catch (e) {
            console.error('[profile] 로드 실패', e);
            message('프로필을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
        }
    }

    function start() {
        if (started) return;
        started = true;
        track('app_page_view', { page: 'profile' });
        bumpVisit('profile');

        if (paramUid) { load(paramUid, !!(currentUser && currentUser.uid === paramUid)); return; }

        // uid 없음 = 내 프로필.
        if (isDemo()) { load('demo-u1', true); return; }
        if (currentUser) { load(currentUser.uid, true); return; }

        // 비로그인 → 로그인 유도.
        message('로그인하면 내 프로필이 생겨요.',
            '<button type="button" class="recipe-share-btn recipe-share-btn--gold" id="pf-login" style="margin-top:6px;">로그인</button>');
        document.getElementById('pf-login')?.addEventListener('click', async () => {
            const user = await signInWithChooser({ source: 'profile', lang: 'ko', desc: '내 프로필을 보려면 로그인이 필요해요.' });
            if (user) { currentUser = user; started = false; start(); }
        });
    }

    onAuthStateChanged(auth, (user) => {
        currentUser = user || null;
        // 내 프로필 분기는 로그인 상태가 필요하다. uid가 지정된 공개 프로필은 즉시 로드.
        if (!started) start();
        else if (paramUid && user && user.uid === paramUid) load(paramUid, true); // 로그인 후 '편집' 노출 갱신
    });
});
