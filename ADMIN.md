# 관리자 페이지 (`admin.html`)

서비스 운영 지표를 보는 대시보드. 기록 추이, 사용자 수, 모드 분포, 평점 분포,
인기 원두, 최근 기록을 한 화면에서 본다.

## 열기

| 목적 | 주소 |
|---|---|
| 실제 데이터 | `/admin.html` — 구글 로그인 후 조회 |
| 디자인 확인 | `/admin.html?demo=1` — 가짜 데이터, 로그인·Firestore 불필요 |

기간 필터(7 / 30 / 90일 / 전체)는 아래 모든 지표를 같은 구간으로 스코프한다.
차트마다 `표로 보기`가 있어서 모든 값은 표로도 읽을 수 있다.

## 접근 제어 — 여기가 핵심

관리자는 `admin.js` 맨 위의 `ADMIN_EMAILS` 한 곳에서 정한다. 현재 등록된 계정은
`qorlgh1994@gmail.com` **하나뿐**이고, 통과 조건은 세 가지를 모두 만족할 때다.

- 구글(`google.com`) 계정으로 로그인했을 것
- `emailVerified`가 참일 것
- 이메일이 `ADMIN_EMAILS`에 있을 것

구글 로그인을 요구하는 이유는, 이메일/비밀번호 계정은 같은 주소를 스스로 지어낼 수
있기 때문이다. 그런 계정은 `emailVerified`가 거짓으로 남아 두 번째 조건에서 걸린다.

**카카오 로그인으로는 이 대시보드에 들어올 수 없다.** 일반 사용자용 로그인에는
카카오가 추가됐지만(`auth-ui.js`), 관리자 판정은 `providerId === 'google.com'`을 그대로
요구한다. 카카오 쪽에서는 이메일 동의항목을 아예 요청하지 않기 때문에 `email`이 비어
있고, `ADMIN_EMAILS` 대조 자체가 성립하지 않는다. 그래서 `admin.html`의 로그인 버튼도
제공자 선택 시트를 거치지 않고 구글로 바로 붙는다 — 의도된 동작이다.

다만 **이 검사는 화면을 가리는 용도일 뿐 보안 장치가 아니다.** 클라이언트 코드는
누구나 읽고 고칠 수 있다. 실제 차단은 **Firestore 보안 규칙**이 한다.

즉 두 곳을 모두 손봐야 한다.

1. **`admin.js`의 `ADMIN_EMAILS`** — 화면 노출 제어 (이미 설정됨)
2. **Firestore 규칙에 관리자 전체 읽기 허용** — 실제 권한 (콘솔에서 직접 해야 함)

권한 없는 계정으로 로그인하면 현재 계정을 화면에 보여주고, `다른 계정으로 로그인`
버튼으로 로그아웃 후 다시 시도할 수 있다.

### 필요한 규칙

현재 저장소에는 `firestore.rules` 파일이 없다(= 콘솔에서 직접 관리 중이라는 뜻).
아래는 이 대시보드가 동작하기 위해 필요한 최소 형태이며, 클라이언트와 같은
세 조건을 그대로 건다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
          && request.auth.token.email == 'qorlgh1994@gmail.com'
          && request.auth.token.email_verified == true
          && request.auth.token.firebase.sign_in_provider == 'google.com';
    }

    match /recipes/{recipeId} {
      // 관리자는 전체 조회, 일반 사용자는 자기 것만
      allow read: if isAdmin()
                  || (request.auth != null && resource.data.userId == request.auth.uid);

      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid;

      allow update, delete: if request.auth != null
                            && resource.data.userId == request.auth.uid;
    }

    // 랜딩 사회적 증거용 공개 집계. 숫자 하나만 들어있고 개인정보는 없다.
    // recipes는 계속 비공개이며, 이 문서는 관리자만 쓸 수 있다.
    match /public_stats/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // ── 집계 (docs/admin-roadmap.md Phase 1) ──
    // 대시보드가 recipes를 통째로 내려받지 않게 하려고 저장 시점에 카운터를 올린다.
    // 규칙이 없으면 집계가 조용히 실패하고 대시보드는 예전 전체 스캔으로 떨어진다.

    // 일별 카운터. 로그인한 사용자가 자기 기록을 저장할 때 올린다.
    // 읽기는 관리자만 — 문서 안에 사용자별 기록 수(uc)가 들어 있다.
    match /stats_daily/{day} {
      allow read: if isAdmin();
      allow write: if request.auth != null;
    }

    // 사용자별 첫/마지막 활동과 기록 수. 본인 것만 쓰고, 관리자는 전체를 읽는다.
    match /users/{userId} {
      allow read: if isAdmin() || (request.auth != null && request.auth.uid == userId);
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // 원두 이름 사전(집계 표시용). 개인정보가 없다.
    match /stats_beans/{beanId} {
      allow read: if isAdmin();
      allow write: if request.auth != null;
    }
  }
}
```

> `stats_daily`·`stats_beans`의 쓰기를 로그인 사용자 전체에게 여는 이유는, 집계가
> **저장하는 본인의 클라이언트에서** 올라가기 때문이다(Cloud Functions를 쓰지 않는 대신
> 치르는 비용). 카운터만 들어 있고 남의 레시피 내용은 볼 수 없지만, 악의적 사용자가
> 카운터를 부풀릴 수는 있다. 수치가 이상하면 대시보드의 **집계 재생성**으로 원본에서
> 다시 만들 수 있다.

> **주의**: 규칙 배포는 기존 규칙을 통째로 대체한다. 지금 콘솔에 들어있는 규칙을
> 먼저 확인하고 위 내용을 병합해서 올려야 한다. 그래서 이 저장소에는 `firestore.rules`를
> 만들어두지 않았고 `firebase.json`에도 연결하지 않았다 — `firebase deploy`가 모르는 사이에
> 규칙을 덮어쓰는 사고를 막기 위해서다.

### 랜딩 누적 기록 수 (`public_stats/landing`)

랜딩 히어로의 "지금까지 기록된 추출 N회"는 이 문서 하나만 읽는다.
`recipes`는 사용자 데이터라 익명 공개가 불가능하므로, **이미 전체를 읽고 있는
이 대시보드가 접속할 때마다 숫자만 공개 문서에 기록한다**(`admin.js`).
따라서 수치는 *마지막 관리자 접속 시점 기준*이며, 대시보드를 한 번도 열지 않으면
문서가 없어 랜딩에서는 아무것도 표시되지 않는다.

- 노출 최소 기준은 `landing.js`의 `MIN_STAT_TO_SHOW`(기본 100). 미만이면 감춘다.
- 문서가 없거나 읽기에 실패하면 요소를 숨긴 채 둔다 — `0회`를 노출하지 않는다.

규칙이 관리자 전체 읽기를 허용하지 않으면 대시보드는 `permission-denied`로 실패하고,
화면에 그 사실과 현재 UID를 띄운다.

관리자를 추가하려면 `ADMIN_EMAILS` 배열과 위 규칙의 `isAdmin()` **양쪽 모두**에
주소를 넣어야 한다. 한쪽만 고치면 화면은 열리는데 데이터가 안 나오거나(규칙 누락),
데이터 권한은 있는데 화면이 막힌다(배열 누락).

## 사용자 상세 (목록 + 드릴다운)

`활성화·유지 퍼널` 아래 **사용자** 카드는 기록을 남긴 계정을 한 행씩 보여준다.
기간 필터와 무관한 **누적 로스터**이며(휴면 카드와 같은 현재 시점 관점), `기록순`
버튼으로 `최근순`과 토글한다.

- 집계 경로에서는 `users` 컬렉션을, 폴백/데모에서는 `recipes`를 사용자별로 묶어 만든다.
- **행을 누르면** 그 사용자의 개인 지표(총 기록·평균 평점·성공률·에스프레소 비중)와
  **레시피 이력 표**를 모달로 연다. 스캔/데모 경로는 이미 받아둔 전체에서 걸러 추가
  조회가 없고, 집계 경로에서만 `where('userId','==',uid)` 단일 조건으로 그 사용자
  것만 라이브로 읽는다(단일 필드 조건이라 복합 색인이 필요 없다).

### 사용자 식별 — 이름·이메일

레시피에는 `userId`(uid)만 있어 원래는 사용자를 uid로만 구분할 수 있었다. 그래서
저장 시점 집계(`storage.js`의 `bumpAggregates`)가 이제 `users` 문서에 `displayName`·
`email`을 함께 남긴다. **본인이 자기 `users` 문서에 쓰는 것**이라 규칙 변경은 필요 없다
(`users` 쓰기는 이미 본인에게 열려 있다). 값이 없으면(제공자가 안 준 경우) 남기지 않아
빈 값으로 기존 이름을 덮어쓰지 않는다.

- **소급 적용은 안 된다.** 기존 사용자는 *다음 저장*부터 이름이 붙는다. 클라이언트
  SDK로는 남의 Auth 계정을 읽을 수 없어, 다시 저장하지 않는 사용자는 uid로 남는다.
- `집계 재생성`은 `users`를 `{ merge: true }`로 써서 이미 저장된 이름/이메일을 지우지
  않는다(백필은 `recipes`만 읽어 이름을 알 수 없으므로).
- **개인정보 주의**: `users` 문서에 이메일이 담기지만 읽기는 관리자와 본인뿐이다
  (규칙의 `users` read = `isAdmin() || 본인`).

## 알아둘 한계

- **전체 문서를 브라우저로 내려받아 집계한다.** `recipes` 컬렉션을 통째로 읽기
  때문에 문서가 수천 건을 넘어가면 느려지고 읽기 비용도 그만큼 든다. 레시피에는
  `imageUrl`이 base64로 최대 1MB까지 들어갈 수 있어서 실제 전송량은 문서 수보다
  훨씬 크다. (내려받은 뒤 `imageUrl`은 바로 버려서 메모리에는 남기지 않지만,
  **다운로드 자체를 피할 수는 없다** — 클라이언트 SDK에는 필드 선택 기능이 없다.)
  기록이 쌓이면 Cloud Functions에서 일별 집계 문서를 만들어두고 대시보드는 그것만
  읽는 구조로 옮기는 게 맞다.
  → Functions는 Blaze(유료) 플랜이 필요하다. **쓰기 시점 집계로 Functions 없이 가는
  더 싼 경로**와 규모 추정치를 [`docs/admin-roadmap.md`](docs/admin-roadmap.md)에
  정리해뒀다.
- **로그인 없이 저장된 레시피는 집계에 안 잡힌다.** 게스트 기록은 localStorage에만
  있고 Firestore에 올라오지 않는다. 로그인 시 `migrateLocalToCloud()`로 넘어온
  것만 보인다.
- **`성공률`은 사용자가 직접 누른 성공/실패 버튼 기준**이다. 추출 품질의 객관적
  지표가 아니라 자기 평가다.

## 차트 규칙

색은 눈대중으로 고르지 않았다. 시리즈 색·평점 램프 모두 대비/색각 검증을
통과한 값이며 라이트·다크 각각 따로 검증했다.

- 에스프레소 `#ac7c33` / 핸드드립 `#1d5f92`(다크 `#0476bf`) — 정체성을 나타내는 2색
- 평점 1~5는 **순서가 있는** 값이라 한 색상의 명도 램프를 쓴다
- 인기 원두는 **순서가 없는** 이름이라 전부 같은 색 — 크기는 막대 길이가 말한다

색을 바꿀 일이 생기면 눈으로 판단하지 말고 검증기를 돌릴 것.
