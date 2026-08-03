import {
    auth,
    db,
    googleProvider,
    signInWithPopup,
    getAdditionalUserInfo,
    onAuthStateChanged,
    doc,
    getDoc,
    track
} from "./firebase-config.js";

// 사회적 증거로 노출할 최소 기준. 숫자가 이보다 작으면 오히려 역효과라 아예 감춘다.
const MIN_STAT_TO_SHOW = 100;

// 인라인 <script>(데모 플레이어·취향 검사)와 pay.js는 클래식 스크립트라 import를
// 못 쓴다. 이들이 이벤트를 보낼 수 있도록 track을 전역에 하나 걸어둔다.
//
// 이 모듈은 파싱이 끝난 뒤에야 실행되므로, 그 전에 발생한 이벤트는 index.html
// <head>의 큐 스텁이 모아둔다. 실제 track으로 교체하면서 쌓인 걸 비운다.
// 비운 뒤 큐를 null로 두면 이후 호출은 큐를 우회해 바로 전송된다.
//
// flush된 이벤트는 발생 시각이 아니라 지금 시각으로 전송된다 — 퍼널 집계에는
// 무해하지만 초 단위 타이밍 분석에는 영향이 있다.
const queuedEvents = Array.isArray(window.nmcTrackQueue) ? window.nmcTrackQueue : [];
window.nmcTrack = track;
window.nmcTrackQueue = null;
queuedEvents.forEach(([name, params]) => track(name, params));

document.addEventListener('DOMContentLoaded', () => {

    // 랜딩은 지금까지 로드 시 track()을 부르지 않아, CTA·퀴즈·데모를 건드리지 않고
    // 이탈한 방문자는 getAnalytics()가 초기화되지 않아 자동 page_view조차 없었다
    // (firebase-config.js). 그래서 퍼널 최상단(랜딩 방문 수) 분모가 실제보다 작게
    // 잡혔다. 로드 즉시 한 번 보내 계측을 켠다 — app.html의 app_page_view와 대칭.
    track('landing_view');

    // ====== Auth & Navigation (Three.js와 독립적으로 실행) ======
    const updateCtaText = (text) => {
        const span = document.querySelector('#btn-get-started span:first-child');
        if (span) span.textContent = text;
    };

    onAuthStateChanged(auth, (user) => {
        updateCtaText(user ? '콘솔로 이동하기' : '지금 무료로 기록 시작하기');
    });

    // ====== 사회적 증거: 누적 기록 수 ======
    // 관리자 대시보드가 갱신해두는 공개 집계 문서 하나만 읽는다.
    // 값이 없거나 실패하면 요소를 숨긴 채로 둔다 — 0이나 자리표시 숫자를 절대 보여주지 않는다.
    (async () => {
        const elStat = document.getElementById('hero-stat');
        if (!elStat) return;
        try {
            const snap = await getDoc(doc(db, 'public_stats', 'landing'));
            if (!snap.exists()) return;
            const n = snap.data().recipeCount;
            if (typeof n !== 'number' || !Number.isFinite(n) || n < MIN_STAT_TO_SHOW) return;
            elStat.textContent = `지금까지 기록된 추출 ${n.toLocaleString('ko-KR')}회`;
            elStat.hidden = false;
        } catch (e) {
            console.warn('[Landing] 누적 기록 수를 불러오지 못했습니다.', e);
        }
    })();

    const btnGetStarted = document.getElementById('btn-get-started');
    if (btnGetStarted) {
        btnGetStarted.addEventListener('click', async (e) => {
            // 다른 CTA들은 이 버튼의 .click()으로 프록시된다(인라인 스크립트).
            // 스크립트가 만든 클릭은 isTrusted가 false라, 이 조건 하나로 히어로에서
            // 직접 누른 경우만 골라낸다 — 없으면 nav/final 클릭이 hero로 이중 집계된다.
            if (e.isTrusted) {
                track('cta_click', { location: 'hero', signed_in: !!auth.currentUser });
            }
            if (auth.currentUser) {
                window.location.href = 'app.html';
                return;
            }
            try {
                const result = await signInWithPopup(auth, googleProvider);
                // 첫 계정 생성과 재로그인을 나눠 센다 — 활성화 퍼널의 분모는
                // '신규 가입'이지 '로그인 전체'가 아니다.
                const isNew = getAdditionalUserInfo(result)?.isNewUser;
                track(isNew ? 'sign_up' : 'login', { source: 'landing' });
                window.location.href = 'app.html';
            } catch (error) {
                console.error("Login failed", error);
                // 팝업을 사용자가 직접 닫은 경우를 제외하고 게스트로 진입
                if (error.code !== 'auth/popup-closed-by-user') {
                    window.location.href = 'app.html';
                }
            }
        });
    }
});
