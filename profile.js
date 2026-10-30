// profile.js — 공개 프로필. 특정 사용자의 공개 닉네임·소개 + 공개 레시피를 모아 보여준다.
//   ?uid=<ownerId>  → 그 사람의 공개 프로필
//   (uid 없음)      → 내 프로필(로그인 필요). 본인이면 닉네임·소개를 편집할 수 있다.
// 공개로 노출하는 건 닉네임·소개·공개 게시물뿐이다 — 이메일·개인 기록은 담기지 않는다.
import { auth, onAuthStateChanged, track, bumpVisit } from "./firebase-config.js";
import { signInWithChooser } from "./auth-ui.js";
import { fetchUserPosts, getProfile, saveProfile } from "./community.js";
import { fmtBrewTime, modeLabel } from "./brew-card.js";
import { isDemo } from "./demo.js";
import { blockUserUI } from "./moderation.js";
import { loadLang } from "./storage.js";
import { initLangToggle } from "./lang-toggle.js";

// 프로필 화면 문자열(ko/en/ja/zh). 카드 지표 라벨은 둘러보기·콘솔과 같은 어휘.
const I18N = {
    ko: { mate: '커피메이트', untitled: '이름 없는 레시피',
          dose: '도징', temp: '물 온도', time: '시간', yieldOut: '추출', yieldIn: '투입',
          publicCount: '공개 레시피 {n}개', editProfile: '프로필 편집', block: '🚫 차단',
          bioEmpty: '소개를 추가해보세요.', publicNick: '공개 닉네임', bioLabel: '한 줄 소개', optional: '(선택)',
          bioPlaceholder: '예: 아침마다 에스프레소 한 잔.', cancel: '취소', save: '저장', saving: '저장 중…',
          blockedMsg: '차단했어요. 이 사용자의 게시물이 숨겨집니다.', goDiscover: '둘러보기로 가기',
          noPublicSelf: '아직 공개한 레시피가 없어요.<br>내 기록에서 공유해보세요.', noPublicOther: '아직 공개한 레시피가 없어요.',
          goToLog: '내 기록으로 가기', needNick: '공개 닉네임을 입력해주세요.',
          saveFail: '저장에 실패했어요. 잠시 후 다시 시도해주세요.', unavailProfile: '이용할 수 없는 프로필이에요.',
          loadFail: '프로필을 불러오지 못했어요. 잠시 후 다시 시도해주세요.', loginToProfile: '로그인하면 내 프로필이 생겨요.',
          login: '로그인', loginDesc: '내 프로필을 보려면 로그인이 필요해요.', demoNote: '🧪 데모라 실제 저장은 안 돼요' },
    en: { mate: 'Coffee mate', untitled: 'Untitled recipe',
          dose: 'DOSE', temp: 'TEMP', time: 'TIME', yieldOut: 'YIELD', yieldIn: 'WATER',
          publicCount: '{n} public recipes', editProfile: 'Edit profile', block: '🚫 Block',
          bioEmpty: 'Add a short bio.', publicNick: 'Public nickname', bioLabel: 'One-line bio', optional: '(optional)',
          bioPlaceholder: 'e.g. An espresso every morning.', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
          blockedMsg: 'Blocked. This user’s posts are now hidden.', goDiscover: 'Go to Discover',
          noPublicSelf: 'No public recipes yet.<br>Share from your log.', noPublicOther: 'No public recipes yet.',
          goToLog: 'Go to my log', needNick: 'Please enter a public nickname.',
          saveFail: 'Couldn’t save. Please try again in a moment.', unavailProfile: 'This profile isn’t available.',
          loadFail: 'Couldn’t load the profile. Please try again in a moment.', loginToProfile: 'Sign in to get your own profile.',
          login: 'Sign in', loginDesc: 'Sign in to see your profile.', demoNote: '🧪 Demo — nothing is really saved' },
    ja: { mate: 'コーヒーメイト', untitled: '無題のレシピ',
          dose: '粉量', temp: '湯温', time: '時間', yieldOut: '抽出', yieldIn: '湯量',
          publicCount: '公開レシピ {n}件', editProfile: 'プロフィール編集', block: '🚫 ブロック',
          bioEmpty: '自己紹介を追加しましょう。', publicNick: '公開ニックネーム', bioLabel: 'ひとこと紹介', optional: '（任意）',
          bioPlaceholder: '例: 毎朝エスプレッソを一杯。', cancel: 'キャンセル', save: '保存', saving: '保存中…',
          blockedMsg: 'ブロックしました。このユーザーの投稿は非表示になります。', goDiscover: '発見へ',
          noPublicSelf: 'まだ公開レシピがありません。<br>自分の記録からシェアしましょう。', noPublicOther: 'まだ公開レシピがありません。',
          goToLog: '自分の記録へ', needNick: '公開ニックネームを入力してください。',
          saveFail: '保存できませんでした。しばらくして再度お試しください。', unavailProfile: 'このプロフィールは利用できません。',
          loadFail: 'プロフィールを読み込めませんでした。しばらくして再度お試しください。', loginToProfile: 'ログインすると自分のプロフィールが作れます。',
          login: 'ログイン', loginDesc: '自分のプロフィールを見るにはログインが必要です。', demoNote: '🧪 デモなので実際には保存されません' },
    zh: { mate: '咖啡夥伴', untitled: '未命名食譜',
          dose: '粉量', temp: '水溫', time: '時間', yieldOut: '萃取', yieldIn: '注水',
          publicCount: '公開食譜 {n} 份', editProfile: '編輯個人檔案', block: '🚫 封鎖',
          bioEmpty: '新增一段簡介吧。', publicNick: '公開暱稱', bioLabel: '一句話簡介', optional: '（選填）',
          bioPlaceholder: '例：每天早上一杯濃縮。', cancel: '取消', save: '儲存', saving: '儲存中…',
          blockedMsg: '已封鎖，此使用者的貼文將被隱藏。', goDiscover: '前往探索',
          noPublicSelf: '目前還沒有公開食譜。<br>從我的紀錄分享吧。', noPublicOther: '目前還沒有公開食譜。',
          goToLog: '前往我的紀錄', needNick: '請輸入公開暱稱。',
          saveFail: '儲存失敗，請稍後再試。', unavailProfile: '此個人檔案無法使用。',
          loadFail: '無法載入個人檔案，請稍後再試。', loginToProfile: '登入後就有自己的個人檔案。',
          login: '登入', loginDesc: '登入後即可查看你的個人檔案。', demoNote: '🧪 示範模式，不會真的儲存' },
};

document.addEventListener('DOMContentLoaded', () => {
    let lang = loadLang();
    const t = () => I18N[lang] || I18N.en;

    const box = document.getElementById('profile-container');
    const paramUid = new URLSearchParams(location.search).get('uid');
    let currentUser = null;
    let started = false;
    // 현재 화면을 현재 언어로 다시 그리는 함수 — 언어 토글 때 호출한다. 뷰가 바뀔 때마다 교체된다.
    let repaint = () => {};

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v, unit) => `<span class="rc-metric"><b>${esc(v)}</b>${unit ? `<i>${esc(unit)}</i>` : ''}</span>`;
    const discoverBtn = (L) => `<a class="recipe-share-btn recipe-share-btn--gold" href="discover.html" style="display:inline-block;margin-top:6px;">${esc(L.goDiscover)}</a>`;

    function message(title, actionHtml) {
        box.innerHTML = `
            <div class="no-recipes-message">
                <p class="no-recipes-text">${title}</p>
                ${actionHtml || ''}
            </div>`;
    }

    // 발견 피드와 동일한 레시피 카드(작성자 줄은 프로필에선 중복이라 뺀다).
    function cardHtml(post) {
        const L = t();
        const p = post.params || {};
        const dose = Number(p.dose) || 0;
        const yld = Number(p.yield) || 0;
        const timeStr = fmtBrewTime({ mode: post.method, time: p.timeSec });
        const modeStr = modeLabel(post.method);
        const ratio = dose > 0 && yld > 0 ? '1:' + (yld / dose).toFixed(1) : '—';
        const yieldLabel = post.method === 'drip' ? L.yieldIn : L.yieldOut;

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
                    <h4>${esc(post.title) || (esc(post.bean) || esc(L.untitled))}</h4>
                    <p class="recipe-card-sub">${esc(post.bean ? post.bean + ' · ' : '')}${esc(modeStr)}</p>
                    <div class="recipe-card-metrics">
                        <div><span class="label">${esc(L.dose)}</span>${num(dose.toFixed(1), 'g')}</div>
                        <div><span class="label">${esc(L.temp)}</span>${num(Number(p.waterTemp) || 0, '°C')}</div>
                        <div><span class="label">${esc(L.time)}</span>${num(timeStr, '')}</div>
                        <div><span class="label">${esc(yieldLabel)}</span>${num(yld.toFixed(1), 'g')}</div>
                    </div>
                </div>
            </a>`;
    }

    function render(uid, profile, posts, isSelf) {
        repaint = () => render(uid, profile, posts, isSelf);
        const L = t();
        const name = (profile && profile.displayName) || (posts[0] && posts[0].ownerName) || L.mate;
        const bio = (profile && profile.bio) || '';
        const initial = esc([...String(name)][0] || '☕');

        const grid = posts.length
            ? `<div class="recipe-grid">${posts.map(cardHtml).join('')}</div>`
            : `<div class="no-recipes-message"><p class="no-recipes-text">${isSelf
                    ? L.noPublicSelf
                    : L.noPublicOther}</p>${isSelf
                    ? `<a class="recipe-share-btn recipe-share-btn--gold" href="logbook.html" style="display:inline-block;margin-top:6px;">${esc(L.goToLog)}</a>` : ''}</div>`;

        box.innerHTML = `
            <div class="profile-head">
                <div class="profile-avatar" aria-hidden="true">${initial}</div>
                <div class="profile-id">
                    <h2 class="profile-name">${esc(name)}</h2>
                    <p class="profile-count">${esc(L.publicCount.replace('{n}', posts.length))}</p>
                </div>
                ${isSelf ? `<button type="button" class="recipe-share-btn" id="btn-edit-profile">${esc(L.editProfile)}</button>`
                    : (uid ? `<button type="button" class="mod-link-btn" id="btn-block-profile">${esc(L.block)}</button>` : '')}
            </div>
            ${bio ? `<p class="profile-bio">${esc(bio)}</p>` : (isSelf ? `<p class="profile-bio profile-bio--empty">${esc(L.bioEmpty)}</p>` : '')}
            <div class="profile-edit" id="profile-edit" hidden>
                <label class="compose-label" for="pf-name">${esc(L.publicNick)}</label>
                <input id="pf-name" class="compose-input" type="text" maxlength="40" value="${esc(name)}">
                <label class="compose-label" for="pf-bio">${esc(L.bioLabel)} <span class="compose-optional">${esc(L.optional)}</span></label>
                <textarea id="pf-bio" class="compose-input compose-textarea" maxlength="200" placeholder="${esc(L.bioPlaceholder)}">${esc(bio)}</textarea>
                <p class="compose-error" id="pf-error" hidden></p>
                <div class="profile-edit-actions">
                    <button type="button" class="recipe-share-btn" id="pf-cancel">${esc(L.cancel)}</button>
                    <button type="button" class="recipe-share-btn recipe-share-btn--gold" id="pf-save">${esc(L.save)}</button>
                </div>
            </div>
            ${grid}`;

        if (isSelf) wireEdit(uid, name, bio);
        else if (uid) {
            const bb = document.getElementById('btn-block-profile');
            if (bb) bb.addEventListener('click', async () => {
                const ok = await blockUserUI(uid, name, currentUser);
                if (ok) { repaint = viewBlocked; viewBlocked(); }
            });
        }
    }

    function viewBlocked() {
        repaint = viewBlocked;
        const L = t();
        message(esc(L.blockedMsg), discoverBtn(L));
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
            const L = t();
            err.hidden = true;
            const newName = document.getElementById('pf-name').value.trim();
            const newBio = document.getElementById('pf-bio').value.trim();
            if (!newName) { showErr(L.needNick); return; }
            const saveBtn = document.getElementById('pf-save');
            saveBtn.disabled = true; saveBtn.textContent = L.saving;
            try {
                await saveProfile(uid, { displayName: newName, bio: newBio });
                track('profile_saved', {});
                // 저장 성공 → 헤더·소개를 갱신해 다시 그린다(게시물은 그대로).
                const posts = await fetchUserPosts(uid);
                render(uid, { displayName: newName, bio: newBio }, posts, true);
                if (isDemo()) {
                    const b = document.querySelector('.profile-id');
                    if (b) b.insertAdjacentHTML('beforeend', `<p class="profile-count" style="color:var(--accent,#B4532A)">${esc(L.demoNote)}</p>`);
                }
            } catch (e) {
                console.error('[profile] 저장 실패', e);
                saveBtn.disabled = false; saveBtn.textContent = L.save;
                showErr(L.saveFail);
            }
        });
    }

    async function load(uid, isSelf) {
        try {
            const [profile, posts] = await Promise.all([getProfile(uid), fetchUserPosts(uid)]);
            if (!profile && posts.length === 0 && !isSelf) {
                repaint = () => { const L = t(); message(esc(L.unavailProfile), discoverBtn(L)); };
                repaint();
                return;
            }
            render(uid, profile, posts, isSelf);
        } catch (e) {
            console.error('[profile] 로드 실패', e);
            repaint = () => message(esc(t().loadFail));
            repaint();
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
        repaint = viewLoginPrompt;
        viewLoginPrompt();
    }

    function viewLoginPrompt() {
        repaint = viewLoginPrompt;
        const L = t();
        message(esc(L.loginToProfile),
            `<button type="button" class="recipe-share-btn recipe-share-btn--gold" id="pf-login" style="margin-top:6px;">${esc(L.login)}</button>`);
        document.getElementById('pf-login')?.addEventListener('click', async () => {
            const user = await signInWithChooser({ source: 'profile', lang, desc: t().loginDesc });
            if (user) { currentUser = user; started = false; start(); }
        });
    }

    // 언어 토글 배선(헤더 + 설정 세그) — 현재 뷰를 현재 언어로 다시 그린다.
    initLangToggle((newLang) => {
        lang = newLang;
        repaint();
    });

    onAuthStateChanged(auth, (user) => {
        currentUser = user || null;
        // 내 프로필 분기는 로그인 상태가 필요하다. uid가 지정된 공개 프로필은 즉시 로드.
        if (!started) start();
        else if (paramUid && user && user.uid === paramUid) load(paramUid, true); // 로그인 후 '편집' 노출 갱신
    });
});
