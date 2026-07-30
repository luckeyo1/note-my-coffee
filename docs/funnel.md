# 전환 퍼널 설계 (Funnel Design)

수익화 로드맵의 계측 단계. Phase 0(커밋 `6800954`)에서 원시 GA4 이벤트를 앱 전반에
붙였고, 이 문서는 **그 이벤트들을 하나의 전환 퍼널로 묶는 단일 진실 소스**다. GA4에서
무엇을 단계로 보고 어디서 이탈을 읽어야 하는지, 각 단계가 어떤 이벤트로 측정되는지를
정의한다.

> 이 문서는 내부 문서다. `firebase.json`이 `**/*.md`를 호스팅 배포에서 제외하므로
> 공개 사이트에는 올라가지 않는다.

---

## North Star / 활성화 정의

- **North Star:** 첫 `recipe_saved` — 사용자가 실제로 추출을 한 건 기록한 순간.
  랜딩·퀴즈·로그인은 전부 여기에 도달시키기 위한 경로다.
- **활성화(Activation):** 신규 가입 후 **첫 `recipe_saved{success_flag}`**. 활성화 퍼널의
  분모는 `sign_up`(신규 가입)이지 `login`(재로그인 포함 전체)이 아니다 — 그래서
  로그인 이벤트를 신규/재방문으로 나눠 센다.

---

## 주 퍼널 (획득 → 활성화 → 유지)

| # | 단계 | 이벤트 | 파라미터 | 발생 위치 |
|---|------|--------|----------|-----------|
| 1 | 랜딩 노출 | `landing_view` + GA4 자동 `page_view`/`session_start` | — | `landing.js` (로드 시) |
| 2 | 참여(스크롤/상호작용) | `section_view` · `demo_view` · `quiz_start` | `section_view{id}`, `demo_step_click{scene}` | `index.html` |
| 3 | 의도(CTA) | `cta_click` | `{location: hero\|nav\|mid\|final\|sticky\|quiz, signed_in?, profile?}` | `landing.js`, `index.html` |
| 4 | 가입·로그인 | `sign_up` / `login` | `{source: landing\|app_header\|guest_gate}` | `landing.js`, `main.js` |
| 5 | 앱 진입 | `app_page_view` | `{page: app\|logbook}` | `main.js`, `logbook.js` |
| 6 | **활성화** | `recipe_saved` | `{mode, has_photo, guest, rated, success_flag}` | `main.js` |
| 7 | 유지 | 재 `recipe_saved` · `logbook_opened` | `logbook_opened{from}` | `main.js` |

**단계별 이탈 판독**
- 1→2: 랜딩에 왔지만 아무 구간도 못 보고 이탈(히어로 바운스). `section_view` 부재로 측정.
- 2→3: 콘텐츠는 봤지만 CTA를 안 누름 — 어느 `section_view`까지 갔는지로 이탈 지점 특정.
- 3→4: CTA는 눌렀지만 구글 로그인 팝업에서 이탈(가입 포기).
- 4→6: 가입은 했지만 첫 기록 없음 — 온보딩/입력 마찰. `onboarding_*`, `guest_gate_*` 참고.

---

## 보조 퍼널 (퀴즈 → 제휴 원두)

취향 검사는 제휴(원두 판매) 수익화의 판단 지표다.

| 단계 | 이벤트 | 파라미터 |
|------|--------|----------|
| 검사 시작 | `quiz_start` | — |
| 검사 완주 | `quiz_complete` | `{profile, profile_title}` |
| 원두 링크 클릭 | `bean_link_click` | `{profile, store, bean_name}` |
| 외부 구매 | (측정 불가 — 외부 스토어) | — |
| 결과 공유(바이럴) | `quiz_share` | `{profile, method}` |
| 재검사 | `quiz_restart` | `{profile}` |

- **완주율** = `quiz_complete` / `quiz_start`. `quiz_restart`는 분모를 흐리지 않도록 별도.
- 검사 완주자는 페이지 내 몰입도가 가장 높다 → 결과 화면 CTA(`cta_click{location:quiz}`)로
  제품에 되돌린다. 퀴즈→가입 전환도 이 경로로 추적된다.

---

## 후원/결제 퍼널

랜딩의 토스페이먼츠 샌드박스 결제(개발자 후원). 최종 CTA 뒤로 배치돼 전환 동선을 비운다.

| 단계 | 이벤트 | 파라미터 | 발생 위치 |
|------|--------|----------|-----------|
| 결제 위젯 열기 | `support_open` | — | `pay.js` |
| 결제 요청 | `support_pay_attempt` | `{amount}` | `pay.js` |
| 결제 성공 | `support_pay_success` | `{amount, order_id}` | `pay-success.html` |

---

## 핵심 전환율 지표

| 지표 | 정의 (분자 / 분모) |
|------|--------------------|
| 랜딩→CTA | `cta_click`(세션 유니크) / `landing_view` |
| CTA→가입 | `sign_up` + `login` / `cta_click` |
| **가입→활성화** | 첫 `recipe_saved` / `sign_up` |
| 저장 성공률 | `recipe_saved` / (`recipe_saved` + `recipe_save_failed`) |
| 퀴즈 완주율 | `quiz_complete` / `quiz_start` |
| 퀴즈→원두클릭 | `bean_link_click`(세션 유니크) / `quiz_complete` |
| 후원 전환 | `support_pay_success` / `support_open` |
| 게스트 게이트 수락률 | `guest_gate_accepted` / `guest_gate_shown` |

---

## GA4 Funnel Exploration 설정

1. GA4 → **탐색(Explore)** → **유입경로 탐색 분석(Funnel exploration)**.
2. 주 퍼널 단계를 순서대로 추가(각 단계 = 이벤트 이름):
   `landing_view` → `section_view` → `cta_click` → `sign_up`(또는 `login` OR 조건) →
   `app_page_view` → `recipe_saved`.
3. **열린(개방형) 퍼널**로 두면 중간 진입도 포함, **닫힌 퍼널**이면 1단계부터의 순차만.
   최상단 바운스 진단은 닫힌 퍼널 권장.
4. 세그먼트: **신규 사용자 vs 재방문**을 나눠 활성화 퍼널을 비교. `sign_up`/`login`
   구분이 여기서 쓰인다.
5. 보조/후원 퍼널은 별도 탐색으로: `quiz_start`→`quiz_complete`→`bean_link_click`,
   `support_open`→`support_pay_attempt`→`support_pay_success`.

> GA4 이벤트(랜딩·CTA·가입 단계)는 Firestore가 아니라 GA4 콘솔에 쌓이므로 **획득
> 퍼널은 GA4 Funnel Exploration에서 본다.** 관리자 대시보드(`admin.js`)는 Firestore
> `recipes` 집계 기반이라 그 단계들을 그리지 못한다 — 대신 아래 **부분 퍼널**을 담당한다.

### 관리자 대시보드의 부분 퍼널 (Firestore)

`admin.html`의 **활성화·유지 퍼널** 카드는 Firestore `recipes`만으로 그릴 수 있는
구간, 즉 **기록을 남긴 사용자가 얼마나 정착하는가**를 사용자별 기록 수로 보여준다
(GA4 불필요, 기간 필터에 연동). 위 주 퍼널의 6→7단계(활성화→유지)를 실데이터로 읽는다.

| 단계 | 정의 | 의미 |
|------|------|------|
| 기록 사용자 | ≥1건 저장 | 활성화된 계정(퍼널 최상단, 100%) |
| 재기록 | ≥2건 | 다시 돌아옴 — 가치 확인 |
| 정착 | ≥5건 | 습관화 |
| 헤비 유저 | ≥10건 | 코어 사용자 |

각 단계는 앞 단계의 부분집합이라 단조 감소하며, 전체 대비 %와 직전 단계 대비
전환율을 함께 표시해 이탈 지점을 읽는다. 랜딩~가입 상단 퍼널은 GA4가, 가입 이후
정착 퍼널은 이 카드가 담당하는 분업이다.

---

## 갭 분석 — 이번 변경으로 닫는 것

Phase 0로 이벤트는 풍부했지만 퍼널로서는 세 곳이 비어 있었다.

1. **랜딩 최상단(치명적).** `getAnalytics()`는 `track()` 첫 호출 때만 초기화된다
   (`firebase-config.js`). 랜딩은 로드 시 `track()`을 부르지 않아, CTA·퀴즈·데모를
   건드리지 않고 이탈한 방문자는 자동 `page_view`조차 없었다 → 퍼널 분모(랜딩 방문 수)가
   실제보다 작았다. **`landing_view`(로드 시)로 해결.**
2. **가입 전환 정점.** 랜딩에서 로그인 성공 시 아무 이벤트도 없었고, 신규 가입과
   재로그인이 구분되지 않았다. **`sign_up`/`login{source}`(getAdditionalUserInfo)로 해결.**
3. **미드퍼널 이탈 지점.** 랜딩 상단→CTA 사이가 깜깜했다. **`section_view`로 해결.**
4. **후원 퍼널 종점.** 결제 성공 페이지에 계측이 없었다. **`support_pay_success`로 해결.**

## 다음 실험 권고 (우선순위)

1. 위 퍼널로 2주 관측 후, **가장 큰 이탈 단계**부터 개선(대개 4→6 활성화 또는 1→2 히어로).
2. 게스트 게이트 임계(현재 1개 저장) A/B — 활성화 vs 가입률 트레이드오프.
3. 퀴즈→가입 전환이 일반 CTA보다 높으면 퀴즈를 상단으로 끌어올리는 배치 실험.
4. 제휴 승인 후 `bean_link_click` → 딥링크 전환/커미션을 별도 지표로 연결.
