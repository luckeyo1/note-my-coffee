# 앱스토어 출시 — 안드로이드(TWA) 우선

> 내부 문서다. `firebase.json`이 `**/*.md`를 호스팅 배포에서 제외한다.

이 앱은 **PWA를 그대로 감싸는 방식(TWA)** 으로 Play 스토어에 올린다. 웹과 앱이
같은 코드를 쓰므로 배포하면 앱도 같이 갱신된다 — 스토어 재심사가 필요 없다.

## ⏱ 가장 먼저 알아야 할 것: 개인 계정은 바로 출시할 수 없다

Google Play는 **개인(개인 개발자) 계정**으로 만든 앱에 대해, 프로덕션 출시 전
**비공개 테스트를 일정 인원 × 14일 연속** 진행하도록 요구한다. 요구 인원은
정책이 바뀌어 왔으니(과거 20명 → 이후 완화) **Play Console 안내를 반드시 확인**한다.

**즉 오늘 등록해도 스토어 공개까지 최소 2~3주가 걸린다.** 과제 제출 기한이 가깝다면
아래 순서를 권한다.

1. 지금 바로 → **웹 링크로 제출**(이미 라이브다). 스토어 심사와 무관하다.
2. 병행 → Play Console 등록 + 비공개 테스트 시작. 통과되면 그때 스토어 링크를 추가한다.

사업자 계정으로 등록하면 이 요건이 없지만 사업자등록번호가 필요하다.

---

## 준비물

| 항목 | 내용 |
|---|---|
| Google Play 개발자 계정 | **$25 (1회)** — <https://play.google.com/console/signup> |
| Node.js | Bubblewrap CLI 실행용 |
| JDK 17 + Android SDK | Bubblewrap이 설치를 안내해준다 |
| 서명 키 | Play App Signing 사용 권장(구글이 보관) |

Mac은 **필요 없다.** 안드로이드는 Windows/Linux에서 전부 된다.

---

## 이미 갖춰진 것 (추가 작업 없음)

- `manifest.json` — `id`·`scope`·`display: standalone`·`categories`·**maskable 아이콘**·
  **스크린샷**·앱 바로가기까지 TWA 요건 충족
- 서비스 워커(`sw.js`) — 오프라인 동작
- HTTPS 호스팅, 개인정보처리방침(`privacy.html`)
- 스토어 자산 — `store/android/` 아래에 준비해뒀다(아래 목록 참고)

---

## Step 1 — TWA 프로젝트 생성

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://note-my-coffee.web.app/manifest.json
```

물어보는 값들:

| 질문 | 답 |
|---|---|
| Package name | `app.web.note_my_coffee` ← **`assetlinks.json`과 반드시 같아야 한다** |
| App name | Note My Coffee |
| Display mode | `standalone` |
| Signing key | 새로 생성(경로·비밀번호는 반드시 따로 보관 — 잃으면 업데이트 불가) |

```bash
bubblewrap build      # app-release-bundle.aab 생성
```

## Step 2 — Digital Asset Links 연결 ⚠️ 가장 흔한 실패 지점

이게 틀리면 앱을 열었을 때 **주소창이 그대로 보인다**(앱처럼 안 보임).

1. **SHA-256 지문을 얻는다.**
   - Play App Signing을 쓰면(권장) → Play Console → 앱 → **설정 › 앱 서명**에서
     "앱 서명 키 인증서"의 SHA-256을 복사한다.
   - 로컬 키를 쓰면 → `bubblewrap fingerprint list`
   - 두 키는 다르다. **Play가 재서명하므로 반드시 Play Console 쪽 지문**을 써야 한다.

2. **`.well-known/assetlinks.json`** 에서 `REPLACE_WITH_...` 자리를 그 지문으로 교체한다.

3. 배포 후 확인:
   ```bash
   curl -s https://note-my-coffee.web.app/.well-known/assetlinks.json
   ```
   우리가 쓴 JSON(패키지명과 지문이 든)이 나와야 한다.

> ### ⚠️ Firebase Hosting의 함정 두 가지 (실제로 겪었다)
>
> **1) 빈 배열 `[]`이 응답된다면** — Firebase Hosting은 이 경로를 **자체적으로
> 자동 생성해서 제공한다.** Firebase 프로젝트에 안드로이드 앱이 등록돼 있지 않으면
> 빈 배열을 돌려주고, 이 자동 응답이 `rewrites`보다 우선한다. 그래서 rewrite로는
> 해결되지 않는다 — **정적 파일이 rewrite보다 우선순위가 높으므로 실제 파일을
> `.well-known/`에 둔다**(지금 구조).
>
> 그래도 `[]`가 계속 나오면, 대안으로 **Firebase 콘솔에서 안드로이드 앱을 등록**하면
> 된다(프로젝트 설정 › 내 앱 › Android 추가 → 패키지명 `app.web.note_my_coffee` +
> SHA-256 입력). 그러면 Firebase가 올바른 assetlinks를 자동 생성한다. 둘 중
> **동작하는 쪽 하나만** 쓰면 된다.
>
> **2) `ignore`의 `"**/.*"`** — 점으로 시작하는 경로를 배포에서 제외하는 패턴이라
> `.well-known/`이 통째로 빠질 위험이 있었다. 그래서 이 패턴을 없애고 `.git/**`·
> `.github/**` 등 **실제 제외할 것만 명시**로 바꿨다. 새 dot 디렉터리를 만들면
> 배포에 포함되니, 비공개로 둬야 하면 `ignore`에 직접 추가해야 한다.
>
> `headers`로 `Content-Type: application/json`도 강제한다(검증기가 엄격하다).

## Step 3 — Play Console 등록

앱 만들기 → 아래 자산을 넣는다. 전부 `store/android/`에 준비돼 있다.

| 항목 | 파일 / 값 | 요건 |
|---|---|---|
| 앱 아이콘 | `icon-512.png` | 512×512 PNG |
| 피처 그래픽 | `store/android/feature-graphic.png` | 1024×500 **필수** |
| 휴대전화 스크린샷 | `store/android/phone-1-record.png`, `phone-2-logbook.png` | **최소 2장**, PNG/JPEG |
| 태블릿 스크린샷 | `store/android/tablet-1-record.png` | 선택 |
| 개인정보처리방침 | `https://note-my-coffee.web.app/privacy.html` | **필수** |

> 원본 스크린샷은 `img/*.webp`인데 **Play Console은 WebP를 받지 않는다.**
> 그래서 PNG로 변환해 뒀다. 화면을 바꾸면 다시 변환해야 한다.
>
> 피처 그래픽을 한글 카피로 바꾸려면 `store/android/feature-graphic.html`의
> 텍스트를 고치고 1024×500으로 스크린샷하면 된다.

---

## 스토어 등록 문안 (초안)

**앱 이름** (30자 이내)
```
Note My Coffee - 커피 추출 기록
```

**간단한 설명** (80자 이내)
```
도징·온도·시간·수율 네 숫자만 남기면, 어제 맛있던 그 커피를 오늘 그대로 재현합니다.
```

**자세한 설명** (4000자 이내)
```
■ 커피 맛이 매번 다른 건, 실력이 아니라 기억의 문제입니다

커피 한 잔에는 최소 네 개의 변수가 있습니다. 도징·물온도·추출시간·수율.
여기에 원두와 분쇄도까지 더하면 조합은 수백 가지가 됩니다.
사람의 기억은 그걸 버티지 못합니다 — 사흘이면 흐려지고, 원두가 바뀌면 처음으로 돌아갑니다.

Note My Coffee는 바리스타가 만든 커피 추출 기록 앱입니다.
네 개의 숫자만 남기면, 다음 다이얼링의 출발점이 생깁니다.

■ 주요 기능

· 에스프레소 / 핸드드립 기록
  슬라이더로 도징·온도·시간·수율을 맞추면 SCA 권장 범위에 들었는지 실시간으로 알려줍니다.

· 내장 스톱워치
  폰 스톱워치를 따로 켤 필요 없이, 추출과 동시에 시간이 기록됩니다.

· 로그북
  원두별·날짜별로 쌓인 기록을 한눈에 봅니다. 성공한 세팅을 다시 꺼내 쓰세요.

· 30초 취향 검사
  질문 네 개에 답하면 커피 취향 프로필과 어울리는 원두를 추천해드립니다.

· 레시피 공유
  잘 나온 한 잔을 카드 이미지로 만들어 공유할 수 있습니다.

■ 이런 분께

· 홈카페를 시작했지만 매번 맛이 달라 헤매는 분
· 원두를 바꿀 때마다 처음부터 다시 잡는 게 번거로운 분
· 내 취향의 원두가 무엇인지 아직 모르는 분
· 좋았던 한 잔을 다시 만들고 싶은 분

■ 무료입니다

기록, 로그북, 취향 검사 전부 무료이며 결제 단계가 없습니다.
로그인 없이도 바로 기록할 수 있고, 로그인하면 기기 간에 동기화됩니다.
```

---

## 정책 대응

### 데이터 보안(Data safety) 양식

Play Console이 묻는 항목이다. 이 앱이 실제로 수집하는 것:

| 데이터 | 수집 | 목적 | 필수 여부 |
|---|---|---|---|
| 이메일 주소 | 예 | 계정 관리, 앱 기능 | 로그인 시에만 |
| 이름 | 예 | 계정 관리 | 로그인 시에만 |
| 사진 | 예 | 앱 기능(레시피 사진) | 선택 |
| 앱 활동/분석 | 예 | 분석 | 자동 |

- 전송 중 암호화: **예**(HTTPS)
- 데이터 삭제 요청 경로 제공: **예** — 로그아웃·기록 삭제로 가능하며,
  계정 삭제 문의는 `privacy.html`의 연락처를 쓴다.
- 로그인하지 않으면 기록은 기기(localStorage)에만 남고 서버로 가지 않는다.

### 결제 정책 — 앱에서는 후원 섹션이 숨는다

Google Play·Apple 모두 **앱 안의 디지털 결제는 자사 결제를 강제**한다.
랜딩의 토스페이먼츠 후원 섹션이 앱에 보이면 정책 위반이 될 수 있어,
`landing.js`가 설치된 앱으로 열렸을 때(`android-app://` referrer 또는
`display-mode: standalone`) 해당 섹션을 DOM에서 들어낸다. 웹에서는 그대로 보인다.

나중에 앱에서 실제로 후원을 받으려면 **Play Billing(인앱 결제)** 을 붙여야 한다.

### 콘텐츠 등급

설문에서 폭력·성적 콘텐츠·도박 전부 "아니오" → **전체이용가(3+)** 로 나온다.

---

## iOS는 왜 미뤘나

지금 **Mac이 없어** iOS 빌드가 불가능하다(Xcode는 macOS 전용). 클라우드 빌드
서비스(Codemagic·EAS 등)로 우회할 수 있지만 비용과 설정이 추가된다.

기술적으로도 iOS는 안드로이드보다 훨씬 무겁다. 나중에 진행할 때 **반드시 먼저
풀어야 할 세 가지**:

1. **구글 로그인이 앱 안에서 깨진다.** 현재 `signInWithPopup`을 쓰는데
   iOS 웹뷰(WKWebView)에서는 동작하지 않는다. 이미 iOS Safari에서
   `missing initial state` 오류가 나고 있다(저장소 파티셔닝 때문).
   → Capacitor의 네이티브 구글 로그인 플러그인으로 교체해야 한다.

2. **App Store 심사 규정 4.2 (Minimum Functionality).** "웹사이트를 그대로
   감싼 앱"은 리젝된다. 네이티브 기능을 최소 1~2개 붙여야 한다.
   이 앱에 자연스러운 것: **추출 타이머의 백그라운드 알림**(스톱워치가 이미 있다),
   **햅틱 피드백**, 네이티브 카메라.

3. **비용** — Apple Developer Program은 **$99/년**(안드로이드와 달리 매년).

권장 경로는 PWABuilder의 iOS 패키지가 아니라 **Capacitor**다. 전자는 단순
웹뷰 래퍼라 4.2로 리젝될 확률이 높다.
