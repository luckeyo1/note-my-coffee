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
import { reportPostUI, blockUserUI } from "./moderation.js";
import { loadLang } from "./storage.js";
import { initLangToggle } from "./lang-toggle.js";

// 상세 화면 문자열(ko/en/ja/zh).
const I18N = {
    ko: { unavailDefault: '이용할 수 없는 레시피예요.', goDiscover: '둘러보기로 가기', untitled: '이름 없는 레시피', mate: '커피메이트',
          dose: '도징', temp: '물 온도', timeLabel: '추출 시간', yieldEsp: '추출량', yieldDrip: '투입 물량', ratioLabel: '추출 비율',
          toolBean: '원두', toolRoaster: '로스터리', toolGear: '추출 도구', toolGrinder: '그라인더', toolGrind: '분쇄도',
          importBtn: '↓ 내 레시피로 가져오기', importHint: '내 기록에 사본으로 저장해요. 설정은 자유롭게 바꿀 수 있어요.',
          unshare: '공유 해제', delete: '삭제', report: '🚩 신고', blockUser: '🚫 이 사용자 차단', blockedPost: '차단한 사용자의 게시물이에요.',
          viewImported: '가져온 레시피 보기', importing: '가져오는 중…', importDesc: '레시피를 내 기록으로 가져오려면 로그인이 필요해요.',
          importedDemo: '✓ (데모) 내 기록에 저장돼요', alreadyImported: '이미 가져온 레시피예요', importedOk: '✓ 내 기록에 저장됨', importFail: '가져오기 실패 — 다시 시도',
          confirmUnshare: '이 레시피의 공개를 해제할까요? 둘러보기 피드와 링크에서 내려갑니다.', unshared: '공유를 해제했어요.', unshareFail: '공유 해제에 실패했어요. 잠시 후 다시 시도해주세요.',
          confirmDelete: '이 공개 게시물을 삭제할까요? 되돌릴 수 없어요. (내 개인 기록은 그대로 남습니다)', deleted: '게시물을 삭제했어요.', deleteFail: '삭제에 실패했어요. 잠시 후 다시 시도해주세요.',
          badLink: '잘못된 링크예요.', unavailMaybe: '이용할 수 없는 레시피예요. 삭제됐거나 비공개로 바뀌었을 수 있어요.' },
    en: { unavailDefault: 'This recipe isn’t available.', goDiscover: 'Go to Discover', untitled: 'Untitled recipe', mate: 'Coffee mate',
          dose: 'DOSE', temp: 'WATER TEMP', timeLabel: 'BREW TIME', yieldEsp: 'YIELD', yieldDrip: 'WATER IN', ratioLabel: 'Brew ratio',
          toolBean: 'Bean', toolRoaster: 'Roastery', toolGear: 'Brewer', toolGrinder: 'Grinder', toolGrind: 'Grind',
          importBtn: '↓ Import to my recipes', importHint: 'Saved as a copy in your log. Tweak the settings freely.',
          unshare: 'Unshare', delete: 'Delete', report: '🚩 Report', blockUser: '🚫 Block this user', blockedPost: 'This is a blocked user’s post.',
          viewImported: 'View imported recipe', importing: 'Importing…', importDesc: 'Sign in to import this recipe into your log.',
          importedDemo: '✓ (Demo) Would be saved to your log', alreadyImported: 'Already imported', importedOk: '✓ Saved to your log', importFail: 'Import failed — try again',
          confirmUnshare: 'Unshare this recipe? It will be removed from the Discover feed and its link.', unshared: 'Unshared.', unshareFail: 'Couldn’t unshare. Please try again in a moment.',
          confirmDelete: 'Delete this public post? This can’t be undone. (Your private log stays intact.)', deleted: 'Post deleted.', deleteFail: 'Couldn’t delete. Please try again in a moment.',
          badLink: 'Invalid link.', unavailMaybe: 'This recipe isn’t available. It may have been deleted or made private.' },
    ja: { unavailDefault: 'このレシピは利用できません。', goDiscover: '発見へ', untitled: '無題のレシピ', mate: 'コーヒーメイト',
          dose: '粉量', temp: '湯温', timeLabel: '抽出時間', yieldEsp: '抽出量', yieldDrip: '注湯量', ratioLabel: '抽出比率',
          toolBean: '豆', toolRoaster: 'ロースター', toolGear: '抽出器具', toolGrinder: 'グラインダー', toolGrind: '挽き目',
          importBtn: '↓ 自分のレシピに取り込む', importHint: '自分の記録にコピーとして保存します。設定は自由に変更できます。',
          unshare: '公開を解除', delete: '削除', report: '🚩 通報', blockUser: '🚫 このユーザーをブロック', blockedPost: 'ブロックしたユーザーの投稿です。',
          viewImported: '取り込んだレシピを見る', importing: '取り込み中…', importDesc: 'レシピを自分の記録に取り込むにはログインが必要です。',
          importedDemo: '✓（デモ）自分の記録に保存されます', alreadyImported: 'すでに取り込み済みです', importedOk: '✓ 記録に保存しました', importFail: '取り込み失敗 — 再試行',
          confirmUnshare: 'このレシピの公開を解除しますか？発見フィードとリンクから外れます。', unshared: '公開を解除しました。', unshareFail: '公開解除に失敗しました。しばらくして再度お試しください。',
          confirmDelete: 'この公開投稿を削除しますか？元に戻せません。（自分の記録はそのまま残ります）', deleted: '投稿を削除しました。', deleteFail: '削除に失敗しました。しばらくして再度お試しください。',
          badLink: '無効なリンクです。', unavailMaybe: 'このレシピは利用できません。削除されたか非公開になった可能性があります。' },
    zh: { unavailDefault: '此食譜無法使用。', goDiscover: '前往探索', untitled: '未命名食譜', mate: '咖啡夥伴',
          dose: '粉量', temp: '水溫', timeLabel: '萃取時間', yieldEsp: '萃取量', yieldDrip: '注水量', ratioLabel: '萃取比例',
          toolBean: '咖啡豆', toolRoaster: '烘豆商', toolGear: '沖煮器具', toolGrinder: '磨豆機', toolGrind: '研磨度',
          importBtn: '↓ 匯入我的食譜', importHint: '以副本儲存到你的紀錄，設定可自由調整。',
          unshare: '取消公開', delete: '刪除', report: '🚩 檢舉', blockUser: '🚫 封鎖此使用者', blockedPost: '這是被封鎖使用者的貼文。',
          viewImported: '查看已匯入的食譜', importing: '匯入中…', importDesc: '登入後即可將此食譜匯入你的紀錄。',
          importedDemo: '✓（示範）將會存到你的紀錄', alreadyImported: '已匯入過了', importedOk: '✓ 已存到你的紀錄', importFail: '匯入失敗 — 請重試',
          confirmUnshare: '要取消這份食譜的公開嗎？它會從探索動態與連結中移除。', unshared: '已取消公開。', unshareFail: '取消公開失敗，請稍後再試。',
          confirmDelete: '要刪除這則公開貼文嗎？無法復原。（你的私人紀錄會保留）', deleted: '已刪除貼文。', deleteFail: '刪除失敗，請稍後再試。',
          badLink: '連結無效。', unavailMaybe: '此食譜無法使用，可能已被刪除或改為私人。' },
};
const LOCALE = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-TW' };

document.addEventListener('DOMContentLoaded', () => {
    let lang = loadLang();
    const t = () => I18N[lang] || I18N.en;

    const box = document.getElementById('post-container');
    const postId = new URLSearchParams(location.search).get('id');
    let currentUser = null;
    let post = null;
    let loaded = false;
    // 현재 화면을 현재 언어로 다시 그리는 함수 — 언어 토글 때 호출. 뷰가 바뀔 때마다 교체.
    let repaint = () => {};

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // "이용할 수 없음" 계열 화면 — key는 I18N의 메시지 키(언어 토글 시 다시 그린다).
    function viewUnavailable(key) {
        repaint = () => viewUnavailable(key);
        const L = t();
        box.innerHTML = `
            <div class="no-recipes-message">
                <p class="no-recipes-text">${esc(L[key] || L.unavailDefault)}</p>
                <a class="recipe-share-btn recipe-share-btn--gold" href="discover.html" style="display:inline-block;margin-top:6px;">${esc(L.goDiscover)}</a>
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
        repaint = render;
        const L = t();
        const p = post.params || {};
        const isEsp = post.method !== 'drip';
        const dose = Number(p.dose) || 0;
        const yld = Number(p.yield) || 0;
        const ratio = brewRatio(dose, yld).text;
        const timeStr = fmtBrewTime({ mode: post.method, time: p.timeSec });
        const d = tsToDate(post.createdAt);
        const dateStr = d ? d.toLocaleDateString(LOCALE[lang] || 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
        const isOwner = !!(currentUser && currentUser.uid === post.ownerId);
        const yieldLabel = isEsp ? L.yieldEsp : L.yieldDrip;

        const photo = post.hasPhoto && post.photoUrl
            ? `<div class="post-photo"><img src="${esc(post.photoUrl)}" alt="${esc(post.title || 'Coffee')}"></div>` : '';

        const tool = (label, val) => val
            ? `<div class="post-tool"><span class="label">${esc(label)}</span><span>${esc(val)}</span></div>` : '';

        box.innerHTML = `
            <p class="post-eyebrow">${esc(modeLabel(post.method))}</p>
            <h2 class="post-title">${esc(post.title) || esc(post.bean) || esc(L.untitled)}</h2>
            <p class="post-author">☕ ${post.ownerId
                ? `<a class="post-author-link" href="profile.html?uid=${esc(post.ownerId)}">${esc(post.ownerName || L.mate)}</a>`
                : esc(post.ownerName || L.mate)}${dateStr ? ' · ' + esc(dateStr) : ''}</p>

            ${photo}

            <div class="post-params">
                <div><span class="label">${esc(L.dose)}</span><b>${esc(dose.toFixed(1))}</b><i>g</i></div>
                <div><span class="label">${esc(L.temp)}</span><b>${esc(Number(p.waterTemp) || 0)}</b><i>°C</i></div>
                <div><span class="label">${esc(L.timeLabel)}</span><b>${esc(timeStr)}</b></div>
                <div><span class="label">${esc(yieldLabel)}</span><b>${esc(yld.toFixed(1))}</b><i>g</i></div>
            </div>
            <p class="post-ratio">${esc(L.ratioLabel)} <b>${esc(ratio)}</b></p>

            ${(post.bean || post.roaster || post.gear || post.grinder || post.grindSetting) ? `
            <div class="post-tools">
                ${tool(L.toolBean, post.bean)}
                ${tool(L.toolRoaster, post.roaster)}
                ${tool(L.toolGear, post.gear)}
                ${tool(L.toolGrinder, post.grinder)}
                ${tool(L.toolGrind, post.grindSetting)}
            </div>` : ''}

            ${post.description ? `<p class="post-desc">${esc(post.description)}</p>` : ''}

            <div class="post-actions">
                <button type="button" class="post-import-btn" id="btn-import">${esc(L.importBtn)}</button>
                <p class="post-import-hint">${esc(L.importHint)}</p>
                ${isOwner ? `
                    <div class="post-owner-actions">
                        <button type="button" class="recipe-share-btn" id="btn-unshare">${esc(L.unshare)}</button>
                        <button type="button" class="recipe-share-btn" id="btn-delete">${esc(L.delete)}</button>
                    </div>` : (post.ownerId ? `
                    <div class="mod-inline-actions">
                        <button type="button" class="mod-link-btn" id="btn-report">${esc(L.report)}</button>
                        <button type="button" class="mod-link-btn" id="btn-block">${esc(L.blockUser)}</button>
                    </div>` : '')}
            </div>`;

        const importBtn = document.getElementById('btn-import');
        if (importBtn) importBtn.addEventListener('click', onImport);
        const unshareBtn = document.getElementById('btn-unshare');
        if (unshareBtn) unshareBtn.addEventListener('click', onUnshare);
        const deleteBtn = document.getElementById('btn-delete');
        if (deleteBtn) deleteBtn.addEventListener('click', onDelete);
        const reportBtn = document.getElementById('btn-report');
        if (reportBtn) reportBtn.addEventListener('click', () => reportPostUI(post.id, currentUser));
        const blockBtn = document.getElementById('btn-block');
        if (blockBtn) blockBtn.addEventListener('click', async () => {
            const ok = await blockUserUI(post.ownerId, post.ownerName, currentUser);
            if (ok) viewUnavailable('blockedPost');
        });

        // 이미 가져왔는지 표시(중복 방지, §12-9): 로그인 상태에서만 확인.
        markIfImported();
    }

    async function markIfImported() {
        if (!currentUser) return;
        const mine = (await CoffeeNotesStorage.getRecipes()) || [];
        const dup = mine.find((r) => r && r.source && r.source.postId === post.id);
        const btn = document.getElementById('btn-import');
        if (dup && btn) {
            btn.textContent = t().viewImported;
            btn.dataset.view = '1';
        }
    }

    async function onImport(e) {
        const btn = e.currentTarget;
        if (btn.dataset.view === '1') { location.href = 'logbook.html'; return; }
        if (btn.disabled) return;
        btn.disabled = true;
        const L = t();
        const original = btn.textContent;
        btn.textContent = L.importing;
        try {
            if (!currentUser && !isDemo()) {
                const user = await signInWithChooser({
                    source: 'post_import', lang,
                    desc: L.importDesc,
                });
                if (!user) { btn.disabled = false; btn.textContent = original; return; }
                currentUser = user;
                CoffeeNotesStorage.setCurrentUser(user);
            }
            const res = await importPost(post, currentUser);
            track('recipe_imported', { post_id: post.id, duplicated: res.duplicated });
            if (res.demo) {
                // 데모: 실제 저장/이동 없이 결과만 보여준다.
                btn.textContent = L.importedDemo;
                return;
            }
            btn.textContent = res.duplicated ? L.alreadyImported : L.importedOk;
            // 가져온 사본으로 바로 추출하러 가기.
            setTimeout(() => {
                if (res.recipeId) location.href = 'app.html?rebrew=' + encodeURIComponent(res.recipeId);
                else location.href = 'logbook.html';
            }, 700);
        } catch (err) {
            console.error('[post] 가져오기 실패', err);
            btn.disabled = false;
            btn.textContent = L.importFail;
        }
    }

    async function onUnshare(e) {
        const L = t();
        if (!confirm(L.confirmUnshare)) return;
        const btn = e.currentTarget; btn.disabled = true;
        try {
            await unpublishPost(post.id, currentUser);
            track('post_unshared', { post_id: post.id });
            viewUnavailable('unshared');
        } catch (err) {
            console.error('[post] 공유 해제 실패', err);
            btn.disabled = false; alert(L.unshareFail);
        }
    }

    async function onDelete(e) {
        const L = t();
        if (!confirm(L.confirmDelete)) return;
        const btn = e.currentTarget; btn.disabled = true;
        try {
            await deletePost(post.id, currentUser);
            track('post_deleted', { post_id: post.id });
            viewUnavailable('deleted');
        } catch (err) {
            console.error('[post] 삭제 실패', err);
            btn.disabled = false; alert(L.deleteFail);
        }
    }

    async function loadPost() {
        if (!postId) { viewUnavailable('badLink'); return; }
        try {
            post = await getPost(postId);
            loaded = true;
            if (!post) { viewUnavailable('unavailMaybe'); return; }
            render();
        } catch (e) {
            console.error('[post] 로드 실패', e);
            // 규칙 거부(비공개)도 여기로 온다 — 비공개 정보를 노출하지 않는다.
            viewUnavailable('unavailDefault');
        }
    }

    // 언어 토글 배선(헤더 + 설정 세그) — 현재 뷰를 현재 언어로 다시 그린다.
    initLangToggle((newLang) => {
        lang = newLang;
        repaint();
    });

    onAuthStateChanged(auth, (user) => {
        currentUser = user || null;
        CoffeeNotesStorage.setCurrentUser(user);
        if (!loaded) loadPost();
        else if (post) render(); // 로그인 상태 바뀌면 소유자 액션·가져오기 표시 갱신
    });
});
