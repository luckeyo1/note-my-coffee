# 보안 규칙 테스트 (Firestore + Storage)

`firestore.rules`·`storage.rules`를 **로컬 에뮬레이터**에 올려 §8/§9/§12 시나리오를
자동 검증한다. 실데이터·운영 프로젝트에 전혀 영향 없다(무료, `demo-*` 프로젝트 ID 사용).

## 실행

리포지토리 루트에서:

```bash
# 1) 도구 설치(1회). 루트 package.json은 건드리지 않도록 별도 폴더에 설치해도 된다.
npm i -D firebase-tools firebase @firebase/rules-unit-testing

# 2) Firestore 규칙 (36 케이스)
npx firebase emulators:exec --project demo-nmc --only firestore \
  "node tests/rules/firestore.rules.test.mjs"

# 3) Storage 규칙 (8 케이스)
npx firebase emulators:exec --project demo-nmc --only storage \
  "node tests/rules/storage.rules.test.mjs"
```

`firebase.json`에 이미 `firestore`/`storage`/`emulators` 블록이 있어 에뮬레이터가
규칙을 자동으로 로드한다. 첫 실행 때 에뮬레이터 JAR을 내려받는다(수백 MB, 1회).

## 무엇을 확인하나

**Firestore (36):** 비공개 게시물 비소유자 차단, 공개/unlisted get, 피드는 public+active만
열거(unlisted·전체 열거 거부), 생성 시 ownerId 위조·hiddenByAdmin 위조·비로그인·제목
초과 거부, 수정 시 ownerId·hiddenByAdmin 변경 거부와 관리자숨김 되돌리기 거부(§9),
관리자 숨김/해제, 삭제 권한, reports(생성만·열람 관리자), blocks(본인만),
profiles(공개 읽기·본인 쓰기·길이 제한), 기존 recipes·users 회귀.

**Storage (8):** 커버 사진 공개 읽기, 경로 uid 소유자만 업로드/삭제, 비로그인·타인 거부,
이미지 아닌 contentType 거부, 5MB 초과 거부.

## 결과(2026-10-07 기준)
- Firestore: **36 passed, 0 failed**
- Storage: **8 passed, 0 failed**

> 규칙 파일을 고치면 이 테스트를 다시 돌려 통과를 확인한 뒤 콘솔/CLI로 게시한다.
