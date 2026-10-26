// watch-link.js — 갤럭시 워치(Wear OS) 연결 (docs/wearable.md).
//
// 흐름: 워치 앱이 익명 로그인 후 6자리 코드를 띄운다(watchPairs/{code}).
//   → 사용자가 설정 시트의 "워치 연결"에서 그 코드를 입력하면
//     pair에 ownerUid를 채워 확정하고 watchLinks/{watchUid}를 만든다.
//   → 이후 워치 기록은 이 계정의 recipes에 바로 쌓인다(firestore.rules).
//
// push.js처럼 별도 module 스크립트라 실패해도 로그북의 다른 기능을 막지 않는다.
import {
    auth, db, doc, collection, query, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    serverTimestamp, onAuthStateChanged, track,
} from "./firebase-config.js";
import { loadLang } from "./storage.js";

const PLAY_URL = "https://play.google.com/store/apps/details?id=app.web.note_my_coffee";

const T = {
    ko: { open: "⌚ 워치 연결", title: "⌚ 워치 연결",
          howto: "갤럭시 워치에서 Note My Coffee를 열고 ‘연결’을 누르면 6자리 코드가 나와요. 10분 안에 아래에 입력하세요.",
          code: "연결 코드", link: "연결", linking: "연결 중…", linked: "연결됐어요. 이제 워치 기록이 로그북에 쌓여요.",
          bad: "코드가 틀렸거나 만료됐어요. 워치에서 새 코드를 받아 다시 입력하세요.", err: "연결하지 못했어요. 연결을 확인하고 다시 시도하세요.",
          login: "워치를 연결하려면 먼저 로그인하세요.", list: "연결된 워치", none: "아직 연결된 워치가 없어요.",
          unlink: "해제", unlinkConfirm: "이 워치의 연결을 해제할까요? 워치에서 더 이상 기록이 저장되지 않아요.",
          get: "워치 앱 받기 (Google Play)", since: "연결일" },
    en: { open: "⌚ Connect watch", title: "⌚ Connect watch",
          howto: "Open Note My Coffee on your Galaxy Watch and tap ‘Connect’ to get a 6‑digit code. Enter it below within 10 minutes.",
          code: "Pairing code", link: "Connect", linking: "Connecting…", linked: "Connected. Brews from your watch now land in this logbook.",
          bad: "That code is wrong or expired. Get a new code on your watch and try again.", err: "Couldn't connect. Check your connection and try again.",
          login: "Sign in first to connect a watch.", list: "Connected watches", none: "No watches connected yet.",
          unlink: "Disconnect", unlinkConfirm: "Disconnect this watch? It will stop saving brews to your account.",
          get: "Get the watch app (Google Play)", since: "Since" },
    ja: { open: "⌚ ウォッチ連携", title: "⌚ ウォッチ連携",
          howto: "Galaxy WatchでNote My Coffeeを開き「連携」をタップすると6桁のコードが表示されます。10分以内に下に入力してください。",
          code: "連携コード", link: "連携", linking: "連携中…", linked: "連携しました。ウォッチの記録がこのログブックに保存されます。",
          bad: "コードが違うか期限切れです。ウォッチで新しいコードを表示して再入力してください。", err: "連携できませんでした。接続を確認して再試行してください。",
          login: "ウォッチを連携するには先にログインしてください。", list: "連携中のウォッチ", none: "連携中のウォッチはありません。",
          unlink: "解除", unlinkConfirm: "このウォッチの連携を解除しますか？記録が保存されなくなります。",
          get: "ウォッチアプリを入手 (Google Play)", since: "連携日" },
    zh: { open: "⌚ 連結手錶", title: "⌚ 連結手錶",
          howto: "在 Galaxy Watch 開啟 Note My Coffee 並點「連結」，會顯示 6 位數代碼。請在 10 分鐘內於下方輸入。",
          code: "連結代碼", link: "連結", linking: "連結中…", linked: "已連結。手錶上的紀錄會存進這本日誌。",
          bad: "代碼錯誤或已過期。請在手錶上取得新代碼後再輸入。", err: "無法連結，請確認網路後再試。",
          login: "請先登入再連結手錶。", list: "已連結的手錶", none: "尚未連結任何手錶。",
          unlink: "解除", unlinkConfirm: "要解除這支手錶的連結嗎？之後將不再儲存紀錄。",
          get: "下載手錶 App (Google Play)", since: "連結日" },
};
const tr = () => T[loadLang()] || T.ko;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * 코드 확정 → watchUid 확인 → 링크 생성.
 * 코드 문서는 주인이 정해지기 전엔 워치만 읽을 수 있다(코드 훔쳐보기 방지).
 * 그래서 먼저 ownerUid를 채워 확정하고, 그 뒤에 읽어 watchUid를 얻는다.
 * 중간에 끊겨도 다시 입력하면 '이미 내가 확정한 코드'로 보고 링크만 만든다.
 */
async function pairAndLink(code, user) {
    const pairRef = doc(db, "watchPairs", code);
    let snap = null;
    try { snap = await getDoc(pairRef); } catch (e) { /* 아직 남의 코드 — 정상 */ }
    if (!snap || !snap.exists() || snap.data().ownerUid !== user.uid) {
        await updateDoc(pairRef, {
            ownerUid: user.uid,
            ownerName: (user.displayName || user.email || "").slice(0, 60),
        });
        snap = await getDoc(pairRef);
    }
    await setDoc(doc(db, "watchLinks", snap.data().watchUid), {
        ownerUid: user.uid, code, linkedAt: serverTimestamp(),
    });
}

function closeModal() {
    const el = document.getElementById("watch-link-modal");
    if (el) el.remove();
}

async function loadLinks(uid) {
    const snap = await getDocs(query(collection(db, "watchLinks"), where("ownerUid", "==", uid)));
    const out = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
    return out;
}

function openModal() {
    const t = tr();
    closeModal();
    const user = auth.currentUser;
    const overlay = document.createElement("div");
    overlay.id = "watch-link-modal";
    overlay.className = "recipe-share-overlay";
    overlay.innerHTML = `
        <div class="recipe-share-box compose-box" role="dialog" aria-modal="true" aria-label="${esc(t.title)}">
            <div class="recipe-share-header">
                <span>${esc(t.title)}</span>
                <button class="recipe-share-close" data-close aria-label="close">✕</button>
            </div>
            <div class="compose-scroll watch-link-body">
                ${user ? `
                <p class="watch-link-howto">${esc(t.howto)}</p>
                <form class="watch-link-form" data-form>
                    <label class="compose-label" for="watch-code">${esc(t.code)}</label>
                    <div class="watch-link-row">
                        <input id="watch-code" class="compose-input watch-code-input" type="text"
                               inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"
                               placeholder="000000" required>
                        <button type="submit" class="recipe-share-btn recipe-share-btn--gold" data-submit>${esc(t.link)}</button>
                    </div>
                    <p class="watch-link-status" data-status role="status" aria-live="polite"></p>
                </form>
                <div class="compose-label">${esc(t.list)}</div>
                <ul class="watch-link-list" data-list></ul>
                ` : `<p class="watch-link-howto">${esc(t.login)}</p>`}
                <p class="watch-link-get"><a href="${PLAY_URL}" target="_blank" rel="noopener">${esc(t.get)} →</a></p>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest("[data-close]")) closeModal();
    });
    if (!user) return;

    const form = overlay.querySelector("[data-form]");
    const input = overlay.querySelector("#watch-code");
    const status = overlay.querySelector("[data-status]");
    const submit = overlay.querySelector("[data-submit]");
    const list = overlay.querySelector("[data-list]");
    const setStatus = (msg, isErr) => {
        status.textContent = msg;
        status.classList.toggle("is-error", !!isErr);
    };

    const renderList = async () => {
        let links = [];
        try { links = await loadLinks(user.uid); } catch (e) { console.warn("[watch] 목록 실패", e); }
        if (!links.length) { list.innerHTML = `<li class="watch-link-empty">${esc(t.none)}</li>`; return; }
        list.innerHTML = links.map((l) => {
            const when = l.linkedAt && l.linkedAt.toDate ? l.linkedAt.toDate().toLocaleDateString() : "";
            return `<li class="watch-link-item">
                <span class="watch-link-id">⌚ ${esc(l.id.slice(0, 6).toUpperCase())}</span>
                <span class="watch-link-when">${when ? esc(t.since) + " " + esc(when) : ""}</span>
                <button type="button" class="recipe-share-btn watch-link-unlink" data-unlink="${esc(l.id)}">${esc(t.unlink)}</button>
            </li>`;
        }).join("");
    };
    list.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-unlink]");
        if (!btn || !confirm(t.unlinkConfirm)) return;
        btn.disabled = true;
        try {
            await deleteDoc(doc(db, "watchLinks", btn.getAttribute("data-unlink")));
            track("watch_unlinked", {});
        } catch (err) { console.warn("[watch] 해제 실패", err); setStatus(t.err, true); }
        renderList();
    });

    input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 6); });
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = input.value.trim();
        if (!/^\d{6}$/.test(code)) { setStatus(t.bad, true); return; }
        submit.disabled = true;
        setStatus(t.linking);
        try {
            await pairAndLink(code, user);
            track("watch_linked", {});
            setStatus(t.linked);
            input.value = "";
            renderList();
        } catch (err) {
            console.warn("[watch] 연결 실패", err);
            const code = err && err.code;
            setStatus(code === "permission-denied" || code === "not-found" ? t.bad : t.err, true);
        } finally {
            submit.disabled = false;
        }
    });
    renderList();
    input.focus();
}

function wireButtons() {
    document.querySelectorAll("[data-watch-link]").forEach((btn) => {
        btn.textContent = tr().open;
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const sheet = document.getElementById("settings-sheet");
            if (sheet) sheet.hidden = true;
            openModal();
        });
    });
}

function init() {
    try {
        wireButtons();
        // 언어가 바뀌면 버튼 문구도 따라간다(언어 버튼은 시트를 열어둔 채 동작).
        document.addEventListener("click", (e) => {
            if (e.target.closest(".lang-btn, [data-proxy^='l-']")) {
                setTimeout(() => document.querySelectorAll("[data-watch-link]").forEach((b) => { b.textContent = tr().open; }), 0);
            }
        });
        onAuthStateChanged(auth, () => {
            if (document.getElementById("watch-link-modal")) openModal();
        });
    } catch (e) { console.warn("[watch] init 실패", e); }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
