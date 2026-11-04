// functions/share-og.js
// ──────────────────────────────────────────────────────────────────────────
// 공유 레시피 링크(/s?share=<base64>)용 OG 미리보기 HTML 생성.
//
// 왜 필요한가: 레시피 공유 링크는 지금까지 /logbook?share= 로 향했고, 카카오톡·
// 트위터·슬랙 같은 링크 미리보기는 /logbook.html의 "정적" head(= 일반 OG)만 읽어
// 어떤 레시피든 똑같은 밋밋한 카드가 떴다. 이 모듈은 URL에 실려 온 레시피를 디코드해
// "원두명 · 모드 · 도징/온도/시간/수율 · 비율 · 별점"이 담긴 레시피별 OG를 만든다.
//
// 설계 요점(상태 없음 = Firestore·인증 불필요 = 캐시 가능 = 컨테이너에서 단위 테스트 가능):
//   · 레시피는 logbook.js buildShareData/buildShareUrl, main.js buildLogbookShareUrl과
//     "동일한" 인코딩으로 URL에 실려 온다: JSON {n,m,o,d,t,e,y,k,r,s} →
//     btoa(unescape(encodeURIComponent(json))) → encodeURIComponent(b64).
//   · 스크래퍼는 이 head의 OG만 읽고, 사람은 import가 실제로 동작하는
//     /logbook?share= 로 즉시 리다이렉트된다(meta-refresh + JS replace).
//   · URL은 사용자 입력(원두명·원산지·맛노트)을 담으므로 모든 출력은 HTML-escape 한다.
//
// Firebase에 의존하지 않는다 — index.js의 shareOg(onRequest)가 이 함수를 호출한다.
"use strict";

const SITE = "https://note-my-coffee.web.app";
const OG_IMAGE = SITE + "/og-image.png"; // 1200×630 브랜드 이미지(랜딩 OG와 동일).

// HTML 속성/텍스트 컨텍스트 escape. 원두명·원산지·맛노트가 URL에서 오므로 필수.
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const truncate = (s, n) => {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n - 1).trim() + "…" : t;
};

// 유한수면 소수 첫째자리까지 정리, 아니면 0.
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : 0);

function fmtTime(mode, t) {
  const n = Math.max(0, Number(t) || 0);
  if (mode === "drip") {
    const s = Math.round(n);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  return num(n) + "s"; // 에스프레소: 초 단위(소수 허용).
}

// ?share= 원본 base64(URL 디코딩된 상태) → 레시피 객체. 실패 시 null.
// logbook.js buildShareData의 역연산: {n,m,o,d,t,e,y,k,r,s}.
function decodeShare(raw) {
  if (!raw) return null;
  try {
    // 과거 비인코딩 링크는 +가 공백으로 도착할 수 있어 되돌린다(logbook.js와 동일 방어).
    const b64 = String(raw).replace(/ /g, "+");
    const json = Buffer.from(b64, "base64").toString("utf8");
    const d = JSON.parse(json);
    if (!d || typeof d !== "object") return null;
    return {
      bean: String(d.n || ""),
      mode: d.m === "drip" ? "drip" : "espresso",
      origin: String(d.o || ""),
      dose: num(d.d),
      temp: num(d.t),
      time: Number(d.e) || 0,
      yield: num(d.y),
      notes: String(d.k || ""),
      rating: Math.max(0, Math.min(5, parseInt(d.r, 10) || 0)),
      success: !!d.s,
    };
  } catch (e) {
    return null;
  }
}

// 레시피 → {title, desc} (언어 중립: 숫자 + 영문 모드 라벨 + 사용자 입력).
function metaFor(r) {
  const modeLabel = r.mode === "drip" ? "HAND DRIP" : "ESPRESSO";
  const headline = r.bean || r.origin || "Coffee recipe";
  const title = headline + " · Note My Coffee";

  const parts = [modeLabel];
  const spec = [];
  if (r.dose) spec.push(r.dose + "g");
  if (r.temp) spec.push(r.temp + "°C");
  spec.push(fmtTime(r.mode, r.time));
  if (r.yield) spec.push(r.yield + "g");
  if (spec.length) parts.push(spec.join(" / "));
  if (r.dose > 0 && r.yield > 0) parts.push("1:" + (r.yield / r.dose).toFixed(1));
  if (r.rating) parts.push("★".repeat(r.rating) + "☆".repeat(5 - r.rating));
  let desc = parts.join(" · ");
  if (r.notes) desc += " · " + truncate(r.notes, 80);
  return { title, desc };
}

// raw: ?share= 원본(base64, URL 디코딩된 상태). 반환: 스크래퍼용 OG + 사람용 리다이렉트 HTML.
function buildShareHtml(raw) {
  const recipe = decodeShare(raw);
  const safeParam = encodeURIComponent(String(raw || ""));
  const target = "/logbook?share=" + safeParam; // import가 동작하는 실제 페이지.
  const meta = recipe
    ? metaFor(recipe)
    : {
        title: "Note My Coffee — 커피 레시피",
        desc: "도징·온도·시간·수율만 기록하면 다음 다이얼링의 출발점이 남습니다.",
      };
  const selfUrl = SITE + "/s?share=" + safeParam;

  const t = esc(meta.title);
  const d = esc(meta.desc);
  const tgt = esc(target);
  const self = esc(selfUrl);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Note My Coffee">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${self}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="canonical" href="${SITE}${tgt}">
<meta http-equiv="refresh" content="0; url=${tgt}">
<style>html,body{margin:0}body{font-family:system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;background:#FCFAF6;color:#3a2e26;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center}a{color:#B4532A}</style>
</head>
<body>
<p>레시피를 여는 중… <a href="${tgt}">열리지 않으면 여기를 누르세요</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>`;
}

module.exports = { buildShareHtml, decodeShare, metaFor, fmtTime, esc, SITE };
