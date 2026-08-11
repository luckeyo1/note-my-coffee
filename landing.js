import {
    auth,
    db,
    onAuthStateChanged,
    doc,
    getDoc,
    setDoc,
    track
} from "./firebase-config.js";
// auth-ui의 signInWithChooser는 더 이상 랜딩에서 쓰지 않는다 — 주 CTA가 로그인
// 시트 없이 앱으로 직행하도록 바뀌었다. 로그인은 앱 헤더와 게스트 게이트가 담당한다.

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

// 취향 검사 결과의 이메일 옵트인(리드마그넷)이 부르는 전역. 인라인 클래식
// 스크립트는 모듈 import를 못 쓰므로 track과 같은 방식으로 하나 걸어둔다.
// 리드는 leads 컬렉션에 쌓이고(규칙상 누구나 생성, 관리자만 읽음), 이메일을
// 해시한 값을 문서 ID로 삼아 같은 사람이 다시 남겨도 중복 문서가 생기지 않는다.
window.nmcSaveLead = async (lead) => {
    const email = String((lead && lead.email) || '').trim().toLowerCase();
    // 서버 규칙에서도 검증하지만, 헛된 쓰기를 줄이려 클라이언트에서 먼저 막는다.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) {
        throw new Error('invalid-email');
    }
    // FNV-1a — 원두 ID(beanDocId)와 같은 방식. 이메일을 그대로 ID로 쓰면
    // 금지 문자·길이 문제가 있어 짧고 안정적인 해시로 바꾼다.
    let h = 0x811c9dc5;
    for (let i = 0; i < email.length; i++) {
        h ^= email.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    await setDoc(doc(db, 'leads', 'l' + h.toString(36)), {
        email,
        source: (lead && lead.source) || 'unknown',
        profile: (lead && lead.profile) || '',
        profileTitle: (lead && lead.profileTitle) || '',
        createdAt: new Date().toISOString(),
        path: location.pathname,
    }, { merge: true });
};

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

    // 비로그인 라벨이 동작과 일치해야 한다. 예전엔 "지금 무료로 기록 시작하기"였는데
    // 정작 누르면 로그인 시트가 떴고, 버튼 바로 아래엔 "로그인 없이 첫 기록"이라고
    // 적혀 있었다 — 페이지와 버튼이 서로 다른 말을 했다. 사용자 제보로 확인된 혼란이다.
    onAuthStateChanged(auth, (user) => {
        updateCtaText(user ? '콘솔로 이동하기' : '로그인 없이 바로 기록해보기');
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
            // 로그인 여부와 무관하게 앱으로 바로 보낸다.
            //
            // 예전에는 비로그인 방문자에게 로그인 시트를 먼저 띄웠다. 그런데 이 버튼
            // 바로 아래 신뢰 문구가 "로그인 없이 첫 기록"이라, 페이지는 로그인이
            // 필요 없다고 말하면서 주 버튼은 로그인을 요구하는 모순이었다.
            // 앱은 첫 레시피 1개를 실제로 로그인 없이 저장하므로(게스트 게이트)
            // 약속을 지킬 수 있는데 랜딩이 그 경로를 막고 있었다.
            //
            // 로그인 경로가 사라지는 게 아니다 — 앱 헤더와 게스트 게이트(첫 기록 후)
            // 두 곳에 그대로 있다. 가입 발생 지점이 랜딩에서 게이트로 옮겨갈 뿐이고,
            // 그 구간은 guest_gate_* 이벤트로 이미 계측돼 있다(docs/funnel.md).
            window.location.href = 'app.html';
        });
    }
});
