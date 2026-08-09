#!/usr/bin/env node
// 취향 검사(#quiz) 추천 원두 링크 점검.
//
// 예전엔 상품 페이지 URL 12개를 하나씩 찔러봤는데, 그 방식 자체가 문제였다.
// 상품은 품절되고 상품번호는 재입고마다 새로 발급된다. 실제로 홈바리스타클럽
// 콜라보 원두는 공동구매 일회성이라 영구 품절로 죽었고, 봇 차단 때문에 BLOCKED로
// 분류되어 경보도 울리지 않았다. 그래서 링크를 **스토어 검색 결과**로 바꿨다.
//
// 지금 검사하는 것은 두 가지다.
//   1. 검색 진입점 두 개(컬리·네이버)가 실제로 열리는지 — 스토어가 검색 경로를
//      바꾸면 여기서 잡힌다.
//   2. index.html에 개별 상품 URL이 다시 기어들어오지 않았는지 — 이게 재발 방지선이다.
//
// 404/410 또는 '없는 페이지' 문구 → DEAD
// 403/418/429(봇 차단)·타임아웃 → BLOCKED (오탐 방지를 위해 실패로 치지 않음)
// 종료 코드 0: 정상 / 1: 문제 있음 (dead-links.json 생성 — 수리 단계의 입력)

import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// ── 1. 상품 URL 재발 방지 ────────────────────────────────────────────────
// 주석에도 "넣지 말 것"이라 적어뒀지만, 규칙은 검사로 받쳐야 지켜진다.
const CODE_ONLY = html.replace(/^\s*\/\/.*$/gm, '');   // 주석 속 예시는 위반이 아니다
const FORBIDDEN = [
  { re: /https:\/\/www\.kurly\.com\/goods\/\d+/g,                          why: '컬리 개별 상품 URL' },
  { re: /https:\/\/www\.homebaristashop\.com\/goods\/goods_view\.php\?goodsNo=\d+/g, why: '홈바리스타클럽 개별 상품 URL' },
  { re: /https:\/\/search\.shopping\.naver\.com\/\S*/g,                    why: '네이버 쇼핑 검색(봇 차단·경로 이전으로 불안정)' },
];
const violations = FORBIDDEN.flatMap(({ re, why }) =>
  (CODE_ONLY.match(re) ?? []).map((url) => ({ url, state: 'DEAD', detail: `금지된 링크 형태 — ${why}` })));

// ── 2. 검색 진입점 점검 ──────────────────────────────────────────────────
// index.html의 빌더와 같은 형태여야 한다. 여기만 바꾸고 index.html을 안 바꾸면
// 검사만 통과하고 실제 링크는 죽으므로, 빌더가 살아있는지도 함께 확인한다.
const ENTRY_POINTS = [
  { store: '컬리',   builder: /kurlySearch\s*=\s*\(q\)\s*=>\s*'https:\/\/www\.kurly\.com\/search\?sword='/,
    probe: 'https://www.kurly.com/search?sword=' + encodeURIComponent('원두') },
  { store: '네이버', builder: /naverSearch\s*=\s*\(q\)\s*=>\s*'https:\/\/search\.naver\.com\/search\.naver\?query='/,
    probe: 'https://search.naver.com/search.naver?query=' + encodeURIComponent('프릳츠 원두') },
];

for (const ep of ENTRY_POINTS) {
  if (!ep.builder.test(html)) {
    violations.push({ url: ep.probe, state: 'DEAD',
      detail: `index.html에서 ${ep.store} 검색 빌더를 찾지 못함 — 검사와 코드가 어긋났다` });
  }
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DEAD_MARKERS = ['페이지를 찾을 수 없', '존재하지 않는 페이지', '서비스가 종료'];

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
    return { url, state: 'OK', detail: `HTTP ${res.status}` };
  } catch (e) {
    return { url, state: 'BLOCKED', detail: e.name === 'TimeoutError' ? 'timeout' : String(e.cause?.code ?? e.message) };
  }
}

const results = [];
for (const ep of ENTRY_POINTS) results.push(await probe(ep.probe)); // 순차 요청 — 상대 서버 부하·차단 방지

for (const r of [...violations, ...results]) console.log(`${r.state.padEnd(8)} ${r.detail.padEnd(40)} ${r.url}`);

const dead = [...violations, ...results.filter((r) => r.state === 'DEAD')];
const blocked = results.filter((r) => r.state === 'BLOCKED');

if (dead.length > 0) {
  writeFileSync('dead-links.json', JSON.stringify(dead, null, 2));
  console.log(`\n문제 ${dead.length}건 → dead-links.json 생성`);
  process.exit(1);
}
console.log(`\n검색 진입점 ${results.length}개 정상 · 금지된 상품 URL 없음${blocked.length ? ` (봇 차단 등으로 판정 보류 ${blocked.length}건)` : ''}`);
