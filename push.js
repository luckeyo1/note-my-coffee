// push.js — FCM 웹 푸시 옵트인 (매일 아침 리마인더용).
//
// 흐름: 사용자가 설정 시트의 "알림 받기"를 누르면 → 권한 요청 → FCM 토큰 발급
//   → Firestore `pushTokens/{token}` 에 저장. 매일 아침 발송은 서버(Admin SDK,
//   GitHub Actions cron)나 콘솔 캠페인이 이 토큰들로 보낸다.
//
// Firebase가 차단된 환경(샌드박스)에서는 이 모듈이 조용히 실패해도 페이지의
// 다른 기능을 막지 않는다 — 별도 module 스크립트라 예외가 격리된다.
import { app, auth, db, doc, setDoc, onAuthStateChanged, track } from "./firebase-config.js";
import { loadLang } from "./storage.js";

// VAPID 공개 키 (Firebase 콘솔 > 프로젝트 설정 > 클라우드 메시징 > 웹 푸시 인증서).
// 공개 키라 클라이언트에 그대로 둬도 안전하다.
const VAPID_KEY = "BMgYx9ppzzhk4jhqGxk-HH4TBzIWkwK_stM61mUbWMBJtG6Jeiy_omxO1eV5XmArMjf3l-tFjBcI-EjwgS2UJsQ";
const MSG_SDK = "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

const T = {
    ko: { enable: "🔔 아침 알림 받기", enabled: "🔔 아침 알림 켜짐", blocked: "🔔 알림 차단됨 (브라우저 설정에서 허용)", unsupported: "🔔 이 브라우저는 알림 미지원",
          on: "매일 아침 커피 리마인더를 보내드릴게요 ☕", denied: "알림 권한이 거부됐어요. 브라우저 설정에서 허용할 수 있어요.", err: "알림 설정에 실패했어요. 잠시 후 다시 시도해주세요." },
    en: { enable: "🔔 Morning reminder", enabled: "🔔 Reminder is on", blocked: "🔔 Notifications blocked (allow in settings)", unsupported: "🔔 Notifications not supported here",
          on: "We'll send a morning coffee reminder ☕", denied: "Notification permission was denied. You can allow it in your browser settings.", err: "Couldn't enable notifications. Please try again." },
    ja: { enable: "🔔 朝のリマインダー", enabled: "🔔 リマインダーON", blocked: "🔔 通知がブロック中 (設定で許可)", unsupported: "🔔 このブラウザは通知に非対応",
          on: "毎朝コーヒーのリマインダーを送ります ☕", denied: "通知が拒否されました。ブラウザ設定で許可できます。", err: "通知を有効にできませんでした。もう一度お試しください。" },
    zh: { enable: "🔔 早晨提醒", enabled: "🔔 提醒已開", blocked: "🔔 通知已封鎖 (請在設定允許)", unsupported: "🔔 此瀏覽器不支援通知",
          on: "每天早上提醒你沖杯咖啡 ☕", denied: "通知權限被拒絕，可在瀏覽器設定中允許。", err: "無法開啟通知，請稍後再試。" },
};
const tr = () => T[loadLang()] || T.ko;

let msgMod = null;     // 동적 로드한 firebase-messaging 모듈
let lastToken = null;  // 이번 세션에서 확보한 토큰 (auth 변경 시 uid 갱신용)

function toast(msg, isErr) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.setAttribute("role", "status");
    el.style.cssText =
        "position:fixed;left:50%;bottom:76px;transform:translateX(-50%) translateY(10px);z-index:2147482000;" +
        "max-width:88vw;padding:12px 18px;border-radius:12px;font-size:13.5px;line-height:1.5;font-weight:500;" +
        "font-family:'Pretendard Variable',Pretendard,system-ui,sans-serif;opacity:0;transition:opacity .2s,transform .2s;" +
        "box-shadow:0 10px 30px rgba(0,0,0,.28);color:" + (isErr ? "#fff" : "#20170E") + ";" +
        "background:" + (isErr ? "#A83B2A" : "#C8A96E") + ";";
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)"; });
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 250); }, 3400);
}

async function loadMessaging() {
    if (msgMod) return msgMod;
    msgMod = await import(MSG_SDK);
    return msgMod;
}

// 지원 여부 — 알림/서비스워커 API + FCM isSupported.
async function supported() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    try { const m = await loadMessaging(); return await m.isSupported(); } catch (e) { return false; }
}

async function saveToken(token) {
    lastToken = token;
    const uid = (auth.currentUser && auth.currentUser.uid) || null;
    // 문서 ID = 토큰. merge로 재방문 시 갱신한다. enabled=true는 옵트아웃(끄기) 대비 필드.
    await setDoc(doc(db, "pushTokens", token), {
        token,
        uid,
        lang: loadLang(),
        platform: String(navigator.userAgent || "").slice(0, 280),
        enabled: true,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
}

async function getAndSaveToken() {
    const m = await loadMessaging();
    const messaging = m.getMessaging(app);
    // serviceWorkerRegistration을 넘기지 않으면 FCM이 firebase-messaging-sw.js를
    // 자체 scope('/firebase-cloud-messaging-push-scope')로 자동 등록한다 — sw.js(scope '/')와 공존.
    const token = await m.getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) throw new Error("no-token");
    await saveToken(token);
    wireForeground(messaging);
    return token;
}

function wireForeground(messaging) {
    try {
        msgMod.onMessage(messaging, (payload) => {
            const n = (payload && payload.notification) || (payload && payload.data) || {};
            if (n.title || n.body) toast([n.title, n.body].filter(Boolean).join(" · "));
        });
    } catch (e) { /* 포그라운드 수신은 부가 기능 */ }
}

// 사용자 클릭 → 권한 요청 + 토큰 발급·저장.
async function enablePush() {
    const t = tr();
    if (!(await supported())) { toast(t.unsupported, true); return "unsupported"; }
    let perm;
    try { perm = await Notification.requestPermission(); } catch (e) { perm = Notification.permission; }
    if (perm !== "granted") { toast(t.denied, true); refreshButtons(); return perm; }
    try {
        await getAndSaveToken();
        track("push_enabled", {});
        toast(t.on);
    } catch (e) {
        console.warn("[push] 활성화 실패", e);
        toast(t.err, true);
    }
    refreshButtons();
    return Notification.permission;
}

// 이미 허용한 사용자는 로드 시 토큰을 조용히 갱신한다(토큰 로테이션 대비).
async function refreshIfGranted() {
    try {
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
        if (!(await supported())) return;
        await getAndSaveToken();
    } catch (e) { /* 조용히 무시 */ }
}

function labelFor() {
    const t = tr();
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return t.unsupported;
    if (Notification.permission === "granted") return t.enabled;
    if (Notification.permission === "denied") return t.blocked;
    return t.enable;
}

function refreshButtons() {
    const label = labelFor();
    document.querySelectorAll("[data-push-optin]").forEach((btn) => {
        btn.textContent = label;
        const off = (typeof Notification === "undefined") || Notification.permission === "denied";
        btn.setAttribute("aria-disabled", off ? "true" : "false");
        btn.style.opacity = off ? "0.6" : "";
    });
}

function wireButtons() {
    document.querySelectorAll("[data-push-optin]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            if (Notification.permission === "denied") { toast(tr().blocked, true); return; }
            if (Notification.permission === "granted") { toast(tr().enabled); return; }
            enablePush();
        });
    });
    refreshButtons();
}

function init() {
    try {
        wireButtons();
        refreshIfGranted();
        // 로그인 상태가 바뀌면(허용돼 있고 토큰이 있으면) uid를 토큰에 붙인다.
        onAuthStateChanged(auth, () => {
            if (lastToken && typeof Notification !== "undefined" && Notification.permission === "granted") {
                saveToken(lastToken).catch(() => {});
            }
        });
    } catch (e) { console.warn("[push] init 실패", e); }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
