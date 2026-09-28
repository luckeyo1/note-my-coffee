// share-compose.js — 공개 공유 작성 모달(§5-3).
// 순서: 공개할 추출 조건 확인 → 제목 → 설명 → (사진 포함) → 공개 범위 → 게시.
// 기본 공개 범위는 '나만 보기'. 게시에는 로그인 필요, 취소/오류에도 입력을 보존한다.
import { auth } from "./firebase-config.js";
import { signInWithChooser } from "./auth-ui.js";
import { publishPost } from "./community.js";
import { fmtBrewTime, modeLabel } from "./brew-card.js";
import { brewRatio, VISIBILITY } from "./recipe-share-model.js";

const _esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function removeModal() {
    const el = document.getElementById('compose-modal');
    if (el) el.remove();
}

/**
 * @param {Object} recipe  개인 레시피(추출 조건 원천)
 * @param {Object} [opts]  { onEvent }
 */
export function openComposeModal(recipe, opts = {}) {
    const emit = (name, params) => { try { opts.onEvent?.(name, params); } catch (e) { /* noop */ } };
    removeModal();

    const isEsp = (recipe.mode || 'espresso') !== 'drip';
    const dose = Number(recipe.dosing) || 0;
    const yld = Number(recipe.yield) || 0;
    const ratio = brewRatio(dose, yld).text;
    const timeStr = fmtBrewTime(recipe);
    const yieldLabel = isEsp ? '추출량' : '투입 물량';
    const hasPhoto = !!recipe.imageUrl;

    const overlay = document.createElement('div');
    overlay.id = 'compose-modal';
    overlay.className = 'recipe-share-overlay';
    overlay.innerHTML = `
        <div class="recipe-share-box compose-box">
            <div class="recipe-share-header">
                <span>🌍 커뮤니티에 공개</span>
                <button class="recipe-share-close" data-close>✕</button>
            </div>
            <div class="compose-scroll">
                <div class="compose-summary">
                    <span class="compose-summary-mode">${_esc(modeLabel(recipe.mode))}</span>
                    <div class="compose-summary-nums">
                        <span><b>${_esc(dose.toFixed(1))}</b>g</span>
                        <span><b>${_esc(Number(recipe.temp) || 0)}</b>°C</span>
                        <span><b>${_esc(timeStr)}</b></span>
                        <span><b>${_esc(yld.toFixed(1))}</b>g <i>${_esc(yieldLabel)}</i></span>
                        <span class="compose-ratio">${_esc(ratio)}</span>
                    </div>
                </div>

                <label class="compose-label" for="compose-title">공개 제목</label>
                <input id="compose-title" class="compose-input" type="text" maxlength="120"
                       placeholder="예: 예가체프의 산뜻한 단맛" value="${_esc(recipe.beanName || '')}">

                <label class="compose-label" for="compose-desc">공개 설명 <span class="compose-optional">(선택)</span></label>
                <textarea id="compose-desc" class="compose-input compose-textarea" maxlength="500"
                          placeholder="어떤 맛을 목표로 했는지, 팁이 있다면 적어주세요. 개인 메모는 자동으로 들어가지 않아요."></textarea>

                <details class="compose-details">
                    <summary>도구 정보 추가 <span class="compose-optional">(선택)</span></summary>
                    <input id="compose-roaster" class="compose-input" type="text" maxlength="60" placeholder="로스터리">
                    <input id="compose-gear" class="compose-input" type="text" maxlength="60" placeholder="추출 도구 (예: 가찌아 클래식)">
                    <input id="compose-grinder" class="compose-input" type="text" maxlength="60" placeholder="그라인더">
                    <input id="compose-grind" class="compose-input" type="text" maxlength="40" placeholder="분쇄도 (예: 12클릭)">
                </details>

                ${hasPhoto ? `
                <label class="compose-check">
                    <input type="checkbox" id="compose-photo"> 이 기록의 사진을 함께 공개
                </label>` : ''}

                <div class="compose-vis">
                    <p class="compose-label">공개 범위</p>
                    <label class="compose-radio"><input type="radio" name="vis" value="private" checked>
                        <span><b>나만 보기</b><small>나만 볼 수 있어요(기본값).</small></span></label>
                    <label class="compose-radio"><input type="radio" name="vis" value="unlisted">
                        <span><b>링크로 공유</b><small>링크를 받은 사람은 누구나 볼 수 있어요. 발견 피드엔 안 나와요.</small></span></label>
                    <label class="compose-radio"><input type="radio" name="vis" value="public">
                        <span><b>전체 공개</b><small>발견 피드와 공개 프로필에 올라가요.</small></span></label>
                </div>

                <p class="compose-error" id="compose-error" hidden></p>
                <div class="compose-result" id="compose-result" hidden></div>
            </div>
            <div class="recipe-share-actions">
                <button class="recipe-share-btn recipe-share-btn--gold" id="compose-publish" style="flex:1;">게시하기</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    emit('share_compose_open', {});

    const err = overlay.querySelector('#compose-error');
    const publishBtn = overlay.querySelector('#compose-publish');

    const showError = (m) => { err.textContent = m; err.hidden = false; };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.dataset.close !== undefined) removeModal();
    });

    publishBtn.addEventListener('click', async () => {
        err.hidden = true;
        const title = overlay.querySelector('#compose-title').value.trim();
        if (!title) { showError('공개 제목을 입력해주세요.'); return; }
        const visibility = (overlay.querySelector('input[name="vis"]:checked') || {}).value || 'private';
        const includePhoto = hasPhoto && overlay.querySelector('#compose-photo')?.checked;

        const pub = {
            title,
            description: overlay.querySelector('#compose-desc').value.trim(),
            method: recipe.mode || 'espresso',
            visibility,
            bean: recipe.beanName || '',
            roaster: overlay.querySelector('#compose-roaster')?.value.trim() || '',
            gear: overlay.querySelector('#compose-gear')?.value.trim() || '',
            grinder: overlay.querySelector('#compose-grinder')?.value.trim() || '',
            grindSetting: overlay.querySelector('#compose-grind')?.value.trim() || '',
            includePhoto: !!includePhoto,
            photoUrl: includePhoto ? recipe.imageUrl : '',
        };

        publishBtn.disabled = true;
        publishBtn.textContent = '게시하는 중…';
        try {
            let user = auth.currentUser;
            if (!user) {
                // 로그인 필요. 취소/오류여도 위에서 입력한 내용은 그대로 남는다.
                user = await signInWithChooser({
                    source: 'share_compose', lang: 'ko',
                    desc: '레시피를 공개하려면 로그인이 필요해요.',
                });
                if (!user) { publishBtn.disabled = false; publishBtn.textContent = '게시하기'; return; }
            }
            const res = await publishPost({ recipe, pub, user });
            emit('share_published', { visibility: res.visibility });
            showResult(res);
        } catch (e2) {
            console.error('[compose] 게시 실패', e2);
            publishBtn.disabled = false;
            publishBtn.textContent = '게시하기';
            showError('게시에 실패했어요. 잠시 후 다시 시도해주세요.');
        }
    });

    function showResult(res) {
        const box = overlay.querySelector('#compose-result');
        const base = new URL('post.html', location.href).href;
        let link = `${base}?id=${encodeURIComponent(res.postId)}`;
        if (res.visibility === 'unlisted' && res.shareToken) link += '&t=' + encodeURIComponent(res.shareToken);

        let body;
        if (res.visibility === 'private') {
            body = `<p class="compose-result-msg">✓ 저장했어요 <b>(나만 보기)</b>. 언제든 공개 범위를 바꿀 수 있어요.</p>`;
        } else if (res.visibility === 'unlisted') {
            body = `<p class="compose-result-msg">✓ 링크로 공유 준비됐어요. 이 링크를 받은 사람은 볼 수 있어요.</p>
                    <div class="compose-linkrow"><input class="compose-input" id="compose-link" readonly value="${_esc(link)}"><button class="recipe-share-btn" id="compose-copy">복사</button></div>`;
        } else {
            body = `<p class="compose-result-msg">✓ 전체 공개했어요. 발견 피드에 올라갑니다.</p>
                    <div class="compose-linkrow"><a class="recipe-share-btn recipe-share-btn--gold" href="${_esc(link)}" style="flex:1;">공개된 레시피 보기</a></div>`;
        }
        box.innerHTML = body;
        box.hidden = false;
        publishBtn.textContent = '완료';
        publishBtn.disabled = false;
        publishBtn.onclick = removeModal;

        const copyBtn = overlay.querySelector('#compose-copy');
        if (copyBtn) copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(link).then(() => { copyBtn.textContent = '✓ 복사됨'; })
                .catch(() => { const i = overlay.querySelector('#compose-link'); if (i) { i.select(); } });
        });
    }
}
