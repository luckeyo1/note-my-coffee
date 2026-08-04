// Note My Coffee — 로그인 제공자 선택 시트
//
// 구글 하나였을 때는 각 진입점이 그냥 signInWithPopup(auth, googleProvider)를 부르면 됐다.
// 카카오가 붙으면서 "어느 쪽으로 로그인할지"를 먼저 물어야 하고, 그 UI가 앱 헤더·게스트
// 게이트·랜딩 히어로 세 곳에서 똑같이 필요해졌다. 그래서 선택 UI와 로그인 호출, 계측을
// 이 모듈 하나로 모은다. 호출부는 signInWithChooser() 하나만 알면 된다.
//
// 이 모듈이 스타일과 마크업을 스스로 만드는 이유:
// index.html은 style.css를 링크하지 않는다(랜딩은 인라인 스타일로 독립돼 있고
// style.css는 app.html·logbook.html만 쓴다). 시트를 style.css에 넣으면 랜딩에서
// 무스타일로 뜬다. share-card.js와 같은 자체 완결형 + 지연 import 패턴을 따른다.

import {
    auth,
    googleProvider,
    kakaoProvider,
    signInWithPopup,
    getAdditionalUserInfo,
    track,
} from "./firebase-config.js";

// 랜딩 :root 토큰과 같은 값(share-card.js와 동일). 시트는 밝은 앱 화면과 어두운 랜딩
// 양쪽 위에 뜨므로, 어느 쪽에도 묻히지 않도록 자체 팔레트를 고정한다.
const C = {
    scrim: 'rgba(8, 6, 4, 0.72)',
    surface: '#17130F',
    line: 'rgba(200, 169, 110, 0.22)',
    gold: '#C8A96E',
    text: '#EBE5DC',
    sub: '#9B9087',
    danger: '#E5837B',
};

const STYLE_ID = 'nmc-auth-ui-style';
const Z = 2147483000; // 랜딩의 히어로·모달보다 확실히 위

const T = {
    ko: {
        title: '로그인',
        desc: '기록이 계정에 저장되어 휴대폰에서도, 카페 PC에서도 그대로 이어집니다.',
        kakao: '카카오 로그인',
        google: 'Google로 로그인',
        close: '닫기',
        blocked: '브라우저가 로그인 창을 막았어요. 팝업 차단을 해제하고 다시 시도해 주세요.',
        failed: '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
    },
    en: {
        title: 'Sign in',
        desc: 'Your logs are saved to your account, so they follow you from phone to café laptop.',
        kakao: 'Continue with Kakao',
        google: 'Sign in with Google',
        close: 'Close',
        blocked: 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
        failed: 'Sign-in failed. Please try again in a moment.',
    },
};

// 사용자가 스스로 창을 닫은 것은 실패가 아니다 — 실패율 지표가 부풀고,
// 화면에 빨간 에러를 띄우면 그냥 마음이 바뀐 사람에게 사고가 난 것처럼 보인다.
const CANCELLED = new Set([
    'auth/popup-closed-by-user',
    'auth/cancelled-popup-request',
    'auth/user-cancelled',
]);

const KAKAO_SYMBOL = `<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 1C4.03 1 0 4.13 0 8c0 2.5 1.67 4.7 4.18 5.94l-1.06 3.87c-.09.34.29.61.59.42l4.66-3.08c.2.01.41.02.63.02 4.97 0 9-3.13 9-7S13.97 1 9 1z"/></svg>`;

const GOOGLE_SYMBOL = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
.nmc-auth-scrim{position:fixed;inset:0;z-index:${Z};background:${C.scrim};
  display:flex;align-items:center;justify-content:center;padding:20px;
  opacity:0;transition:opacity .18s ease;
  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.nmc-auth-scrim.is-open{opacity:1}
.nmc-auth-sheet{width:100%;max-width:360px;background:${C.surface};color:${C.text};
  border:1px solid ${C.line};border-radius:18px;padding:26px 22px 20px;
  box-shadow:0 24px 60px rgba(0,0,0,.5);
  font-family:'Pretendard','Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  transform:translateY(10px);transition:transform .18s ease;outline:none}
.nmc-auth-scrim.is-open .nmc-auth-sheet{transform:translateY(0)}
.nmc-auth-title{margin:0 0 8px;font-size:19px;font-weight:700;letter-spacing:-.01em;color:${C.text}}
.nmc-auth-desc{margin:0 0 20px;font-size:13.5px;line-height:1.6;color:${C.sub}}
.nmc-auth-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;
  box-sizing:border-box;padding:13px 16px;margin-bottom:9px;border-radius:11px;
  font-size:14.5px;font-weight:600;cursor:pointer;border:1px solid transparent;
  font-family:inherit;line-height:1.2;transition:filter .15s ease,transform .08s ease}
.nmc-auth-btn:hover{filter:brightness(.96)}
.nmc-auth-btn:active{transform:scale(.99)}
.nmc-auth-btn:focus-visible{outline:2px solid ${C.gold};outline-offset:2px}
.nmc-auth-btn[disabled]{opacity:.55;cursor:default;filter:none;transform:none}
/* 카카오 디자인 가이드: 배경 #FEE500, 심볼·텍스트는 검정 85% */
.nmc-auth-btn--kakao{background:#FEE500;color:rgba(0,0,0,.85)}
.nmc-auth-btn--google{background:#FFFFFF;color:#1F1F1F;border-color:#DADCE0}
.nmc-auth-err{margin:2px 0 10px;font-size:12.5px;line-height:1.5;color:${C.danger};min-height:0}
.nmc-auth-close{display:block;width:100%;margin-top:4px;padding:9px;background:none;border:0;
  color:${C.sub};font-size:12.5px;cursor:pointer;font-family:inherit}
.nmc-auth-close:hover{color:${C.text}}
.nmc-auth-close:focus-visible{outline:2px solid ${C.gold};outline-offset:2px;border-radius:6px}
@media (prefers-reduced-motion:reduce){
  .nmc-auth-scrim,.nmc-auth-sheet{transition:none}
}`;
    document.head.appendChild(s);
}

let openSheet = null; // 동시에 두 개가 뜨는 것을 막는다

/**
 * 제공자 선택 시트를 띄우고, 사용자가 고른 제공자로 로그인한다.
 *
 * @param {Object} [opts]
 * @param {string} [opts.source] GA4 이벤트의 source 값 (예: 'app_header', 'guest_gate', 'hero')
 * @param {'ko'|'en'} [opts.lang] 시트 문구 언어
 * @param {string} [opts.desc] 설명 문구 교체. 게스트 게이트처럼 "왜 지금 로그인을
 *   요구하는지"를 밝혀야 하는 자리에서 쓴다 — 이유 없이 뜨는 로그인 창은 이탈을 만든다.
 * @param {(code: string) => void} [opts.onFailure] 사용자 취소가 아닌 **진짜 실패**에만
 *   불린다(팝업 차단, 제공자 장애 등). 랜딩처럼 "인증이 죽어도 방문자를 가둬두면 안 되는"
 *   자리에서 게스트 진입 같은 우회로를 열어주기 위한 훅이다. 시트는 열린 채로 남으므로
 *   핸들러가 아무것도 하지 않으면 사용자는 그대로 재시도할 수 있다.
 * @returns {Promise<import('firebase/auth').User|null>}
 *   로그인 성공 시 User, 사용자가 닫았거나 로그인에 실패하면 null.
 *   호출부는 null을 "그냥 로그인 안 함"으로 다루면 된다 — 실패 안내는 시트가 직접 한다.
 */
export function signInWithChooser(opts = {}) {
    const source = opts.source || 'unknown';
    const t = T[opts.lang === 'en' ? 'en' : 'ko'];

    // 이미 로그인돼 있으면 물어볼 게 없다.
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    // 시트가 이미 떠 있으면 새로 열지 않는다(더블클릭·중복 트리거 방어).
    if (openSheet) return Promise.resolve(null);

    injectStyle();

    return new Promise((resolve) => {
        const prevFocus = document.activeElement;

        const scrim = document.createElement('div');
        scrim.className = 'nmc-auth-scrim';
        scrim.setAttribute('role', 'dialog');
        scrim.setAttribute('aria-modal', 'true');
        scrim.setAttribute('aria-label', t.title);

        const sheet = document.createElement('div');
        sheet.className = 'nmc-auth-sheet';
        // 열릴 때 포커스를 카드 자체로 옮긴다(버튼이 아니라).
        // 버튼에 focus()를 걸면 마우스로 연 사용자에게도 포커스 링이 그려져서
        // 두 제공자 중 하나가 이미 선택된 것처럼 보인다. 카드에 두면 스크린리더는
        // 다이얼로그를 정상적으로 읽고, 키보드 사용자는 Tab 한 번으로 버튼에 닿는다.
        sheet.tabIndex = -1;

        const h = document.createElement('h2');
        h.className = 'nmc-auth-title';
        h.textContent = t.title;

        const p = document.createElement('p');
        p.className = 'nmc-auth-desc';
        p.textContent = opts.desc || t.desc;

        const err = document.createElement('p');
        err.className = 'nmc-auth-err';
        err.hidden = true;
        err.setAttribute('role', 'alert');

        const btnKakao = document.createElement('button');
        btnKakao.type = 'button';
        btnKakao.className = 'nmc-auth-btn nmc-auth-btn--kakao';
        btnKakao.innerHTML = `${KAKAO_SYMBOL}<span></span>`;
        btnKakao.querySelector('span').textContent = t.kakao;

        const btnGoogle = document.createElement('button');
        btnGoogle.type = 'button';
        btnGoogle.className = 'nmc-auth-btn nmc-auth-btn--google';
        btnGoogle.innerHTML = `${GOOGLE_SYMBOL}<span></span>`;
        btnGoogle.querySelector('span').textContent = t.google;

        const btnClose = document.createElement('button');
        btnClose.type = 'button';
        btnClose.className = 'nmc-auth-close';
        btnClose.textContent = t.close;

        sheet.append(h, p, btnKakao, btnGoogle, err, btnClose);
        scrim.appendChild(sheet);
        document.body.appendChild(scrim);
        openSheet = scrim;

        // 트랜지션이 걸리도록 다음 프레임에 클래스를 준다.
        requestAnimationFrame(() => scrim.classList.add('is-open'));
        sheet.focus();

        let settled = false;
        let busy = false;

        const cleanup = () => {
            document.removeEventListener('keydown', onKeydown, true);
            scrim.remove();
            openSheet = null;
            // 로그인 팝업으로 포커스가 떠난 뒤라 복원이 실패할 수 있다 — 조용히 넘긴다.
            try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) { /* ignore */ }
        };

        const finish = (user) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(user);
        };

        const showError = (msg) => {
            err.textContent = msg;
            err.hidden = false;
        };

        const setBusy = (on) => {
            busy = on;
            btnKakao.disabled = on;
            btnGoogle.disabled = on;
        };

        const pick = async (providerId, provider) => {
            if (busy) return;
            err.hidden = true;
            setBusy(true);
            try {
                const cred = await signInWithPopup(auth, provider);
                // 첫 계정 생성과 재로그인을 나눠 센다 — 활성화 퍼널의 분모는
                // '신규 가입'이지 '로그인 전체'가 아니다(docs/funnel.md).
                const isNew = getAdditionalUserInfo(cred)?.isNewUser;
                track(isNew ? 'sign_up' : 'login', { source, provider: providerId });
                finish(cred.user);
            } catch (error) {
                console.error('Login failed', error);
                const code = (error && error.code) || 'unknown';
                if (CANCELLED.has(code)) {
                    // 사용자가 팝업을 닫았다 — 시트는 열어둔 채 다시 고를 수 있게 한다.
                    setBusy(false);
                    return;
                }
                track('login_failed', { source, provider: providerId, code });
                showError(code === 'auth/popup-blocked' ? t.blocked : t.failed);
                setBusy(false);
                if (typeof opts.onFailure === 'function') {
                    try { opts.onFailure(code); } catch (e) { console.error(e); }
                }
            }
        };

        btnKakao.addEventListener('click', () => pick('kakao', kakaoProvider));
        btnGoogle.addEventListener('click', () => pick('google', googleProvider));

        const dismiss = () => { if (!busy) finish(null); };
        btnClose.addEventListener('click', dismiss);
        scrim.addEventListener('click', (e) => { if (e.target === scrim) dismiss(); });

        function onKeydown(e) {
            if (e.key === 'Escape') {
                e.stopPropagation(); // 랜딩·앱의 다른 Esc 핸들러가 같이 반응하지 않게
                dismiss();
                return;
            }
            if (e.key !== 'Tab') return;
            // 포커스를 시트 안에 가둔다.
            const focusables = [btnKakao, btnGoogle, btnClose].filter((b) => !b.disabled);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            // 카드 자체에 포커스가 있는 최초 상태. Tab은 그대로 첫 버튼으로 흐르지만
            // Shift+Tab은 시트 밖으로 나가버리므로 마지막 버튼으로 되돌린다.
            if (document.activeElement === sheet) {
                if (e.shiftKey) {
                    e.preventDefault();
                    last.focus();
                }
                return;
            }
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        document.addEventListener('keydown', onKeydown, true);
    });
}
