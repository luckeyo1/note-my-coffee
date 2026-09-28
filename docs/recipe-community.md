# 레시피 공유 커뮤니티 — 설계·구현 진행 문서

> 내부 문서. `firebase.json`이 `**/*.md`를 호스팅 배포에서 제외한다.
> 이 문서는 "나의 기록 → 공유 → 가져오기 → 추출 → 발전" 흐름을 붙이는 작업의
> 단일 진실 소스다. 계측은 [`funnel.md`](./funnel.md), 수익화는
> [`monetization.md`](./monetization.md), 관리자는 [`admin-roadmap.md`](./admin-roadmap.md).

작업 브랜치: `claude/recipe-community` (운영 배포 안 함 — `main`만 자동 배포된다).

---

## 0. 코드 분석 결과 (Phase 0)

| 항목 | 실제 상태 |
|---|---|
| 프레임워크 | **없음.** 순수 HTML/CSS/JS(ES Modules). 빌드·번들러 없음 |
| 패키지/툴링 | `package.json`에 `@anthropic-ai/sdk`만(클라이언트 미사용, 잔재). **scripts 없음 → 빌드/린트/타입/테스트 명령 없음** |
| Firebase | 10.8.0, `gstatic` CDN에서 ESM 로드(`firebase-config.js`). Auth + Firestore |
| 인증 | Google + Kakao(OIDC). `signInWithPopup`. 비로그인=게스트(localStorage 1건 체험) |
| DB | Firestore. 컬렉션: `recipes`(userId 스코프), `users`, `stats_daily`, `stats_beans`, `stats_visits`, `leads`, `public_stats` |
| 보안 규칙 | **저장소에 파일 없음.** 콘솔에서 직접 관리(ADMIN.md에 전문 존재). `firebase.json`에도 firestore 미연결 |
| 사진 | **Firebase Storage 미사용.** 사진을 base64로 `recipes` 문서 필드(`imageUrl`)에 저장. `main.js`가 클라이언트에서 1600px·품질 0.72로 압축, 하드 상한 950KB(문서 1MB 한도) |
| 기존 공유 | 공개 커뮤니티 **없음.** 두 가지가 있음: ① 레시피 전달 링크(`logbook.html?share=<base64>`, 비공개·클라이언트 전용) ② 브루 카드 이미지(`brew-card.js`) |
| 라우팅 | 정적 다중 페이지: `index.html`(랜딩), `app.html`(추출), `logbook.html`(내 기록), `admin.html`. `cleanUrls`(확장자 생략) |
| 디자인 토큰 | `style.css` `:root`에 정리됨(클레이 `#B4532A`, 크림 `#FCFAF6`, 잉크 `#241C15`; 모서리 각짐 radius 0, 사진만 14px). Pretendard 자체 호스팅 + IBM Plex Mono |
| 하단 탭바 | 이미 있음(추출/기록/설정) — 이번 작업에서 **발견/프로필**을 추가·정렬해야 함 |
| 배포 | Firebase Hosting, `main` push 시 GH Action 자동 배포. TWA(Play) + PWA(`sw.js`) |

### 위험 요소 / 반드시 지킬 것

- **사진이 문서에 base64로 박혀 있다.** 공개 게시물에 그대로 쓰면 (a) 공개 문서가 커지고
  (b) "공유 해제 후 사진 접근 차단"·"영구 공개 URL 방지"(§8)를 완전히 지킬 수 없다.
  → **사진 저장 방식 결정이 선행 과제**(아래 3절).
- **보안 규칙이 저장소 밖(콘솔)에 있다.** 공유 기능의 보안은 규칙에 달렸는데,
  나는 규칙을 게시할 수 없다(콘솔 접근·배포는 범위 밖). → `firestore.rules`를
  **산출물로 제공**하고, 게시는 소유자가 한다.
- **이 작업 환경은 Firebase CDN이 차단**돼 앱을 실제로 못 띄운다 → Firestore 연동
  동작은 여기서 E2E 검증 불가. 순수 로직·격리 렌더만 검증 가능.

---

## 1. 설계 결정 (Decisions)

1. **기존 구조 재사용.** 프레임워크/DB 교체 없음. 새 페이지는 기존 정적 다중 페이지
   패턴을 따른다: `discover.html`(발견), `post.html`(레시피 상세), `profile.html`(프로필),
   `share.html` 또는 로그북 내 모달(공유 작성). 라우팅은 실제 파일명으로 확정.
2. **개인 기록과 공개 게시물을 분리.** `recipes`(비공개, 지금 그대로) ↔ `posts`(공개 스냅샷,
   신규). 공개는 개인 기록에서 "공개해도 되는 필드만" 스냅샷으로 복사한다. 개인 메모 수정이
   공개 게시물에 자동 반영되지 않는다(§5-3).
3. **가져오기 = 독립 사본.** 북마크가 아니라 `recipes`에 새 문서를 만든다. `source`(원본
   식별자·버전·출처)와 `baseline`(변경 비교 기준)을 심는다. 사본 기본 공개범위 = 비공개(§5-6).
4. **공개 범위 3단계.** private / unlisted(링크) / public(피드). 기본값 private(§8).
5. **디자인 토큰은 유지.** 스펙 제안 팔레트(강조 `#A44727`, 배경 `#F7F6F2`)는 현재
   토큰(강조 `#B4532A`, 배경 `#FCFAF6`)과 거의 같다. **전면 재도색은 회귀 위험이 커서
   하지 않고**, 신규 화면을 기존 토큰으로 짓는다. 필요 시 토큰 값만 미세 조정.
   근거: 라이브가 이미 이 팔레트로 나가 있고(랜딩·앱·공유 카드), 색을 바꾸면
   `brew-card.js`처럼 색을 하드코딩한 곳까지 흔들린다.
6. **제외 기능은 화면에 두지 않는다.** 좋아요·댓글·팔로우·DM·알림·인기순·AI·결제·배지
   → 버튼도 가짜 숫자도 만들지 않는다(§3).

### 순수 로직은 별도 모듈로 (구현됨)

`recipe-share-model.js` — Firebase·DOM 비의존. 단위 테스트 가능(러너가 없어 node로 직접).
- `VISIBILITY`, `normalizeVisibility`(안전 기본값), `isFeedVisible`
- `generateShareToken`(Web Crypto 우선, 22자 base62)
- `brewRatio(dose, liquid)` — §12.13 검증
- `buildPublicSnapshot` — 개인 메모/평점/내 사진 원본을 공개로 자동 복사하지 않음(§5-3)
- `buildImportedRecipe` — 비공개 사본 + baseline + source, 원본 사진 자동 재게시 안 함(§5-6)
- `diffFromBaseline` — 변경된 항목만, 단위·라벨(에스프레소 '추출량' vs 드립 '투입 물량')

---

## 2. 정보구조 / 내비게이션

모바일 하단 탭: **[추출] [발견] [내 기록] [프로필]**
- 추출 `app.html` — 기존. 기본 진입 화면 유지(§4)
- 발견 `discover.html` — 신규. 공개 피드
- 내 기록 `logbook.html` — 기존 + 가져온 레시피 구분
- 프로필 `profile.html` — 신규. 공개 프로필 + 내 공개 게시물 + 계정 설정 진입

- 공유 링크 접속 → 레시피 상세로 바로 진입. 로그인 후 원래 행동/화면 복귀(§4).
- 데스크톱은 상단/측면 내비, 이름·역할 동일.
- 기존 `logbook.html?share=` 전달 링크는 **호환 유지**(삭제 판단 근거: 이미 배포돼
  돌아다닐 수 있는 링크라 깨면 안 됨).

---

## 3. 데이터 모델 & 사진 (결정 필요 항목 포함)

### 컬렉션

- `recipes/{id}` (기존, 비공개) — `visibility` 없으면 private로 간주. 가져온 사본은
  `source`, `baseline`, `sourcePhotoUrl` 추가.
- `posts/{id}` (신규, 공개 스냅샷) — `ownerId, ownerName, visibility, status,
  hiddenByAdmin, title, description, method, params{dose,waterTemp,timeSec,yield},
  bean, roaster, gear, grinder, grindSetting, photoUrl, hasPhoto, sourcePostId?,
  version, createdAt, updatedAt, shareToken?`
- `reports/{id}` (신규) — `reporterId, targetPostId, reason, createdAt`. 관리자만 열람.
- `blocks/{uid}/blocked/{blockedUid}` (신규) — 본인만. 피드 필터는 클라이언트.
- `profiles/{uid}` (신규, 공개) — `displayName, bio, photoUrl`만. **이메일·개인기록 없음.**

### ⚠️ 사진 저장 — 소유자 결정 필요 (비용/보안 트레이드오프)

현재는 base64가 `recipes` 문서에 박혀 있다. 공개 게시물의 사진을 어떻게 다룰지 두 갈래:

- **A안 (Storage 도입, 권장):** Firebase Storage에 `posts/{id}.jpg` 업로드, Storage 규칙로
  접근 제어. 공유 해제 시 삭제/차단 가능, 메타데이터 제거·리사이즈 서버측 적용 여지.
  - 비용: Storage는 무료 티어 있음(대개 Blaze 불필요, 단 프로젝트가 이미 Blaze인지 확인).
  - 작업량: 업로드/규칙/URL 관리 추가. `firebase-config.js`에 `getStorage` 미도입 상태.
- **B안 (base64 유지, 단순):** 공개 사진도 `posts` 문서에 base64. 구현 최소.
  - 한계: 공개 문서가 세계 읽기이므로 **"공유 해제 후에도 캐시·이미 받은 사본은 회수 불가"**
    를 그대로 안고 간다. §8의 "영구 공개 URL 방지"는 문서를 지우면 접근은 막히나, 이미
    전달된 이미지 회수는 불가(§8도 "회수 가능하다고 안내하지 말 것"이라 명시).

→ **미결. 소유자 선택 필요.** 그전까지 사진 공개는 "포함/제외" 토글만 구현하고 저장
경로는 확정하지 않는다. (선택 전 공개 게시는 사진 없이도 완결되게 설계.)

---

## 4. 보안 (규칙 산출물 제공, 게시는 소유자)

`firestore.rules` + `firestore.indexes.json`을 저장소에 추가했다. **아직 게시 안 됨,
`firebase.json`에도 연결 안 함**(실수 배포 방지).

핵심(§8):
- UI 숨김만으로 접근 제한하지 않음 — 규칙에서 검증.
- `posts` get: 소유자·관리자·(active & public/unlisted). list: public+active만 열거
  (unlisted 섞인 쿼리는 거부 → 열거 불가). unlisted는 추측 어려운 문서 ID가 비밀.
- 공유 해제(visibility→private) 시 규칙이 매 읽기 재검사 → 비소유자 즉시 차단.
- 작성자가 수정해도 `hiddenByAdmin==true`면 status를 active로 되돌릴 수 없음(§9).
- `ownerId`·`hiddenByAdmin`을 클라이언트가 변경 불가.
- `reports`·`stats_*`·`users`(이메일) 열람은 관리자만.

### 규칙만으로 못 지키는 한계 (정직하게 기록)

- **unlisted 링크 재발급 무효화(§8):** Firestore 규칙은 쿼리스트링 토큰을 못 읽는다.
  현재 설계는 "문서 ID = 비밀"이라 링크 개별 무효화가 안 된다(공유 해제=private 전환은 됨).
  진짜 재발급/무효화가 필요하면 `post_links/{token}` 조회 문서 패턴(토큰 doc 생성/삭제)으로
  올려야 한다 → 후속 과제로 남김.
- **캐시 유출 방지(§8):** unlisted/비공개 응답이 서비스워커·공용 캐시로 새지 않게 하려면
  `sw.js`에서 `posts` 및 상세 경로를 캐시 예외 처리해야 한다 → Phase 2에서 함께.
- **차단(§9):** 규칙은 조인을 못 해 피드에서 차단 작성자 제외는 클라이언트가 한다.
  비로그인 접근까지 막는 완전 비공개가 아님을 UI에 명시.

---

## 5. 단계별 상태

| 단계 | 내용 | 상태 |
|---|---|---|
| 0 | 코드 분석 | ✅ 완료(이 문서) |
| 1a | 순수 로직 모듈 `recipe-share-model.js` + 테스트 | ✅ 완료(node 33/33) |
| 1b | 보안 규칙·인덱스 산출물 | ✅ 파일 완료 / ⛔ 게시는 소유자 |
| 1c | 추출·기록 화면 사용성(숫자 직접 입력 등) | ⬜ 예정 |
| 2 | 공유 작성 + 상세 + 공유 해제 + 권한 | ⬜ 예정(사진 결정 선행) |
| 3 | 가져오기 + 다시 추출 + 변경 비교 | ⬜ 예정 |
| 4 | 발견 피드 + 필터 + 프로필 + 신고/차단/관리자 숨김 | ⬜ 예정 |
| 5 | 랜딩페이지 개편 | ⬜ 예정 |
| 6 | 통합 검증·회귀·인계 | ⬜ 예정 |

각 단계는 독립적으로 진행하되, Firebase 연동 부분은 이 환경에서 E2E가 불가하므로
**소유자 프리뷰(Firebase Studio) 검증을 각 단계 뒤에 요청**한다.

---

## 6. 검증

### 이번 단계에서 실제로 검증한 것
- `recipe-share-model.js` — node 단위 테스트 33건 통과:
  - §12.13 비율: 18/36=1:2.0, 15/240=1:16.0, 0/음수 → null
  - §8 공개범위 기본값(미상→private)·피드 노출(public+active만)
  - 공유 토큰 22자 base62, 1000개 충돌 없음
  - §5-3 스냅샷이 평점·개인 메모·내 사진 원본을 공개로 자동 복사하지 않음
  - §5-6 가져오기 사본=비공개 + baseline + source, 원본 사진 자동 재게시 안 함
  - §5-7·§12.12 변경 diff: 변경 항목만, 단위/라벨(추출량 vs 투입 물량)
- `firestore.rules`·`firestore.indexes.json` — JSON/구문 확인.

### 이 환경에서 검증 불가(미실행으로 기록)
- Firestore 규칙의 실제 동작(직접 URL 접근 차단, 공유 해제 후 재검사, 관리자 숨김 유지 등,
  §12의 3·4·5·6·7·9·10·14·15) — 규칙 게시 + 실기기/에뮬레이터 필요.
- 앱 전체 E2E — 이 컨테이너가 Firebase CDN 차단.

### 검증 권장 방법(소유자/후속)
- 규칙: Firebase **로컬 에뮬레이터**(`firebase emulators:start`)로 §12 권한 시나리오를
  자동 테스트하는 것이 가장 안전(무료, 실데이터 영향 없음).

---

## 7. 배포 / 롤백

- 이 브랜치는 `main`이 아니므로 push해도 **자동 배포되지 않는다**.
- 라이브 반영은 `main` 병합 시 hosting만 배포된다. **규칙·인덱스는 hosting 배포에
  포함되지 않는다** — 별도로 `firebase deploy --only firestore:rules,firestore:indexes`
  또는 콘솔에서 게시해야 한다.
- 게시 순서(중요): **규칙·인덱스 먼저 → 그다음 기능 코드.** 순서가 뒤바뀌면 클라이언트가
  아직 없는 권한을 호출해 조용히 실패한다.
- 롤백: 코드는 `main`을 직전 커밋으로 되돌려 재배포. 규칙은 콘솔의 이전 버전으로 복원.

---

## 8. 소유자가 직접 해야 하는 것

1. **사진 저장 방식 결정**(3절 A/B안).
2. `firestore.rules` **게시**(콘솔 또는 CLI). 게시 전에는 공유 기능을 켜지 말 것.
3. `firestore.indexes.json` **게시**(피드/프로필 쿼리 인덱스).
4. 프로젝트 요금제 확인(Storage 도입 시).
