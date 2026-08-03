// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
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

// ── GA4 이벤트 ────────────────────────────────────────────────────────────
// 분석은 부가 기능이다. 애드블로커·쿠키 차단·비보안 컨텍스트에서 실패하는 게
// 정상이라, 그 실패가 전환 동선(구글 로그인, 취향 검사)까지 끌고 내려가면 안 된다.
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

export {
    track,
    auth, 
    db, 
    googleProvider,
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
