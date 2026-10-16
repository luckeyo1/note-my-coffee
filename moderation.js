// moderation.js — 신고·차단 UI(UGC 안전). 둘러보기·상세·프로필에서 공용으로 쓴다.
// Google Play 정책: 사용자 생성 콘텐츠가 있는 앱은 "부적절한 콘텐츠·사용자를 신고하고
// 차단하는 인앱 수단"이 있어야 한다. 데이터 계층은 community.js, 규칙은 firestore.rules.
import { reportPost, blockUser } from "./community.js";
import { signInWithChooser } from "./auth-ui.js";
import { isDemo } from "./demo.js";
import { track } from "./firebase-config.js";

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── 토스트 ──────────────────────────────────────────────────────────────
let toastTimer = null;
export function showToast(msg, { error = false } = {}) {
    let el = document.querySelector('.mod-toast');
    if (!el) {
        el = document.createElement('div');
        el.className = 'mod-toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle('is-error', !!error);
    void el.offsetWidth; // reflow → 트랜지션
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2800);
}

// ── 공용 오버레이(포커스/ESC/백드롭 닫기) ──────────────────────────────
function openOverlay(innerHtml, onMount) {
    return new Promise((resolve) => {
        const prev = document.activeElement;
        const ov = document.createElement('div');
        ov.className = 'mod-overlay';
        ov.innerHTML = innerHtml;
        document.body.appendChild(ov);
        document.body.classList.add('mod-lock');
        void ov.offsetWidth;
        ov.classList.add('is-open');

        let done = false;
        function close(result) {
            if (done) return; done = true;
            document.removeEventListener('keydown', onKey);
            ov.classList.remove('is-open');
            setTimeout(() => {
                ov.remove();
                if (!document.querySelector('.mod-overlay')) document.body.classList.remove('mod-lock');
                try { prev && prev.focus && prev.focus(); } catch (e) { /* ignore */ }
            }, 180);
            resolve(result);
        }
        function onKey(e) {
            if (e.key === 'Escape') { close(null); return; }
            if (e.key === 'Tab') { // 포커스 트랩(간단)
                const f = [...ov.querySelectorAll('button, input, textarea, [href]')].filter(x => !x.disabled);
                if (!f.length) return;
                const first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }
        document.addEventListener('keydown', onKey);
        ov.addEventListener('click', (e) => { if (e.target === ov) close(null); });
        (ov.querySelector('[autofocus]') || ov.querySelector('button, input, textarea')) ?.focus();
        if (onMount) onMount(ov, close);
    });
}

// ── 신고 사유 다이얼로그 ────────────────────────────────────────────────
const REPORT_REASONS = ['스팸·광고', '부적절하거나 불쾌한 콘텐츠', '저작권·명의 도용', '기타'];
function openReportDialog() {
    const chips = REPORT_REASONS.map((r, i) =>
        `<button type="button" class="mod-reason" data-r="${esc(r)}" aria-pressed="${i === 0}">${esc(r)}</button>`).join('');
    const html = `
      <div class="mod-dialog" role="dialog" aria-modal="true" aria-labelledby="mod-rep-title">
        <h3 class="mod-title" id="mod-rep-title">게시물 신고</h3>
        <p class="mod-desc">신고 사유를 선택해주세요. 검토 후 조치합니다.</p>
        <div class="mod-reasons">${chips}</div>
        <textarea class="mod-textarea" id="mod-rep-detail" maxlength="460" placeholder="(선택) 자세한 내용을 적어주세요."></textarea>
        <div class="mod-actions">
          <button type="button" class="mod-btn" data-act="cancel">취소</button>
          <button type="button" class="mod-btn mod-btn--danger" data-act="submit">신고하기</button>
        </div>
      </div>`;
    return openOverlay(html, (ov, close) => {
        let reason = REPORT_REASONS[0];
        ov.querySelectorAll('.mod-reason').forEach((b) => b.addEventListener('click', () => {
            ov.querySelectorAll('.mod-reason').forEach((x) => x.setAttribute('aria-pressed', 'false'));
            b.setAttribute('aria-pressed', 'true');
            reason = b.getAttribute('data-r');
        }));
        ov.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
        ov.querySelector('[data-act="submit"]').addEventListener('click', () => {
            const detail = ov.querySelector('#mod-rep-detail').value.trim();
            close(detail ? `${reason} — ${detail}` : reason);
        });
    });
}

// ── 확인 다이얼로그 ────────────────────────────────────────────────────
function confirmDialog(title, desc, okLabel = '확인') {
    const html = `
      <div class="mod-dialog" role="dialog" aria-modal="true" aria-labelledby="mod-cf-title">
        <h3 class="mod-title" id="mod-cf-title">${esc(title)}</h3>
        ${desc ? `<p class="mod-desc">${esc(desc)}</p>` : ''}
        <div class="mod-actions">
          <button type="button" class="mod-btn" data-act="cancel" autofocus>취소</button>
          <button type="button" class="mod-btn mod-btn--danger" data-act="ok">${esc(okLabel)}</button>
        </div>
      </div>`;
    return openOverlay(html, (ov, close) => {
        ov.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
        ov.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
    }).then((r) => r === true);
}

// ── 액션 시트(⋯) ───────────────────────────────────────────────────────
function actionSheet(items) {
    const btns = items.map((it) =>
        `<button type="button" class="mod-sheet-item${it.danger ? ' is-danger' : ''}" data-id="${esc(it.id)}">${esc(it.label)}</button>`).join('');
    const html = `
      <div class="mod-sheet" role="dialog" aria-modal="true" aria-label="게시물 관리">
        ${btns}
        <button type="button" class="mod-sheet-item mod-sheet-cancel" data-id="cancel">취소</button>
      </div>`;
    return openOverlay(html, (ov, close) => {
        ov.querySelectorAll('.mod-sheet-item').forEach((b) => b.addEventListener('click', () => close(b.getAttribute('data-id'))));
    });
}

async function ensureUser(user) {
    if (user && user.uid) return user;
    if (isDemo()) return { uid: 'demo-u1', displayName: '데모' };
    try {
        return await signInWithChooser({ source: 'moderation', lang: 'ko', desc: '계속하려면 로그인이 필요해요.' });
    } catch (e) { return null; }
}

/** 게시물 신고 UI 흐름. 반환: 성공 여부. */
export async function reportPostUI(postId, user) {
    const u = await ensureUser(user);
    if (!u) return false;
    const reason = await openReportDialog();
    if (!reason) return false;
    try {
        await reportPost(postId, reason, u);
        track('post_reported', { post_id: postId });
        showToast('신고가 접수되었어요. 검토 후 조치할게요.');
        return true;
    } catch (e) {
        console.error('[moderation] 신고 실패', e);
        showToast('신고에 실패했어요. 잠시 후 다시 시도해주세요.', { error: true });
        return false;
    }
}

/** 사용자 차단 UI 흐름. 반환: 성공 여부. */
export async function blockUserUI(blockedUid, name, user) {
    const u = await ensureUser(user);
    if (!u) return false;
    if (u.uid === blockedUid) { showToast('본인은 차단할 수 없어요.'); return false; }
    const ok = await confirmDialog(`${name || '이 사용자'} 님을 차단할까요?`,
        '이 사용자의 게시물이 둘러보기에서 숨겨져요.', '차단');
    if (!ok) return false;
    try {
        await blockUser(blockedUid, u);
        track('user_blocked', {});
        showToast('차단했어요. 이 사용자의 글이 숨겨집니다.');
        return true;
    } catch (e) {
        console.error('[moderation] 차단 실패', e);
        showToast('차단에 실패했어요. 잠시 후 다시 시도해주세요.', { error: true });
        return false;
    }
}

/** ⋯ 메뉴: 신고/차단. 반환: 'reported' | 'blocked' | null */
export async function openPostActions({ postId, ownerId, ownerName, user }) {
    const choice = await actionSheet([
        { id: 'report', label: '🚩 신고하기' },
        { id: 'block', label: '🚫 이 사용자 차단', danger: true },
    ]);
    if (choice === 'report') return (await reportPostUI(postId, user)) ? 'reported' : null;
    if (choice === 'block') return (await blockUserUI(ownerId, ownerName, user)) ? 'blocked' : null;
    return null;
}
