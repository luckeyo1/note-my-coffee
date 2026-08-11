// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    deleteDoc,
    updateDoc,
    getDoc,
    setDoc,
    // 집계용 — 저장 시점에 카운터를 올리고(increment), 대시보드는 원본 대신
    // 그 집계를 읽는다. 최근 기록만 orderBy+limit로 따로 가져온다.
    // (docs/admin-roadmap.md Phase 1)
    increment,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Firebase Configuration
 * 
 * TO GET YOUR CONFIG:
 * 1. Go to Firebase Console (https://console.firebase.google.com/)
 * 2. Select your project.
 * 3. Click the Gear icon (Project settings) > General.
 * 4. Scroll down to 'Your apps' and find the 'Firebase SDK snippet' for Config.
 * 5. Copy and paste the firebaseConfig object below.
 */
const firebaseConfig = {
    apiKey: "AIzaSyB8B6CDTnycxxCWey1p-0WV3cRRbGa_cj0",
    authDomain: "note-my-coffee.firebaseapp.com",
    databaseURL: "https://note-my-coffee-default-rtdb.firebaseio.com",
    projectId: "note-my-coffee",
    storageBucket: "note-my-coffee.firebasestorage.app",
    messagingSenderId: "755801853184",
    appId: "1:755801853184:web:fed55e6029b3f8c23eb7e5",
    measurementId: "G-Q0HWKB2MBP"
};
    
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// IndexedDB 영속 캐시. 이게 없으면 로그인 사용자가 오프라인에서 저장할 때
// addDoc 프로미스가 서버 확인을 기다리며 영구 대기하고(reject도 안 한다),
// 탭을 닫으면 그 쓰기가 조용히 사라진다. 영속 캐시가 있으면 쓰기가 큐에 남아
// 재연결 시 전송된다. persistentMultipleTabManager로 여러 탭도 허용한다.
// 사파리 프라이빗 모드 등 IndexedDB를 못 쓰는 환경에서는 던지므로,
// 그때는 메모리 캐시로 떨어진다 — 오프라인 큐는 없지만 앱은 정상 동작한다.
let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
} catch (e) {
    console.warn('[Firestore] 영속 캐시를 사용할 수 없습니다. 메모리 캐시로 계속합니다.', e);
    db = getFirestore(app);
}
const googleProvider = new GoogleAuthProvider();

// 카카오는 Firebase 기본 제공자가 아니라 OIDC 커스텀 제공자로 붙는다.
// 'oidc.kakao'의 'kakao'는 Firebase 콘솔에서 만든 제공업체 이름과 반드시 같아야 한다
// (Authentication > Sign-in method > OpenID Connect). 다르면 auth/operation-not-allowed로 죽는다.
//
// 콘솔 설정은 카카오 OIDC 스펙에 맞춰 다음이어야 한다:
//   - 부여 유형: 코드 흐름 — 카카오는 response_types에 code만 지원한다
//   - 클라이언트 보안 비밀번호: 필수 (카카오 개발자 콘솔 > 보안에서 Client Secret을 '사용함'으로)
//   - 발급기관 URL: https://kauth.kakao.com
// 또 카카오 쪽에서 'OpenID Connect 활성화'가 기본 OFF라 켜두지 않으면 id_token이 오지 않는다.
const kakaoProvider = new OAuthProvider('oidc.kakao');
// 이메일은 요청하지 않는다. 카카오에서 이메일을 받으려면 비즈니스 앱 전환(사업자 등록)이
// 필요하고, 받는 순간 같은 주소의 구글 계정과 충돌해 account-exists-with-different-credential이
// 발생한다. 헤더에 쓰는 닉네임·프로필 사진은 기본 동의항목으로 충분하다.
kakaoProvider.addScope('openid');
kakaoProvider.addScope('profile_nickname');
kakaoProvider.addScope('profile_image');

// ── GA4 이벤트 ────────────────────────────────────────────────────────────
// 분석은 부가 기능이다. 애드블로커·쿠키 차단·비보안 컨텍스트에서 실패하는 게
// 정상이라, 그 실패가 전환 동선(로그인, 취향 검사)까지 끌고 내려가면 안 된다.
// 그래서 (1) analytics 번들은 정적 import가 아니라 동적 import로 받고
// — 차단당해도 이 모듈 전체가 죽지 않는다 —
// (2) 초기화와 전송을 모두 삼켜서 track()은 절대 throw하지 않는다.
let analyticsReady = null;

function loadAnalytics() {
    if (!analyticsReady) {
        analyticsReady = (async () => {
            const mod = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js");
            if (!(await mod.isSupported())) return null;
            return { instance: mod.getAnalytics(app), logEvent: mod.logEvent };
        })().catch((e) => {
            console.warn('[Analytics] 사용할 수 없습니다. 이벤트 없이 계속합니다.', e);
            return null;
        });
    }
    return analyticsReady;
}

/**
 * GA4 이벤트를 보낸다. 실패해도 조용히 무시된다 — 호출부에서 await하거나
 * catch할 필요가 없다.
 * @param {string} name 이벤트 이름 (snake_case)
 * @param {Object} [params] 이벤트 파라미터
 */
function track(name, params) {
    loadAnalytics()
        .then((a) => { if (a) a.logEvent(a.instance, name, params || {}); })
        .catch(() => {});
}

// ── 방문 집계 ──────────────────────────────────────────────────────────────
// GA4에는 방문 데이터가 있지만 관리자 대시보드(Firestore만 읽는다)에서는 볼 수
// 없었다. 그래서 방문 수를 아주 가벼운 카운터로 Firestore에도 남긴다.
//
// 개인을 식별하지 않는다 — 익명 카운터일 뿐이고, 누가 왔는지는 저장하지 않는다.
// (비로그인 방문자의 신원은 원래 알 수 없고, 알려고 해서도 안 된다)
//
// 매 페이지 로드마다 쓰면 쓰기 비용이 방문 수만큼 늘어난다. 그래서 두 플래그로
// 줄인다: 세션당 1회(sessions), 브라우저·하루당 1회(visitors).
// visitors는 '순 방문자'의 근사치다 — 시크릿 모드·캐시 삭제·다른 기기는 새로 센다.
const VISIT_SESSION_KEY = 'nmcVisitSession';
const VISIT_DAY_KEY = 'nmcVisitDay';

const visitDayKey = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// 스토리지는 시크릿 모드·차단 설정에서 던질 수 있다. 실패하면 '이미 셌다'로
// 취급해 쓰기를 건너뛴다 — 계측 때문에 페이지가 느려지거나 깨지면 안 된다.
const readFlag = (store, key) => {
    try { return window[store].getItem(key); } catch (e) { return '__blocked__'; }
};
const writeFlag = (store, key, value) => {
    try { window[store].setItem(key, value); } catch (e) { /* 무시 */ }
};

/**
 * 사이트 방문을 집계한다. 실패해도 조용히 무시된다 — await하거나 catch할 필요가 없다.
 * @param {string} page 방문한 화면 ('landing' | 'app' 등). 화면별 분해에 쓴다.
 */
function bumpVisit(page) {
    try {
        const today = visitDayKey();
        const newSession = readFlag('sessionStorage', VISIT_SESSION_KEY) === null;
        const newVisitor = readFlag('localStorage', VISIT_DAY_KEY) !== today;
        if (!newSession && !newVisitor) return;   // 오늘 이미 센 브라우저

        const patch = { updatedAt: new Date().toISOString() };
        if (newSession) {
            patch.sessions = increment(1);
            // 화면별 세션 — 랜딩만 보고 나간 사람과 앱까지 들어온 사람을 구분한다.
            patch['p_' + (page || 'unknown')] = increment(1);
        }
        if (newVisitor) patch.visitors = increment(1);

        setDoc(doc(db, 'stats_visits', today), patch, { merge: true })
            .then(() => {
                // 쓰기가 성공한 뒤에 플래그를 세운다 — 규칙 거부·오프라인일 때
                // 플래그만 남아 영영 집계되지 않는 상태를 막는다.
                if (newSession) writeFlag('sessionStorage', VISIT_SESSION_KEY, '1');
                if (newVisitor) writeFlag('localStorage', VISIT_DAY_KEY, today);
            })
            .catch((e) => console.warn('[Visits] 방문 집계 실패 (기능에는 영향 없음)', e));
    } catch (e) {
        console.warn('[Visits] 방문 집계 실패 (기능에는 영향 없음)', e);
    }
}

export {
    track,
    bumpVisit,
    auth,
    db,
    googleProvider,
    kakaoProvider,
    signInWithPopup,
    getAdditionalUserInfo,
    signOut,
    onAuthStateChanged,
    collection,
    addDoc, 
    getDocs, 
    query, 
    where, 
    doc,
    deleteDoc,
    updateDoc,
    getDoc,
    setDoc,
    increment,
    orderBy,
    limit
};
