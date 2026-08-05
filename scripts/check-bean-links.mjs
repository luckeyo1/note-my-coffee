#!/usr/bin/env node
// 취향 검사(#quiz)·AI 추천이 공유하는 원두 카탈로그(beans.js)의 상품 링크가 살아있는지 검사한다.
// - 검사 대상: beans.js 안의 컬리/홈바리스타클럽 상품 페이지 URL
//   (네이버 링크는 검색 결과 URL이라 죽을 수 없으므로 제외)
// - 404/410, 쇼핑몰의 '없는 상품' 안내 문구, 또는 '품절/SOLD OUT' 문구 → DEAD
//   (품절 상품은 페이지가 200으로 살아있어도 구매 불가라 죽은 링크로 함께 취급한다)
// - 403/418/429(봇 차단)·타임아웃·네트워크 오류 → BLOCKED (오탐 방지를 위해 실패로 치지 않음)
// 종료 코드 0: 모두 정상 / 1: DEAD 존재 (dead-links.json 생성 — Gemini 수리 단계의 입력)

import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../beans.js', import.meta.url), 'utf8');
const urls = [...new Set([
  ...(src.match(/https:\/\/www\.kurly\.com\/goods\/\d+/g) ?? []),
  ...(src.match(/https:\/\/www\.homebaristashop\.com\/goods\/goods_view\.php\?goodsNo=\d+/g) ?? []),
])];

if (urls.length === 0) {
  console.error('beans.js에서 상품 URL을 찾지 못했습니다 — 추출 정규식과 카탈로그 데이터가 어긋났는지 확인 필요');
  process.exit(1);
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
// 쇼핑몰이 200과 함께 안내 페이지를 주는 soft-404 대비 — 명시적 문구만 죽음으로 판정
const DEAD_MARKERS = ['상품이 존재하지 않', '판매중단된 상품', '삭제된 상품입니다'];
// 품절 판정 — 페이지는 살아있지만(200) 구매가 불가한 상태. 관련상품 영역의 '품절' 뱃지로
// 인한 오탐을 줄이기 위해 단독 '품절'이 아니라 구체적 문구만 본다.
const SOLDOUT_MARKERS = ['일시품절', '품절되었습니다', '품절된 상품', 'SOLD OUT', 'Sold Out', 'sold out'];

async function probe(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404 || res.status === 410) return { url, state: 'DEAD', detail: `HTTP ${res.status}` };
    if (!res.ok) return { url, state: 'BLOCKED', detail: `HTTP ${res.status}` };
    const body = await res.text();
    const marker = DEAD_MARKERS.find((m) => body.includes(m));
    if (marker) return { url, state: 'DEAD', detail: `페이지 문구: ${marker}` };
    const sold = SOLDOUT_MARKERS.find((m) => body.includes(m));
    if (sold) return { url, state: 'DEAD', detail: `품절: ${sold}` };
    return { url, state: 'OK', detail: `HTTP ${res.status}` };
  } catch (e) {
    return { url, state: 'BLOCKED', detail: e.name === 'TimeoutError' ? 'timeout' : String(e.cause?.code ?? e.message) };
  }
}

const results = [];
for (const url of urls) results.push(await probe(url)); // 순차 요청 — 상대 서버 부하·차단 방지

for (const r of results) console.log(`${r.state.padEnd(8)} ${r.detail.padEnd(14)} ${r.url}`);

const dead = results.filter((r) => r.state === 'DEAD');
const blocked = results.filter((r) => r.state === 'BLOCKED');

if (dead.length > 0) {
  writeFileSync('dead-links.json', JSON.stringify(dead, null, 2));
  console.log(`\n죽은 링크 ${dead.length}건 → dead-links.json 생성`);
  process.exit(1);
}
console.log(`\n${results.length}개 링크 모두 정상${blocked.length ? ` (봇 차단 등으로 판정 보류 ${blocked.length}건)` : ''}`);
