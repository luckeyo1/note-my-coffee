# Note My Coffee — 갤럭시 워치(Wear OS) 앱

손목에서 추출 타이머를 돌리고 숫자 네 개(도징·온도·시간·수율)를 기록한다.
웹 로그북과 **페어링 코드**로 연결하면 워치 기록이 계정 로그북에 바로 쌓인다.
설계와 배포 절차 전체는 [`docs/wearable.md`](../docs/wearable.md).

- Kotlin + Compose for Wear OS, minSdk 30 (Wear OS 3 — Galaxy Watch4 이후)
- 패키지명 `app.web.note_my_coffee` — 폰 앱(TWA)과 같은 Play 등록정보에 올린다
- Firebase Auth(익명) + Firestore

## 화면

| 화면 | 하는 일 |
|---|---|
| 홈 | 에스프레소 / 핸드드립 선택, 연결 상태·동기화 대기 건수 |
| 타이머 | 화면 아무 데나 탭 = 시작/정지. 권장 구간(25–35초, 드립 2:00–4:00)과 드립 뜸(30초)에서 진동 |
| 기록 | 숫자 네 개(탭 → 크라운/베젤로 0.1 단위), 원두(키보드·음성), 성공 여부, 저장 |
| 연결 | 6자리 코드 표시 → 폰 로그북 › 설정 › **워치 연결**에 입력 |

연결 전에 저장한 기록은 워치에 보관했다가 연결되는 순간 올라간다.

## 처음 빌드하기

1. **Android Studio**(Ladybug 이상)를 설치하고 이 `wear/` 폴더를 연다.
2. **Firebase 콘솔** → 프로젝트 `note-my-coffee` → 프로젝트 설정 → 내 앱 → **Android 앱 추가**
   - 패키지명: `app.web.note_my_coffee`
   - SHA-1: 디버그 키는 `./gradlew signingReport`로 확인
   - 받은 `google-services.json`을 `wear/app/`에 둔다(**커밋하지 않는다** — `.gitignore`에 있음)
3. Firebase 콘솔 → Authentication → 로그인 방법 → **익명** 사용 설정
4. Firestore 규칙 게시 — 저장소 루트의 `firestore.rules`(워치 규칙 포함)를 콘솔에 반영
5. 실행 ▶ (Wear OS 에뮬레이터: Device Manager → Wear OS Large Round, API 33+)

명령줄:

```bash
cd wear
./gradlew :app:assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:bundleRelease        # Play 업로드용 AAB (keystore.properties 필요)
```

## 실제 갤럭시 워치에 설치(사이드로드)

1. 워치: 설정 → 워치 정보 → 소프트웨어 정보 → **소프트웨어 버전 7번 탭** → 개발자 옵션 켜짐
2. 개발자 옵션 → **ADB 디버깅** + **무선 디버깅** 켜기 → 표시된 IP:포트 확인
3. PC(워치와 같은 Wi‑Fi):
   ```bash
   adb pair <IP>:<페어링포트>     # 워치에 뜬 페어링 코드 입력
   adb connect <IP>:<포트>
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

CI(`.github/workflows/wear-build.yml`)가 `wear/`가 바뀔 때마다 디버그 APK를 만들어
아티팩트(`wear-debug`)로 올린다. 저장소 시크릿 `WEAR_GOOGLE_SERVICES_JSON`에
`google-services.json` 전문을 넣어두면 그 APK가 실제 Firebase에 붙는다.

## 릴리스 서명

`wear/keystore.properties`(커밋 금지):

```properties
storeFile=../upload-key.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

폰 TWA와 **같은 업로드 키**를 써도 되고 따로 만들어도 된다(Play 앱 서명이 최종 서명을 한다).
`versionCode`는 폰 앱과 겹치면 업로드가 거부되므로 워치는 2,000,000번대를 쓴다.
