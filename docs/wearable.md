# 웨어러블 — 갤럭시 워치 먼저, 애플워치는 로드맵

> 내부 문서다. `firebase.json`이 `**/*.md`를 호스팅 배포에서 제외한다.

## 왜 워치인가

추출은 양손이 바쁜 작업이다. 저울을 보고, 물을 붓고, 포타필터를 잡는다.
폰을 집어 슬라이더를 만지는 대신 **손목을 탭해 타이머를 돌리고, 끝나면 크라운을
돌려 숫자 네 개를 맞추는 것**이 이 서비스의 "숫자 네 개, 30초" 약속에 더 가깝다.
권장 구간에 들어서는 순간 진동이 오므로 화면을 보지 않아도 된다.

## 플랫폼 판단

| | 갤럭시 워치 (Wear OS) | 애플워치 (watchOS) |
|---|---|---|
| 웹앱/TWA 실행 | ✗ (워치에 Chrome 없음) | ✗ (WebKit 뷰 없음) |
| 필요한 것 | Kotlin 네이티브 앱 | Swift 네이티브 앱 **+ iOS 본앱** |
| 개발 환경 | Windows/Linux/Mac | **Mac + Xcode 필수** |
| 계정 | 기존 Play 계정($25, 이미 있음) | Apple Developer **$99/년** |
| 배포 | 기존 Play 등록정보에 Wear OS 폼 팩터 추가 | App Store (iOS 앱에 watchOS 타깃 포함) |
| 현재 상태 | **MVP 구현됨** (`wear/`) | 로드맵 |

## 갤럭시 워치 MVP (`wear/`)

화면·빌드·사이드로드는 [`wear/README.md`](../wear/README.md).

### 데이터 연결 — 페어링 코드

워치에서 구글 로그인은 번거롭다(작은 화면, 폰 연동 필요). 그래서 워치는 **익명
로그인**만 하고, 웹 로그북에서 코드를 입력해 계정에 묶는다.

```
워치(익명 uid=W)                     Firestore                       웹(로그인 uid=U)
  │ watchPairs/123456 {watchUid:W} ──▶ │
  │  "123 456" 표시                    │ ◀── watchPairs/123456 {+ownerUid:U}  (코드 확정)
  │                                    │ ◀── watchLinks/W {ownerUid:U, code}  (연결)
  │ ◀── watchLinks/W 리스너 "연결됨"   │
  │ recipes {userId:U, source:'watch'} ─▶ │ ──▶ 로그북에 그대로 보임
```

- 코드는 **10분** 유효하다. 확정 전에는 워치만 읽을 수 있어 남이 엿볼 수 없다.
- 워치는 `recipes`를 **쓰기만** 한다 — 주인 기록을 읽을 수 없다.
- 웹 설정 › 워치 연결에서 해제하면 `watchLinks/W`가 지워지고, 그 즉시 워치 쓰기가 거부된다.
- 규칙: `firestore.rules`의 "워치 연결" 블록, 테스트: `tests/rules/` (69 케이스).

### 사용자가 해야 하는 일 (1회)

1. Firebase 콘솔 → Authentication → **익명 로그인 사용 설정**
2. Firebase 콘솔 → **Android 앱 등록** (`app.web.note_my_coffee`) → `google-services.json` 받기
   → `wear/app/`에 두기, 그리고 GitHub 시크릿 `WEAR_GOOGLE_SERVICES_JSON`에 전문 등록(CI용)
   - ⚠️ 이 앱 등록은 Firebase Hosting의 `assetlinks.json` 자동 생성과 얽힐 수 있다
     (`docs/app-store.md` "Firebase Hosting의 함정"). 지금은 정적 파일이 우선하므로
     영향이 없어야 하지만, 등록 후 `curl …/.well-known/assetlinks.json`을 한 번 확인한다.
3. **Firestore 규칙 게시** — 규칙은 콘솔에서 관리한다(ADMIN.md). 저장소의 `firestore.rules`를 반영.
4. 웹 배포(main 병합) — 로그북 설정 시트에 "⌚ 워치 연결"이 생긴다.

### 알려진 한계 (다음 단계)

- 관리자 집계: 워치는 `stats_daily`·`stats_beans`는 올리지만 `users/{uid}`(recipeCount·
  lastSeenAt)는 본인만 쓸 수 있어 건드리지 못한다. 워치 기록은 사용자별 기록 수에서 빠진다.
- 원두는 이름만(키보드·음성). 원산지·맛 노트·사진·평점은 웹에서.
- 타일(Tile)·컴플리케이션 없음 — 워치 페이스에서 바로 타이머를 여는 타일이 다음 후보.
- 폰 앱이 TWA라 Wearable Data Layer(폰↔워치 직접 동기화)를 쓸 수 없다 — 그래서 Firestore 경유.

## 다운로드 — 사용자는 어디서 받나

갤럭시 워치 앱은 **Galaxy Store가 아니라 Google Play**로 받는다(Watch4 이후 Wear OS).

- **워치에서**: Play 스토어 앱 → "Note My Coffee" 검색 → 설치
- **폰에서**: Play 스토어 → Note My Coffee 상세 → "**워치에 설치**" (또는 설치 기기 선택에서 워치 체크)
- 웹 로그북 › 설정 › 워치 연결 창에도 Play 링크가 있다.

## 배포 — Play Console 절차

폰 앱(TWA)과 **같은 앱(같은 패키지명)** 에 Wear OS를 추가하는 방식이다. 등록정보·리뷰·
다운로드 수를 공유하고, 사용자는 한 페이지에서 폰·워치를 모두 받는다.

1. Play Console → Note My Coffee → **설정 › 고급 설정 › 폼 팩터** → **Wear OS 추가**
   (Wear OS 앱 품질 가이드라인 동의)
2. **테스트 및 출시 › Wear OS 전용 트랙**이 생긴다 → 비공개 테스트 트랙에 먼저 업로드
   ```bash
   cd wear && ./gradlew :app:bundleRelease   # app/build/outputs/bundle/release/app-release.aab
   ```
3. 스토어 등록정보 → **Wear OS 스크린샷** 최소 1장(정사각형 384×384 이상, 원형 마스크 없이
   UI만 — 기기 프레임 금지) 업로드
4. 심사 제출 → Wear OS 별도 심사(가독성·원형 화면 대응·스와이프 뒤로가기 등)
5. 개인 계정이면 **비공개 테스트 요건**(`docs/app-store.md`)이 워치 트랙에도 적용되는지 Play Console 안내를 확인

### 체크리스트

- [ ] `versionCode`가 폰 앱과 겹치지 않음 (워치 2,000,000번대)
- [ ] `com.google.android.wearable.standalone = true` (폰 없이 동작 — 매니페스트에 있음)
- [ ] `uses-feature android.hardware.type.watch` (폰에 설치되지 않게 — 매니페스트에 있음)
- [ ] Play 앱 서명 키 SHA-1/256을 Firebase Android 앱에도 추가(스토어 설치본의 Firebase 접속용)

## 애플워치 로드맵

웹앱을 그대로 쓸 수 없으므로 다음이 모두 필요하다.

1. **Mac + Xcode**, Apple Developer Program **$99/년**
2. **iOS 본앱** — watchOS 앱은 단독 배포도 가능하지만 App Store 등록정보·결제·푸시를
   고려하면 iOS 앱(PWA를 감싸는 WKWebView 셸 또는 네이티브)이 사실상 전제다.
3. watchOS 타깃(SwiftUI): 갤럭시 워치 MVP와 같은 화면 구성
   - 타이머 + 햅틱(`WKInterfaceDevice.play(.notification)`)
   - 숫자 입력은 **Digital Crown**(`.digitalCrownRotation`)
4. 데이터: Firebase iOS SDK(Auth 익명 + Firestore)로 **지금 만든 페어링 코드 흐름을 그대로 재사용**한다.
   규칙·웹 UI 변경 없이 붙는다.
5. HealthKit은 필요 없다(운동 앱이 아님).

예상: iOS 셸 + watchOS MVP 2~3주, 심사 1주. 갤럭시 워치 사용 지표(`watch_linked` 이벤트,
`source:'watch'` 기록 수)를 보고 착수 여부를 정한다.
