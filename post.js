// post.js — 공개 레시피 상세. 가져오기(사본 생성) + 작성자 관리(공유 해제/삭제).
// 접근 권한은 Firestore 규칙이 검증한다 — 비공개/해제/숨김/잘못된 ID는 "이용할 수
// 없음"으로 처리하고 비공개 정보는 노출하지 않는다(§5-5, §8).
import { auth, onAuthStateChanged, track } from "./firebase-config.js";
import { signInWithChooser } from "./auth-ui.js";
import CoffeeNotesStorage from "./storage.js";
import { getPost, importPost, unpublishPost, deletePost } from "./community.js";
import { fmtBrewTime, modeLabel } from "./brew-card.js";
import { brewRatio } from "./recipe-share-model.js";
import { isDemo } from "./demo.js";

document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('post-container');
    const postId = new URLSearchParams(location.search).get('id');
    let currentUser = null;
    let post = null;
    let loaded = false;

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function unavailable(msg) {
        box.innerHTML = `
            <div class="no-recipes-message">
                <p class="no-recipes-text">${esc(msg || '이용할 수 없는 레시피예요.')}</p>
                <a class="recipe-share-btn recipe-share-btn--gold" href="discover.html" style="display:inline-block;margin-top:6px;">둘러보기로 가기</a>
            </div>`;
    }

    function tsToDate(ts) {
        try {
            if (ts && typeof ts.toDate === 'function') return ts.toDate();
            if (typeof ts === 'string') return new Date(ts);
        } catch (e) { /* ignore */ }
        return null;
    }

    function render() {
        if (!post) return;
        const p = post.params || {};
        const isEsp = post.method !== 'drip';
        const dose = Number(p.dose) || 0;
        const yld = Number(p.yield) || 0;
        const ratio = brewRatio(dose, yld).text;
        const timeStr = fmtBrewTime({ mode: post.method, time: p.timeSec });
        const d = tsToDate(post.createdAt);
        const dateStr = d ? d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
        const isOwner = !!(currentUser && currentUser.uid === post.ownerId);
        const yieldLabel = isEsp ? '추출량' : '투입 물량';

        const photo = post.hasPhoto && post.photoUrl
            ? `<div class="post-photo"><img src="${esc(post.photoUrl)}" alt="${esc(post.title || 'Coffee')}"></div>` : '';

        const tool = (label, val) => val
            ? `<div class="post-tool"><span class="label">${esc(label)}</span><span>${esc(val)}</span></div>` : '';

        box.innerHTML = `
            <p class="post-eyebrow">${esc(modeLabel(post.method))}</p>
            <h2 class="post-title">${esc(post.title) || esc(post.bean) || '이름 없는 레시피'}</h2>
            <p class="post-author">☕ ${post.ownerId
                ? `<a class="post-author-link" href="profile.html?uid=${esc(post.ownerId)}">${esc(post.ownerName || '커피메이트')}</a>`
                : esc(post.ownerName || '커피메이트')}${dateStr ? ' · ' + esc(dateStr) : ''}</p>

            ${photo}

            <div class="post-params">
                <div><span class="label">도징</span><b>${esc(dose.toFixed(1))}</b><i>g</i></div>
                <div><span class="label">물 온도</span><b>${esc(Number(p.waterTemp) || 0)}</b><i>°C</i></div>
                <div><span class="label">추출 시간</span><b>${esc(timeStr)}</b></div>
                <div><span class="label">${esc(yieldLabel)}</span><b>${esc(yld.toFixed(1))}</b><i>g</i></div>
            </div>
            <p class="post-ratio">추출 비율 <b>${esc(ratio)}</b></p>

            ${(post.bean || post.roaster || post.gear || post.grinder || post.grindSetting) ? `
            <div class="post-tools">
                ${tool('원두', post.bean)}
                ${tool('로스터리', post.roaster)}
                ${tool('추출 도구', post.gear)}
                ${tool('그라인더', post.grinder)}
                ${tool('분쇄도', post.grindSetting)}
            </div>` : ''}

            ${post.description ? `<p class="post-desc">${esc(post.description)}</p>` : ''}

            <div class="post-actions">
                <button type="button" class="post-import-btn" id="btn-import">↓ 내 레시피로 가져오기</button>
                <p class="post-import-hint">내 기록에 사본으로 저장해요. 설정은 자유롭게 바꿀 수 있어요.</p>
                ${isOwner ? `
                    <div class="post-owner-actions">
                        <button type="button" class="recipe-share-btn" id="btn-unshare">공유 해제</button>
                        <button type="button" class="recipe-share-btn" id="btn-delete">삭제</button>
                    </div>` : ''}
            </div>`;

        const importBtn = document.getElementById('btn-import');
        if (importBtn) importBtn.addEventListener('click', onImport);
        const unshareBtn = document.getElementById('btn-unshare');
        if (unshareBtn) unshareBtn.addEventListener('click', onUnshare);
        const deleteBtn = document.getElementById('btn-delete');
        if (deleteBtn) deleteBtn.addEventListener('click', onDelete);

        // 이미 가져왔는지 표시(중복 방지, §12-9): 로그인 상태에서만 확인.
        markIfImported();
    }

    async function markIfImported() {
        if (!currentUser) return;
        const mine = (await CoffeeNotesStorage.getRecipes()) || [];
        const dup = mine.find((r) => r && r.source && r.source.postId === post.id);
        const btn = document.getElementById('btn-import');
        if (dup && btn) {
            btn.textContent = '가져온 레시피 보기';
            btn.dataset.view = '1';
        }
    }

    async function onImport(e) {
        const btn = e.currentTarget;
        if (btn.dataset.view === '1') { location.href = 'logbook.html'; return; }
        if (btn.disabled) return;
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = '가져오는 중…';
        try {
            if (!currentUser && !isDemo()) {
                const user = await signInWithChooser({
                    source: 'post_import', lang: 'ko',
                    desc: '레시피를 내 기록으로 가져오려면 로그인이 필요해요.',
                });
                if (!user) { btn.disabled = false; btn.textContent = original; return; }
                currentUser = user;
                CoffeeNotesStorage.setCurrentUser(user);
            }
            const res = await importPost(post, currentUser);
            track('recipe_imported', { post_id: post.id, duplicated: res.duplicated });
            if (res.demo) {
                // 데모: 실제 저장/이동 없이 결과만 보여준다.
                btn.textContent = '✓ (데모) 내 기록에 저장돼요';
                return;
            }
            btn.textContent = res.duplicated ? '이미 가져온 레시피예요' : '✓ 내 기록에 저장됨';
            // 가져온 사본으로 바로 추출하러 가기.
            setTimeout(() => {
                if (res.recipeId) location.href = 'app.html?rebrew=' + encodeURIComponent(res.recipeId);
                else location.href = 'logbook.html';
            }, 700);
        } catch (err) {
            console.error('[post] 가져오기 실패', err);
            btn.disabled = false;
            btn.textContent = '가져오기 실패 — 다시 시도';
        }
    }

    async function onUnshare(e) {
        if (!confirm('이 레시피의 공개를 해제할까요? 둘러보기 피드와 링크에서 내려갑니다.')) return;
        const btn = e.currentTarget; btn.disabled = true;
        try {
            await unpublishPost(post.id, currentUser);
            track('post_unshared', { post_id: post.id });
            unavailable('공유를 해제했어요.');
        } catch (err) {
            console.error('[post] 공유 해제 실패', err);
            btn.disabled = false; alert('공유 해제에 실패했어요. 잠시 후 다시 시도해주세요.');
        }
    }

    async function onDelete(e) {
        if (!confirm('이 공개 게시물을 삭제할까요? 되돌릴 수 없어요. (내 개인 기록은 그대로 남습니다)')) return;
        const btn = e.currentTarget; btn.disabled = true;
        try {
            await deletePost(post.id, currentUser);
            track('post_deleted', { post_id: post.id });
            unavailable('게시물을 삭제했어요.');
        } catch (err) {
            console.error('[post] 삭제 실패', err);
            btn.disabled = false; alert('삭제에 실패했어요. 잠시 후 다시 시도해주세요.');
        }
    }

    async function loadPost() {
        if (!postId) { unavailable('잘못된 링크예요.'); return; }
        try {
            post = await getPost(postId);
            loaded = true;
            if (!post) { unavailable('이용할 수 없는 레시피예요. 삭제됐거나 비공개로 바뀌었을 수 있어요.'); return; }
            render();
        } catch (e) {
            console.error('[post] 로드 실패', e);
            // 규칙 거부(비공개)도 여기로 온다 — 비공개 정보를 노출하지 않는다.
            unavailable('이용할 수 없는 레시피예요.');
        }
    }

    onAuthStateChanged(auth, (user) => {
        currentUser = user || null;
        CoffeeNotesStorage.setCurrentUser(user);
        if (!loaded) loadPost();
        else if (post) render(); // 로그인 상태 바뀌면 소유자 액션·가져오기 표시 갱신
    });
});
