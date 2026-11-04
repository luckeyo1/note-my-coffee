// functions/index.js — 매일 아침 정시 FCM 발송 (Cloud Scheduler 기반 예약 함수).
//
// GitHub Actions cron은 best-effort라 몇 시간씩 밀렸지만(10시쯤 발송됨),
// Firebase 예약 함수는 Google Cloud Scheduler가 구동해 **정확히 07:30 KST**에 발사된다.
//
// 런타임에서 firebase-admin이 기본 서비스 계정으로 초기화되므로 키 파일이 필요 없다
// (같은 프로젝트의 Firestore 읽기 + FCM 발송 권한을 런타임 SA가 가진다).
// 토큰 저장은 클라이언트(push.js)가 Firestore pushTokens에 하고, 여기서 읽어 보낸다.
//
// 배포 참고: 2세대(Cloud Run) 함수라 배포 SA에 Editor + Cloud Run 관리자 +
// 서비스 계정 사용자 권한이 필요하다(invoker IAM 설정 때문). (deploy marker: 1)
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { buildShareHtml } = require("./share-og");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// 언어별 아침 문구 (토큰에 저장된 lang으로 고른다).
const MSG = {
  ko: { title: "오늘의 커피 ☕", body: "좋은 아침이에요. 오늘 한 잔을 기록해볼까요?" },
  en: { title: "Today's cup ☕", body: "Good morning — log today's brew?" },
  ja: { title: "今日の一杯 ☕", body: "おはようございます。今日も記録しませんか？" },
  zh: { title: "今天的咖啡 ☕", body: "早安，今天也來記錄一杯吧？" },
};
const pick = (lang) => MSG[lang] || MSG.ko;
const LINK = "https://note-my-coffee.web.app/app.html";
const chunk = (a, n) => {
  const o = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
};

exports.dailyPush = onSchedule(
  { schedule: "30 7 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const snap = await db.collection("pushTokens").where("enabled", "==", true).get();
    const rows = [];
    snap.forEach((d) => {
      const x = d.data() || {};
      if (x.token) rows.push({ token: x.token, lang: x.lang || "ko" });
    });
    if (rows.length === 0) {
      logger.info("보낼 토큰 없음(옵트인 0명)");
      return;
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

    logger.info(`발송 완료 — 성공 ${sent}, 실패 ${failed}, 무효 정리 ${toDelete.length}`);
  }
);

// ── 공유 레시피 OG 미리보기 (firebase.json hosting rewrite: /s → shareOg) ──
// 레시피 공유 링크(/s?share=<base64>)에 레시피별 OG 카드를 입힌다. 상태 없음:
// URL의 base64만 디코드하므로 Firestore·인증이 필요 없다(share-og.js 참고).
// 스크래퍼는 head의 OG를 읽고, 사람은 import가 동작하는 /logbook?share= 로 리다이렉트.
// invoker: "public" — hosting rewrite가 미인증 호출로 함수를 부르므로 allUsers 필요.
exports.shareOg = onRequest(
  {
    region: "asia-northeast3",
    invoker: "public",
    memory: "128MiB",
    maxInstances: 10,
    cors: false,
  },
  (req, res) => {
    const q = req.query ? req.query.share : "";
    const raw = Array.isArray(q) ? q[0] : q;
    const html = buildShareHtml(typeof raw === "string" ? raw : "");
    res.set("Content-Type", "text/html; charset=utf-8");
    // 공유 링크는 레시피가 고정이라 캐시 가능 — CDN 10분, 브라우저 5분.
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    res.status(200).send(html);
  }
);
