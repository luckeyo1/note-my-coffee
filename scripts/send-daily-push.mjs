// scripts/send-daily-push.mjs — 매일 아침 FCM 푸시 발송 (GitHub Actions cron).
//
// Firestore `pushTokens`(옵트인한 사용자 토큰)를 읽어 언어별 아침 리마인더를
// FCM으로 보낸다. 무효(해지)된 토큰은 발송 응답을 보고 정리한다.
//
// 실행: GitHub Actions의 daily-push 워크플로가 firebase-admin을 설치한 뒤 호출.
//   서비스계정 키는 FIREBASE_SERVICE_ACCOUNT 시크릿(JSON 문자열)으로 받는다.
//   시크릿이 아직 없으면 조용히 건너뛴다(=설정 전에는 실패하지 않음).
//
// 로컬 테스트: FIREBASE_SERVICE_ACCOUNT='<키 JSON>' node scripts/send-daily-push.mjs
import admin from "firebase-admin";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw || !raw.trim()) {
  console.log("FIREBASE_SERVICE_ACCOUNT 시크릿이 비어 있습니다 — 설정 전이라 발송을 건너뜁니다.");
  process.exit(0);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
} catch (e) {
  console.error("FIREBASE_SERVICE_ACCOUNT JSON 파싱 실패:", e.message);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const messaging = admin.messaging();

// 언어별 아침 문구. 토큰에 저장된 lang으로 고른다(없으면 ko).
const MSG = {
  ko: { title: "오늘의 커피 ☕", body: "좋은 아침이에요. 오늘 한 잔을 기록해볼까요?" },
  en: { title: "Today's cup ☕", body: "Good morning — log today's brew?" },
  ja: { title: "今日の一杯 ☕", body: "おはようございます。今日も記録しませんか？" },
  zh: { title: "今天的咖啡 ☕", body: "早安，今天也來記錄一杯吧？" },
};
const pick = (lang) => MSG[lang] || MSG.ko;
const LINK = "https://note-my-coffee.web.app/app.html";

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const snap = await db.collection("pushTokens").where("enabled", "==", true).get();
const rows = [];
snap.forEach((d) => {
  const x = d.data() || {};
  if (x.token) rows.push({ token: x.token, lang: x.lang || "ko" });
});

if (rows.length === 0) {
  console.log("보낼 토큰이 없습니다(옵트인 0명).");
  process.exit(0);
}

// 언어별로 묶어 발송(문구가 다름).
const byLang = {};
for (const r of rows) (byLang[r.lang] = byLang[r.lang] || []).push(r.token);

let sent = 0;
let failed = 0;
const toDelete = [];

for (const [lang, tokens] of Object.entries(byLang)) {
  const m = pick(lang);
  for (const batch of chunk(tokens, 500)) {
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      // data-only로 보낸다 — firebase-messaging-sw.js의 onBackgroundMessage가 알림 1건을 그린다.
      data: { title: m.title, body: m.body, url: "/app.html", tag: "nmc-daily" },
      webpush: { headers: { TTL: "43200", Urgency: "normal" }, fcmOptions: { link: LINK } },
    });
    sent += res.successCount;
    failed += res.failureCount;
    res.responses.forEach((rr, i) => {
      if (!rr.success) {
        const code = rr.error && rr.error.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          toDelete.push(batch[i]);
        }
      }
    });
  }
}

// 무효 토큰 정리(문서 ID == 토큰).
for (const batch of chunk(toDelete, 400)) {
  const wb = db.batch();
  batch.forEach((tok) => wb.delete(db.collection("pushTokens").doc(tok)));
  await wb.commit();
}

console.log(`발송 완료 — 성공 ${sent}, 실패 ${failed}, 무효 토큰 정리 ${toDelete.length}`);
process.exit(0);
