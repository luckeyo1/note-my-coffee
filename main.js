// main.js
import {
    auth,
    signOut,
    onAuthStateChanged,
    track,
    bumpVisit
} from "./firebase-config.js";
import { signInWithChooser } from "./auth-ui.js";
import CoffeeNotesStorage from "./storage.js";

document.addEventListener('DOMContentLoaded', () => {
    // 앱 페이지는 지금까지 GA4 히트가 0건이었다 — track()이 처음 호출될 때만
    // getAnalytics()가 실행되는 구조라 자동 page_view조차 발생하지 않았다.
    track('app_page_view', { page: 'app' });
    // 방문은 GA4와 별개로 Firestore에도 센다 — 관리자 대시보드가 읽는 건 여기다.
    bumpVisit('app');

    let currentMode = 'espresso';
    let currentLang = 'en';
    let successResult = false;
    let uploadedImageData = ''; // Base64 image string
    let audioCtx = null;

    const compressImage = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.72) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = (e) => reject(e);
            };
            reader.onerror = (e) => reject(e);
        });
    };

    // 레시피 저장 시 함께 기록되는 날씨 문자열 (HTML이 아닌 순수 텍스트).
    let lastWeatherText = '';

    const i18n = {
        en: {
            dosing: "DOSING", temp: "WATER TEMP", time: "EXTRACTION TIME", yield: "YIELD",
            save: "LOG THIS RECIPE",
            weather: "📍 Getting location...",
            locationDenied: "📍 Location denied",
            weatherError: "📍 Weather unavailable",
            viewLogbook: "LOG BOOK",
            brandTagline: "Turn extraction into science",
            lblLogin: "Sign in",
            modalBeanStatus: "BEAN STATUS", statusNew: "🆕 NEW BAG", statusOpen: "📦 OPENED",
            modalBeanName: "BEAN NAME", modalOrigin: "ORIGIN", modalPurchaseUrl: "PURCHASE URL",
            modalImageUrl: "COVER PHOTO", modalTasteNotes: "TASTING NOTES",
            modalOverallRating: "RATING", modalSuccessFail: "RESULT",
            modalSave: "Save Recipe →", modalCancel: "Cancel",
            recipeSavedSuccess: "Recipe logged! Opening logbook...",
            recipeSavedFail: "Failed to save recipe.",
            confirmExitModal: "Discard this recipe?",
            progressLabel: "RECIPE COMPLETENESS",
            progressHint: "Add bean name to complete",
            proHintDosing: "Pro range: {min}–{max}g",
            proHintTemp: "Pro range: {min}–{max}°C",
            proHintTime: "Pro range: {min}–{max}sec",
            proHintTimeDrip: "Pro range: {min}–{max}",
            proHintYield: "Brew ratio: 1:{ratio}",
            ratioLabel: "BREW RATIO",
            ratioIdeal: "✓ SCA recommended",
            ratioWarning: "⚡ Adjust for balance",
            savingNudge: "Unsaved recipes are lost forever",
            modalTitle: "Complete Your Recipe",
            modalSubtitle: "Adding bean info lets you recreate this cup perfectly",
            trustPrefix: "Pro Barista Edition · ",
            trustSuffix: " recipes logged today",
            selectPhoto: "📷 Choose Photo",
            photoSelected: "✓ Photo Selected",
            swStart: "START", swStop: "STOP", swRestart: "RESTART", swApply: "APPLY", swReset: "RESET",
            swStatusReady: "READY", swStatusRunning: "RUNNING", swStatusDone: "DONE",
            swHintReady: "Press START to begin extraction",
            swHintRunning: "Extracting… press STOP to record",
            swHintUnder: "⚡ {time} — possible under-extraction",
            swHintOver: "⚡ {time} — possible over-extraction",
            swHintIdeal: "✓ {time} — within SCA range",
            swApplied: "✓ {time} — applied to extraction time",
            swBtnOpen: "⏱ OPEN STOPWATCH", swBtnClose: "⏱ CLOSE STOPWATCH",
            scaTitle: "SCA BREWING GUIDE",
            scaGuide: {
                espresso: {
                    dosing: {
                        std: "Pro standard: 18–21g in a double basket",
                        up: { l: "More", t: "stronger, heavier body — but same grind & time can under-extract, turning sour." },
                        down: { l: "Less", t: "lighter body, faster flow — extraction climbs and can turn bitter." },
                        note: "Adjust in 0.5g steps and keep your brew ratio in mind."
                    },
                    temp: {
                        std: "SCA standard: 90.5–96.1°C (195–205°F)",
                        up: { l: "Hotter", t: "faster extraction — more bitterness and roasty notes. Suits light roasts." },
                        down: { l: "Cooler", t: "slower extraction — brighter but can taste sour and thin. Suits dark roasts." }
                    },
                    time: {
                        std: "Typical espresso shot: 25–30 sec",
                        up: { l: "Longer", t: "over-extraction — bitter, astringent, dry finish." },
                        down: { l: "Shorter", t: "under-extraction — sour, salty, weak sweetness." },
                        note: "Time follows grind size — adjust the grind first, not the clock."
                    },
                    yield: {
                        std: "Industry norm: 1:2 ratio (18g in → 36g out)",
                        up: { l: "More (lungo)", t: "higher extraction, lighter body — sweetness first, then bitterness." },
                        down: { l: "Less (ristretto)", t: "syrupy and intense, acidity-forward — less total extraction." }
                    }
                },
                drip: {
                    dosing: {
                        std: "SCA Golden Cup: 55g/L ±10% (≈1:15–1:18)",
                        up: { l: "More", t: "stronger, heavier cup — the ratio tightens and can taste dense, under-extracted." },
                        down: { l: "Less", t: "lighter, tea-like cup — easier to over-extract into bitterness." }
                    },
                    temp: {
                        std: "SCA standard: 90.5–96.1°C (195–205°F)",
                        up: { l: "Hotter", t: "faster extraction — more bitterness and roasty notes. Suits light roasts." },
                        down: { l: "Cooler", t: "slower extraction — brighter but can taste sour and weak. Suits dark roasts." }
                    },
                    time: {
                        std: "SCA total brew time: 2–4 min (pour-over)",
                        up: { l: "Longer", t: "more contact — bitterness and astringency build up." },
                        down: { l: "Shorter", t: "under-developed — sour, weak, low sweetness." },
                        note: "Grind size is the main lever: finer = slower, coarser = faster."
                    },
                    yield: {
                        std: "SCA Golden Cup ratio: 1:15–1:18",
                        up: { l: "More water", t: "weaker, thinner cup — flavors get diluted." },
                        down: { l: "Less water", t: "stronger cup, but extraction can end uneven — heavy and muddled." }
                    }
                }
            },
            originTags: ["Ethiopia", "Colombia", "Brazil", "Kenya", "Guatemala", "Indonesia", "Costa Rica", "Panama"],
            tasteTags: ["Floral", "Fruity", "Nutty", "Chocolaty", "Sweet", "Acidic", "Bitter", "Spicy"],
            obSteps: [
                { title: "Pick Your Brew Mode", desc: "Start with Espresso or Hand Drip — pro ranges and guides adapt to your method." },
                { title: "Dial In the Variables", desc: "Set dosing, water temp, time and yield with the sliders. Tap ⓘ for the SCA guide, or time your shot with the built-in stopwatch." },
                { title: "Log the Recipe", desc: "Hit LOG THIS RECIPE and add bean info & tasting notes. Your first cup logs without an account — sign in with Google to keep every brew in the cloud." },
                { title: "Review & Share", desc: "Revisit every brew in your LOG BOOK and share recipes as cards. You can reopen this guide anytime with the ? button up top." }
            ],
            obSkip: "Skip",
            obNext: "Next →",
            obDone: "Start Brewing ☕"
        },
        ko: {
            dosing: "도징량", temp: "물 온도", time: "추출 시간", yield: "추출 량",
            save: "레시피 기록하기",
            weather: "📍 위치 확인 중...",
            locationDenied: "📍 위치 접근 거부",
            weatherError: "📍 날씨 정보 없음",
            viewLogbook: "로그북",
            brandTagline: "당신의 추출을 과학으로",
            lblLogin: "로그인",
            modalBeanStatus: "원두 상태", statusNew: "🆕 새 원두", statusOpen: "📦 개봉 중",
            modalBeanName: "원두 이름", modalOrigin: "원산지", modalPurchaseUrl: "구매처 URL",
            modalImageUrl: "겉표지 사진", modalTasteNotes: "테이스팅 노트",
            modalOverallRating: "평점", modalSuccessFail: "결과",
            modalSave: "레시피 저장하기 →", modalCancel: "취소",
            recipeSavedSuccess: "레시피가 기록되었습니다! 로그북으로 이동합니다...",
            recipeSavedFail: "레시피 저장 실패.",
            confirmExitModal: "이 레시피를 버리겠습니까?",
            progressLabel: "레시피 완성도",
            progressHint: "원두 이름을 기록하면 완성됩니다",
            proHintDosing: "프로 범위: {min}–{max}g",
            proHintTemp: "프로 범위: {min}–{max}°C",
            proHintTime: "프로 범위: {min}–{max}초",
            proHintTimeDrip: "프로 범위: {min}–{max}",
            proHintYield: "브루 비율: 1:{ratio}",
            ratioLabel: "브루 레이시오",
            ratioIdeal: "✓ SCA 권장 범위",
            ratioWarning: "⚡ 균형을 위해 조정 필요",
            savingNudge: "지금 기록하지 않으면 이 레시피는 사라집니다",
            modalTitle: "레시피 완성하기",
            modalSubtitle: "원두 정보를 추가하면 나중에 재현할 수 있습니다",
            trustPrefix: "Pro Barista Edition · 오늘 ",
            trustSuffix: "개의 레시피가 기록되었습니다",
            selectPhoto: "📷 사진 선택하기",
            photoSelected: "✓ 사진 선택됨",
            swStart: "시작", swStop: "정지", swRestart: "재시작", swApply: "적용", swReset: "리셋",
            swStatusReady: "준비", swStatusRunning: "추출 중", swStatusDone: "완료",
            swHintReady: "시작을 누르고 추출을 시작하세요",
            swHintRunning: "추출 중... 정지를 누르면 기록됩니다",
            swHintUnder: "⚡ {time} — 과소추출 가능성",
            swHintOver: "⚡ {time} — 과다추출 가능성",
            swHintIdeal: "✓ {time} — SCA 권장 범위 내",
            swApplied: "✓ {time} — 추출 시간에 반영되었습니다",
            swBtnOpen: "⏱ 스톱워치 열기", swBtnClose: "⏱ 스톱워치 닫기",
            scaTitle: "SCA 추출 가이드",
            scaGuide: {
                espresso: {
                    dosing: {
                        std: "프로 기준: 더블 바스켓 18–21g",
                        up: { l: "늘리면", t: "바디가 진하고 무거워집니다. 분쇄도·시간이 그대로면 과소추출로 신맛이 날 수 있어요." },
                        down: { l: "줄이면", t: "바디가 가벼워지고 흐름이 빨라져 과다추출(쓴맛) 위험이 커집니다." },
                        note: "0.5g 단위로 조정하고 브루 비율을 함께 확인하세요."
                    },
                    temp: {
                        std: "SCA 표준: 90.5–96.1°C (195–205°F)",
                        up: { l: "높이면", t: "추출이 빨라져 쓴맛과 로스팅 향이 강해집니다. 라이트 로스트에 적합해요." },
                        down: { l: "낮추면", t: "추출이 느려져 산미는 살지만 시고 밍밍해질 수 있어요. 다크 로스트에 적합해요." }
                    },
                    time: {
                        std: "일반적인 에스프레소 샷: 25–30초",
                        up: { l: "길어지면", t: "과다추출 — 쓰고 떫으며 피니시가 건조해집니다." },
                        down: { l: "짧아지면", t: "과소추출 — 시고 짜며 단맛이 부족해집니다." },
                        note: "추출 시간은 분쇄도의 결과입니다. 시계보다 분쇄도를 먼저 조정하세요."
                    },
                    yield: {
                        std: "업계 표준 비율: 1:2 (원두 18g → 36g 추출)",
                        up: { l: "늘리면 (룽고)", t: "추출률이 올라가고 바디는 가벼워져, 단맛 뒤로 쓴맛이 따라옵니다." },
                        down: { l: "줄이면 (리스트레토)", t: "시럽처럼 진하고 산미가 도드라지며, 전체 추출률은 낮아집니다." }
                    }
                },
                drip: {
                    dosing: {
                        std: "SCA 골든컵: 물 1L당 55g ±10% (≈1:15–1:18)",
                        up: { l: "늘리면", t: "진하고 묵직한 컵 — 비율이 좁아져 텁텁하고 과소추출된 맛이 날 수 있어요." },
                        down: { l: "줄이면", t: "가볍고 차 같은 컵 — 과다추출로 쓴맛이 나기 쉬워집니다." }
                    },
                    temp: {
                        std: "SCA 표준: 90.5–96.1°C (195–205°F)",
                        up: { l: "높이면", t: "추출이 빨라져 쓴맛과 로스팅 향이 강해집니다. 라이트 로스트에 적합해요." },
                        down: { l: "낮추면", t: "추출이 느려져 산미는 살지만 싱겁고 신맛이 날 수 있어요. 다크 로스트에 적합해요." }
                    },
                    time: {
                        std: "SCA 총 추출 시간: 2–4분 (푸어오버)",
                        up: { l: "길어지면", t: "접촉 시간이 늘어 쓴맛과 떫은맛이 쌓입니다." },
                        down: { l: "짧아지면", t: "덜 우러나 시고 싱거우며 단맛이 부족합니다." },
                        note: "핵심 변수는 분쇄도입니다. 곱게 = 느리게, 굵게 = 빠르게."
                    },
                    yield: {
                        std: "SCA 골든컵 비율: 1:15–1:18",
                        up: { l: "물을 늘리면", t: "싱겁고 얇은 컵 — 향미가 희석됩니다." },
                        down: { l: "물을 줄이면", t: "진해지지만 추출이 고르지 못해 무겁고 탁해질 수 있어요." }
                    }
                }
            },
            originTags: ["에티오피아", "콜롬비아", "브라질", "케냐", "과테말라", "인도네시아", "코스타리카", "파나마"],
            tasteTags: ["플로럴", "프루티", "고소한", "초콜릿", "달콤한", "산미있는", "쌉쌀한", "스파이시"],
            obSteps: [
                { title: "추출 방식 선택", desc: "에스프레소와 핸드드립 중 오늘의 추출 방식을 고르세요. 프로 범위와 가이드가 방식에 맞춰 바뀝니다." },
                { title: "변수 조절", desc: "도징·물 온도·추출 시간·추출량을 슬라이더로 맞추세요. ⓘ 버튼에서 SCA 가이드를 보고, 내장 스톱워치로 추출 시간을 잴 수 있어요." },
                { title: "레시피 기록", desc: "'레시피 기록하기'를 누르고 원두 정보와 테이스팅 노트를 더하세요. 첫 잔은 로그인 없이 기록되고, 카카오나 구글로 로그인하면 모든 기록이 클라우드에 보관됩니다." },
                { title: "로그북 & 공유", desc: "기록한 레시피는 로그북에서 다시 보고 카드로 공유할 수 있어요. 이 안내는 상단 ? 버튼으로 언제든 다시 볼 수 있습니다." }
            ],
            obSkip: "건너뛰기",
            obNext: "다음 →",
            obDone: "시작하기 ☕"
        }
    };

    // --- Element Cache ---
    const el = {
        btnEspresso: document.getElementById('btn-espresso'),
        btnDrip: document.getElementById('btn-drip'),
        btnLangEn: document.getElementById('l-en'),
        btnLangKo: document.getElementById('l-ko'),
        btnViewLogbook: document.getElementById('btn-view-logbook'),
        lblLogbook: document.getElementById('lbl-logbook'),
        trustPrefix: document.getElementById('trust-prefix'),
        trustSuffix: document.getElementById('trust-suffix'),
        lblDosing: document.getElementById('lbl-dosing'),
        lblTemp: document.getElementById('lbl-temp'),
        lblTime: document.getElementById('lbl-time'),
        lblYield: document.getElementById('lbl-yield'),
        btnSave: document.getElementById('btn-save'),
        lblSave: document.getElementById('lbl-save'),
        weatherInfo: document.getElementById('weather-info'),
        envHint: document.getElementById('env-hint'),
        brandTagline: document.getElementById('brand-tagline'),
        rDosing: document.getElementById('r-dosing'),
        rTemp: document.getElementById('r-temp'),
        rTime: document.getElementById('r-time'),
        rYield: document.getElementById('r-yield'),
        vDosing: document.getElementById('v-dosing'),
        vTemp: document.getElementById('v-temp'),
        vTime: document.getElementById('v-time'),
        vYield: document.getElementById('v-yield'),
        uTime: document.getElementById('u-time'),
        progressLabelText: document.getElementById('progress-label-text'),
        progressRing: document.getElementById('progress-ring'),
        progressItems: document.getElementById('progress-items'),
        progressPct: document.getElementById('progress-pct'),
        progressHint: document.getElementById('progress-hint'),
        qbDosing: document.getElementById('qb-dosing'),
        qbTemp: document.getElementById('qb-temp'),
        qbTime: document.getElementById('qb-time'),
        qbYield: document.getElementById('qb-yield'),
        ratioLabel: document.getElementById('ratio-label'),
        ratioCoffeeBar: document.getElementById('ratio-coffee-bar'),
        ratioWaterBar: document.getElementById('ratio-water-bar'),
        ratioNum: document.getElementById('ratio-num'),
        ratioStatus: document.getElementById('ratio-status'),
        recipeModal: document.getElementById('recipe-modal'),
        modalBeanName: document.getElementById('modal-bean-name'),
        modalOrigin: document.getElementById('modal-origin'),
        modalPurchaseUrl: document.getElementById('modal-purchase-url'),
        modalImageFile: document.getElementById('modal-image-file'),
        btnImageUpload: document.getElementById('btn-image-upload'),
        fileNameDisplay: document.getElementById('file-name-display'),
        modalTasteNotes: document.getElementById('modal-taste-notes'),
        tasteTagCloud: document.getElementById('taste-tag-cloud'),
        originTagCloud: document.getElementById('origin-tag-cloud'),
        modalOverallRatingContainer: document.getElementById('modal-overall-rating-container'),
        modalSuccessFail: document.getElementById('modal-success-fail'),
        modalSaveRecipe: document.getElementById('modal-save-recipe'),
        modalCancel: document.getElementById('modal-cancel'),
        modalClose: document.getElementById('modal-close'),
        lblModalBeanName: document.getElementById('lbl-modal-bean-name'),
        lblModalOrigin: document.getElementById('lbl-modal-origin'),
        lblModalPurchaseUrl: document.getElementById('lbl-modal-purchase-url'),
        lblModalImageUrl: document.getElementById('lbl-modal-image-url'),
        lblModalTasteNotes: document.getElementById('lbl-modal-taste-notes'),
        lblModalOverallRating: document.getElementById('lbl-modal-overall-rating'),
        lblModalSuccessFail: document.getElementById('lbl-modal-success-fail'),
        lblModalSave: document.getElementById('lbl-modal-save'),
        modalTitle: document.getElementById('modal-title'),
        modalSubtitle: document.getElementById('modal-subtitle'),
        saveNudge: document.getElementById('save-nudge'),
        logbookCount: document.getElementById('logbook-count'),
        dailyCount: document.getElementById('daily-count'),
        hintDosing: document.getElementById('hint-dosing'),
        hintTemp: document.getElementById('hint-temp'),
        hintTime: document.getElementById('hint-time'),
        hintYield: document.getElementById('hint-yield'),
        btnFail: document.getElementById('btn-fail'),
        btnSuccess: document.getElementById('btn-success'),
        // Auth UI
        btnLogin: document.getElementById('btn-login'),
        btnLogout: document.getElementById('btn-logout'),
        userProfile: document.getElementById('user-profile'),
        userPhoto: document.getElementById('user-photo'),
        userName: document.getElementById('user-name'),
        lblLogin: document.getElementById('lbl-login'),
        // Bean Status UI
        btnStatusNew: document.getElementById('btn-status-new'),
        btnStatusOpen: document.getElementById('btn-status-open'),
        modalBeanStatus: document.getElementById('modal-bean-status'),
        openedBeansContainer: document.getElementById('opened-beans-container'),
        lblModalBeanStatus: document.getElementById('lbl-modal-bean-status'),
        // Onboarding
        btnHelp: document.getElementById('btn-help'),
        onboardingModal: document.getElementById('onboarding-modal'),
        obDots: document.getElementById('ob-dots'),
        obIcon: document.getElementById('ob-icon'),
        obTitle: document.getElementById('ob-title'),
        obDesc: document.getElementById('ob-desc'),
        obSkip: document.getElementById('ob-skip'),
        obNext: document.getElementById('ob-next'),
        // Stopwatch
        btnStopwatch: document.getElementById('btn-stopwatch'),
        lblStopwatch: document.getElementById('lbl-stopwatch'),
        stopwatchPanel: document.getElementById('stopwatch-panel'),
        swTime: document.getElementById('sw-time'),
        swStatus: document.getElementById('sw-status'),
        swRingProgress: document.getElementById('sw-ring-progress'),
        swBtnStart: document.getElementById('sw-btn-start'),
        swBtnReset: document.getElementById('sw-btn-reset'),
        swBtnApply: document.getElementById('sw-btn-apply'),
        swHint: document.getElementById('sw-hint'),
        lblSwStart: document.getElementById('lbl-sw-start'),
        lblSwReset: document.getElementById('lbl-sw-reset'),
        lblSwApply: document.getElementById('lbl-sw-apply'),
        // Visuals
        visDosing: document.getElementById('vis-dosing'),
        visTemp: document.getElementById('vis-temp'),
        // Zones
        zTimeMin: document.getElementById('z-time-min'),
        zTimeMax: document.getElementById('z-time-max'),
        zYieldMin: document.getElementById('z-yield-min'),
        zYieldMax: document.getElementById('z-yield-max'),
    };

    // --- Auth Logic ---

    // 이니셜 아바타. 카카오는 프로필 사진이 없는 계정이 흔하고(동의해도 기본 이미지가
    // 없을 수 있다), 그때 photoURL이 빈 문자열이면 브라우저가 깨진 이미지 아이콘을 그린다.
    // 카카오 CDN 주소가 만료돼 404가 나는 경우도 있어 onerror까지 같은 자리로 떨어뜨린다.
    const initialAvatar = (name) => {
        const ch = (name || '?').trim().charAt(0).toUpperCase() || '?';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">`
            + `<rect width="64" height="64" fill="#C8A96E"/>`
            + `<text x="32" y="43" font-family="sans-serif" font-size="30" font-weight="700"`
            + ` fill="#17130F" text-anchor="middle">${ch.replace(/[<&>"]/g, '')}</text></svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    };

    const setUserPhoto = (user) => {
        const fallback = initialAvatar(user.displayName);
        el.userPhoto.onerror = () => {
            el.userPhoto.onerror = null; // 폴백 자체가 또 실패해 무한 루프가 되지 않게
            el.userPhoto.src = fallback;
        };
        el.userPhoto.src = user.photoURL || fallback;
    };

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            el.btnLogin.style.display = 'none';
            el.userProfile.style.display = 'flex';
            setUserPhoto(user);
            el.userName.textContent = user.displayName || 'User';
            CoffeeNotesStorage.setCurrentUser(user);
            await CoffeeNotesStorage.migrateLocalToCloud(); // carry any trial recipe into the account
        } else {
            el.btnLogin.style.display = 'flex';
            el.userProfile.style.display = 'none';
            CoffeeNotesStorage.setCurrentUser(null);
        }
        updateLogbookBadge();
    });

    // sign_up/login 구분, 실패 계측, 팝업 닫힘 처리는 전부 signInWithChooser 안에서 한다.
    el.btnLogin.addEventListener('click', () => {
        signInWithChooser({ source: 'app_header', lang: currentLang });
    });

    el.btnLogout.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed", error);
        }
    });

    // --- Bean Status Logic ---
    const setBeanStatus = async (status) => {
        el.modalBeanStatus.value = status;
        el.btnStatusNew.classList.toggle('active', status === 'new');
        el.btnStatusOpen.classList.toggle('active', status === 'open');

        if (status === 'open') {
            // 원두별 가장 최근 레시피를 함께 확보해 두면, 칩 선택 시
            // 원산지·구매처·노트·사진까지 이전 기록 그대로 채울 수 있다.
            const recipes = await CoffeeNotesStorage.getRecipes();
            // 게스트(localStorage) 경로는 정렬 없이 반환되므로 여기서 최신순으로 정렬
            const sorted = (Array.isArray(recipes) ? recipes.slice() : [])
                .sort((a, b) => new Date(b && b.date) - new Date(a && a.date));
            const latestByBean = new Map(); // 최신순이므로 첫 항목이 그 원두의 최근 기록
            sorted.forEach(r => {
                if (r && r.beanName && !latestByBean.has(r.beanName)) latestByBean.set(r.beanName, r);
            });
            const recentBeans = [...latestByBean.keys()].slice(0, 10);
            if (recentBeans.length > 0) {
                // 원두명은 사용자 입력값이므로 innerHTML 대신 DOM API로 렌더링 (마크업 주입 방지)
                el.openedBeansContainer.innerHTML = '';
                recentBeans.forEach(bean => {
                    const chip = document.createElement('span');
                    chip.className = 'taste-tag';
                    chip.textContent = bean;
                    chip.addEventListener('click', () => {
                        el.modalBeanName.value = bean;
                        prefillFromRecipe(latestByBean.get(bean));
                        updateProgress();
                    });
                    el.openedBeansContainer.appendChild(chip);
                });
                el.openedBeansContainer.style.display = 'flex';
            } else {
                el.openedBeansContainer.style.display = 'none';
            }
        } else {
            el.openedBeansContainer.style.display = 'none';
        }
    };

    // 개봉 중인 원두를 고르면 그 원두의 마지막 기록에서 원두 정보를 이어받는다.
    // (평점·성공 여부는 이번 추출의 결과이므로 채우지 않음)
    const prefillFromRecipe = (r) => {
        if (!r) return;
        if (r.origin) el.modalOrigin.value = r.origin;
        if (r.purchaseUrl) el.modalPurchaseUrl.value = r.purchaseUrl;
        if (r.tasteNotes) el.modalTasteNotes.value = r.tasteNotes;
        // 태그 클라우드 활성 상태를 입력값과 동기화
        el.modalOrigin.dispatchEvent(new Event('input', { bubbles: true }));
        el.modalTasteNotes.dispatchEvent(new Event('input', { bubbles: true }));
        if (r.imageUrl) {
            uploadedImageData = r.imageUrl;
            el.btnImageUpload.innerText = i18n[currentLang].photoSelected;
            el.fileNameDisplay.innerText = currentLang === 'ko' ? '이전 기록의 사진' : 'From last log';
        }
    };

    el.btnStatusNew.addEventListener('click', () => setBeanStatus('new'));
    el.btnStatusOpen.addEventListener('click', () => setBeanStatus('open'));

    // ===== Stopwatch =====
    const sw = { running: false, elapsed: 0, startTime: null, rafId: null, done: false };
    const RING_CIRC = 326.7;
    const swGetMax = () => currentMode === 'espresso' ? 60 : 300;

    const swFormatTime = (ms) => {
        const total = ms / 1000;
        const min = Math.floor(total / 60);
        const sec = Math.floor(total % 60);
        const tenth = Math.floor((ms % 1000) / 100);
        return min > 0 ? `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${tenth}` : `${String(sec).padStart(2,'0')}.${tenth}`;
    };

    // 초 단위 값을 모드에 맞는 표기로: 드립 60초 이상은 m:ss, 그 외는 소수 1자리 + 단위
    const fmtBrewClock = (secs) => {
        if (currentMode === 'drip' && secs >= 60) {
            const total = Math.round(secs);
            return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        }
        return `${secs.toFixed(1)}${currentLang === 'ko' ? '초' : 's'}`;
    };

    const swUpdateRing = (elapsed) => {
        const pct = Math.min(elapsed / (swGetMax() * 1000), 1);
        el.swRingProgress.style.strokeDashoffset = RING_CIRC * (1 - pct);
        el.swRingProgress.style.stroke = elapsed > (swGetMax() * 1000) ? 'var(--danger)' : (!sw.running && elapsed > 0 ? 'var(--success)' : 'var(--accent)');
    };

    const swTick = () => {
        if (!sw.running) return;
        sw.elapsed = Date.now() - sw.startTime;
        el.swTime.textContent = swFormatTime(sw.elapsed);
        swUpdateRing(sw.elapsed);
        sw.rafId = requestAnimationFrame(swTick);
    };

    const swStart = () => {
        sw.running = true; sw.done = false; sw.startTime = Date.now() - sw.elapsed;
        el.swTime.classList.add('running'); el.swTime.classList.remove('done');
        el.swStatus.textContent = i18n[currentLang].swStatusRunning;
        el.lblSwStart.textContent = i18n[currentLang].swStop;
        el.swBtnStart.classList.add('stop-mode');
        el.swBtnReset.disabled = false; el.swBtnApply.disabled = true;
        el.swHint.textContent = i18n[currentLang].swHintRunning;
        sw.rafId = requestAnimationFrame(swTick);
    };

    const swStop = () => {
        sw.running = false; sw.done = true; cancelAnimationFrame(sw.rafId);
        el.swTime.classList.remove('running'); el.swTime.classList.add('done');
        el.swStatus.textContent = i18n[currentLang].swStatusDone;
        el.lblSwStart.textContent = i18n[currentLang].swRestart;
        el.swBtnStart.classList.remove('stop-mode');
        el.swBtnApply.disabled = false;
        swUpdateRing(sw.elapsed);
        const secs = sw.elapsed / 1000;
        const qr = qualityRanges[currentMode].time;
        const proL = qr.idealLow;
        const proH = qr.idealHigh;
        let k = 'swHintIdeal';
        if (secs < proL) k = 'swHintUnder'; else if (secs > proH) k = 'swHintOver';
        el.swHint.textContent = i18n[currentLang][k].replace('{time}', fmtBrewClock(secs));
    };

    const swReset = () => {
        cancelAnimationFrame(sw.rafId); sw.running = false; sw.done = false; sw.elapsed = 0; sw.startTime = null;
        el.swTime.textContent = '00.0'; el.swTime.classList.remove('running','done');
        el.swStatus.textContent = i18n[currentLang].swStatusReady;
        el.lblSwStart.textContent = i18n[currentLang].swStart;
        el.swBtnStart.classList.remove('stop-mode');
        el.swBtnReset.disabled = true; el.swBtnApply.disabled = true;
        el.swRingProgress.style.strokeDashoffset = RING_CIRC;
        el.swHint.textContent = i18n[currentLang].swHintReady;
    };

    const swApply = () => {
        track('stopwatch_applied', { mode: currentMode });
        if (sw.elapsed === 0) return;
        const snapped = Math.floor((sw.elapsed / 1000) * 10) / 10;
        el.rTime.value = snapped.toFixed(1);
        // 슬라이더 max를 넘는 기록은 브라우저가 클램프하므로, 실제 반영된 값으로 표시·안내한다
        const applied = parseFloat(el.rTime.value);
        updateVal('time', applied);
        syncRuler('time', applied);
        // 버튼 자체가 아닌 내부 라벨(span)만 바꿔야 이후 라벨 복원이 동작한다
        el.lblSwApply.textContent = '✓';
        el.swHint.textContent = i18n[currentLang].swApplied.replace('{time}', fmtBrewClock(applied));
        setTimeout(() => {
            el.lblSwApply.textContent = i18n[currentLang].swApply;
            el.stopwatchPanel.classList.remove('open');
            el.btnStopwatch.classList.remove('active');
            el.lblStopwatch.textContent = i18n[currentLang].swBtnOpen;
        }, 1500);
    };

    // --- Audio ---
    const playTick = () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.03);
        } catch (e) {}
    };

    // --- Ruler Picker Logic ---
    const PX_PER_UNIT = 120; // 1.0 unit = 120px (0.1 unit = 12px) - WIDE GAPS
    const rulerState = {};

    const initRulers = () => {
        ['dosing', 'temp', 'time', 'yield'].forEach(id => {
            const viewport = document.getElementById(`rv-${id}`);
            const track = document.getElementById(`rt-${id}`);
            const input = document.getElementById(`r-${id}`);
            if (!viewport || !track || !input) return;

            const min = parseFloat(input.min);
            const max = parseFloat(input.max);
            const range = max - min;

            // Set track width based on range
            track.style.width = `${range * PX_PER_UNIT}px`;

            // Scrolling event
            viewport.addEventListener('scroll', () => {
                if (rulerState[id]?.syncing) return;
                const scrollPos = viewport.scrollLeft;
                const val = min + (scrollPos / PX_PER_UNIT);
                const clamped = Math.max(min, Math.min(max, val)).toFixed(1);

                if (input.value !== clamped) {
                    input.value = clamped;
                    updateVal(id, clamped);
                }
            });

            // Initial position
            syncRuler(id, input.value, false);
        });
    };

    const syncRuler = (id, val, smooth = true) => {
        const viewport = document.getElementById(`rv-${id}`);
        const input = document.getElementById(`r-${id}`);
        if (!viewport || !input) return;

        const min = parseFloat(input.min);
        const targetScroll = (parseFloat(val) - min) * PX_PER_UNIT;

        if (!rulerState[id]) rulerState[id] = {};
        rulerState[id].syncing = true;

        viewport.scrollTo({
            left: targetScroll,
            behavior: smooth ? 'smooth' : 'auto'
        });

        // Unlock after animation
        setTimeout(() => { if (rulerState[id]) rulerState[id].syncing = false; }, smooth ? 500 : 50);
    };

    // --- Logic ---
    const updateVal = (id, val) => {
        let dv = parseFloat(val);
        let ds = '';
        const timeAsClock = id === 'time' && currentMode === 'drip' && dv >= 60;
        if (timeAsClock) {
            const total = Math.round(dv);
            ds = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        } else {
            ds = dv.toFixed(1);
        }
        if (id === 'time' && el.uTime) el.uTime.textContent = timeAsClock ? 'min' : 'sec';
        const vEl = el[`v${id.charAt(0).toUpperCase() + id.slice(1)}`];
        if (vEl && vEl.textContent !== ds) {
            vEl.textContent = ds;
            playTick();
        }
        const qbEl = el[`qb${id.charAt(0).toUpperCase() + id.slice(1)}`];
        if (qbEl) {
            const ranges = qualityRanges[currentMode][id];
            let label = (dv < ranges.low || dv > ranges.high) ? 'extreme' : ((dv < ranges.idealLow || dv > ranges.idealHigh) ? 'low' : 'ideal');
            qbEl.className = `quality-badge ${label}`;
            qbEl.textContent = { ideal: 'IDEAL', low: 'CHECK', extreme: 'OFF' }[label];
        }
        // --- 비주얼 바 ---
        if (id === 'dosing' && el.visDosing) el.visDosing.style.width = `${(dv - 7) / (40 - 7) * 100}%`;
        if (id === 'temp' && el.visTemp) el.visTemp.style.width = `${(dv - 80) / (100 - 80) * 100}%`;

        updateBrewRatio(); updateProgress();
    };

    const qualityRanges = {
        espresso: { dosing: { low: 14, idealLow: 17, idealHigh: 22, high: 26 }, temp: { low: 85, idealLow: 90, idealHigh: 96, high: 99 }, time: { low: 20, idealLow: 25, idealHigh: 35, high: 45 }, yield: { low: 15, idealLow: 30, idealHigh: 50, high: 58 } },
        drip: { dosing: { low: 10, idealLow: 15, idealHigh: 25, high: 35 }, temp: { low: 85, idealLow: 90, idealHigh: 96, high: 99 }, time: { low: 90, idealLow: 120, idealHigh: 240, high: 280 }, yield: { low: 100, idealLow: 225, idealHigh: 450, high: 550 } }
    };

    // 모드별로 마지막 설정값을 기억한다. 드립 기본값이 없으면 에스프레소 값(28.5초 등)이
    // 그대로 남아 모든 배지가 OFF로 시작하므로, SCA 권장 범위 안의 값으로 시작시킨다.
    const modeValues = {
        espresso: { dosing: 18.0, temp: 92.0, time: 28.5, yield: 36.0 },
        drip:     { dosing: 20.0, temp: 93.0, time: 180.0, yield: 320.0 }
    };
    const VAR_IDS = ['dosing', 'temp', 'time', 'yield'];

    const setMode = (mode) => {
        if (mode !== currentMode) {
            // 떠나는 모드의 현재 값을 저장해 두었다가 돌아오면 복원
            VAR_IDS.forEach(id => {
                modeValues[currentMode][id] = parseFloat(el[`r${id.charAt(0).toUpperCase() + id.slice(1)}`].value);
            });
        }
        currentMode = mode;
        el.btnEspresso.classList.toggle('active', mode === 'espresso');
        el.btnDrip.classList.toggle('active', mode === 'drip');

        const timeMax = mode === 'espresso' ? 60 : 300;
        const yieldMax = mode === 'espresso' ? 60 : 600;
        el.rTime.max = timeMax;
        el.rYield.max = yieldMax;

        // max 설정 이후에 값을 복원해야 드립 시간(60초 초과)이 잘리지 않는다
        VAR_IDS.forEach(id => {
            el[`r${id.charAt(0).toUpperCase() + id.slice(1)}`].value = modeValues[mode][id];
        });

        if (el.zTimeMax) el.zTimeMax.textContent = mode === 'drip' ? '5:00' : `${timeMax}s`;
        if (el.zYieldMax) el.zYieldMax.textContent = `${yieldMax}g`;

        // Update track widths
        ['time', 'yield'].forEach(id => {
            const track = document.getElementById(`rt-${id}`);
            const input = document.getElementById(`r-${id}`);
            if (track && input) track.style.width = `${(parseFloat(input.max) - parseFloat(input.min)) * PX_PER_UNIT}px`;
        });

        updateVal('dosing', el.rDosing.value); updateVal('temp', el.rTemp.value);
        updateVal('time', el.rTime.value); updateVal('yield', el.rYield.value);

        // Sync ruler positions
        ['dosing', 'temp', 'time', 'yield'].forEach(id => syncRuler(id, el[`r${id.charAt(0).toUpperCase() + id.slice(1)}`].value, false));

        updateBrewRatio(); updateProHints(); refreshScaPopover();
        if (el.stopwatchPanel.classList.contains('open')) swReset();
    };

    // --- Fine Tune Helpers ---
    const fineTune = (id, delta) => {
        if (!id) return; // ID가 없으면 중단 (방어 로직)
        const input = el[`r${id.charAt(0).toUpperCase() + id.slice(1)}`];
        if (!input) return;

        const step = 0.1; 
        let newValue = parseFloat(input.value) + (delta * step);
        newValue = Math.max(parseFloat(input.min), Math.min(parseFloat(input.max), newValue));
        input.value = newValue.toFixed(1);
        updateVal(id, input.value);
        syncRuler(id, input.value);
    };

    // --- Weather ---
    // 데이터: Open-Meteo (한국은 기상청 KMA 모델 등 지역별 최적 수치예보 모델을 자동 사용, 키 불필요)
    // 지명: BigDataCloud 역지오코딩 (한국어 행정구역명 지원, 키 불필요)
    // 위치: GPS(고정밀) → IP 추정 → 서울 순으로 폴백하되, 수치는 항상 실제 데이터만 표시한다.
    const wmoEmoji = (code, isDay) => {
        if (code === 0) return isDay ? '☀️' : '🌙';
        if (code === 1) return isDay ? '🌤️' : '🌙';
        if (code === 2) return '⛅';
        if (code === 3) return '☁️';
        if (code === 45 || code === 48) return '🌫️';
        if (code >= 51 && code <= 57) return '🌦️';
        if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '🌨️';
        if (code >= 95) return '⛈️';
        return '🌡️';
    };

    const fetchJson = async (url, ms = 8000) => {
        const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    };

    const locateByGps = () => new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject(new Error('geolocation unsupported'));
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, approx: false }),
            reject,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 }
        );
    });

    const locateByIp = async () => {
        const d = await fetchJson('https://ipapi.co/json/');
        if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') throw new Error('no ip location');
        return { lat: d.latitude, lon: d.longitude, city: d.city, approx: true };
    };

    const reverseGeocode = async (lat, lon) => {
        const d = await fetchJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${currentLang === 'ko' ? 'ko' : 'en'}`);
        return d.city || d.locality || d.principalSubdivision || '';
    };

    let weatherBusy = false;
    const fetchWeather = async () => {
        if (weatherBusy) return;
        weatherBusy = true;
        const infoSpan = el.weatherInfo.querySelector('span:last-child');
        el.weatherInfo.title = currentLang === 'ko' ? '클릭하면 새로고침' : 'Click to refresh';
        if (infoSpan) infoSpan.textContent = i18n[currentLang].weather;
        try {
            let loc;
            try { loc = await locateByGps(); }
            catch (gpsErr) {
                try { loc = await locateByIp(); }
                catch (ipErr) { loc = { lat: 37.5665, lon: 126.9780, city: currentLang === 'ko' ? '서울' : 'Seoul', approx: true }; }
            }

            const wx = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,weather_code,is_day&timezone=auto`);
            const cur = wx.current;

            let city = '';
            if (!loc.approx) { try { city = await reverseGeocode(loc.lat, loc.lon); } catch (geoErr) { /* 지명 없이 진행 */ } }
            if (!city) city = loc.city || (currentLang === 'ko' ? '내 위치' : 'My location');

            const temp = cur.temperature_2m; const hum = cur.relative_humidity_2m;
            lastWeatherText = `📍 ${city} · ${wmoEmoji(cur.weather_code, cur.is_day === 1)} ${temp.toFixed(1)}°C · 💧 ${hum}%`;
            if (infoSpan) {
                // 도시명이 외부 API 응답이므로 innerHTML 대신 textContent로 렌더링한다.
                infoSpan.textContent = lastWeatherText;
                if (loc.approx) {
                    const s = document.createElement('small');
                    s.style.cssText = 'opacity:0.6;font-size:0.75em;margin-left:4px;';
                    s.textContent = currentLang === 'ko' ? '(추정 위치)' : '(approx.)';
                    infoSpan.appendChild(s);
                }
            }

            if (hum > 65) el.envHint.textContent = currentLang === 'ko' ? `습도 ${hum}% — 분쇄도를 약간 굵게 조정하세요` : `Humidity ${hum}% — try slightly coarser grind`;
            else if (hum < 40) el.envHint.textContent = currentLang === 'ko' ? `습도 ${hum}% — 추출 강도 +0.5g 권장` : `Humidity ${hum}% — consider +0.5g dosing`;
            else if (temp <= 5) el.envHint.textContent = currentLang === 'ko' ? `기온 ${temp.toFixed(0)}°C — 잔과 장비를 충분히 예열하세요` : `${temp.toFixed(0)}°C — preheat your cup and gear`;
            else el.envHint.textContent = currentLang === 'ko' ? '추출 조건 최적' : 'Ideal conditions';
        } catch (e) {
            lastWeatherText = '';
            if (infoSpan) infoSpan.textContent = i18n[currentLang].weatherError;
        } finally {
            weatherBusy = false;
        }
    };

    // 날씨 스트립 클릭으로 수동 새로고침 + 15분마다 자동 갱신 (탭을 켜둬도 최신 유지)
    el.weatherInfo.style.cursor = 'pointer';
    el.weatherInfo.addEventListener('click', () => fetchWeather());
    setInterval(fetchWeather, 15 * 60 * 1000);

    const updateBrewRatio = () => {
        const d = parseFloat(el.rDosing.value); const y = parseFloat(el.rYield.value); const r = y / d;
        el.ratioNum.textContent = `1 : ${r.toFixed(1)}`;
        el.ratioCoffeeBar.style.width = `${(d / (d + y)) * 100}%`;
        let ideal = currentMode === 'espresso' ? (r >= 1.5 && r <= 2.5) : (r >= 13 && r <= 18);
        el.ratioStatus.textContent = ideal ? i18n[currentLang].ratioIdeal : i18n[currentLang].ratioWarning;
        el.ratioStatus.className = `ratio-status ${ideal ? 'ideal' : 'warning'}`;
    };

    // 완성도 — 예전에는 원두명 유무로 75%/100% 둘 중 하나였다. 그래선 링을 그려도
    // 의미가 없다. 실제 기여 요인을 두고 무엇이 빠졌는지 보여준다(Oura 준비도 문법).
    // 측정값(도징·온도·시간·수율)은 슬라이더라 항상 있으므로 기본 60점으로 깔고,
    // 사람이 채워야 하는 네 가지가 나머지를 만든다.
    const RING_CIRCUMFERENCE = 2 * Math.PI * 42;   // app.html의 r=42와 맞물린다

    const completenessFactors = () => ([
        { key: 'bean',   ok: !!(el.modalBeanName && el.modalBeanName.value.trim()),
          ko: '원두 이름', en: 'Bean name' },
        { key: 'notes',  ok: !!(el.modalTasteNotes && el.modalTasteNotes.value.trim()),
          ko: '테이스팅 노트', en: 'Tasting notes' },
        { key: 'photo',  ok: !!uploadedImageData,
          ko: '사진', en: 'Photo' },
        // 평점은 기본값 3점이 미리 체크돼 있어 항상 '완료'로 잡힌다 — 기여 요인이
        // 되지 못한다. 사용자가 실제로 채워야 하는 원산지를 대신 넣는다.
        { key: 'origin', ok: !!(el.modalOrigin && el.modalOrigin.value.trim()),
          ko: '원산지', en: 'Origin' },
    ]);

    const updateProgress = () => {
        const factors = completenessFactors();
        const score = 60 + factors.filter((f) => f.ok).length * 10;

        if (el.progressRing) {
            // 링은 위에서 시작해 시계방향으로 찬다(CSS에서 -90도 회전).
            el.progressRing.style.strokeDasharray = RING_CIRCUMFERENCE;
            el.progressRing.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - score / 100);
        }
        if (el.progressPct) el.progressPct.textContent = `${score}%`;

        if (el.progressItems) {
            el.progressItems.textContent = '';
            factors.forEach((f) => {
                const li = document.createElement('li');
                li.className = 'cmp-item' + (f.ok ? ' is-done' : '');
                // 상태를 색으로만 말하지 않는다 — 표식과 글자가 항상 함께 간다.
                li.textContent = (f.ok ? '✓ ' : '· ') + (currentLang === 'ko' ? f.ko : f.en);
                el.progressItems.appendChild(li);
            });
        }
        if (el.progressHint) {
            el.progressHint.textContent = score === 100
                ? (currentLang === 'ko' ? '완성된 레시피입니다 ✓' : 'Recipe complete ✓')
                : '';
        }
    };

    const updateLogbookBadge = async () => {
        const recipes = await CoffeeNotesStorage.getRecipes();
        // null이면 읽기 실패다(storage.js 규약). 배지와 오늘 개수를 0으로 덮으면
        // 사용자에게는 기록이 사라진 것처럼 보이므로, 직전 값을 그대로 남긴다.
        if (recipes === null) {
            track('recipes_load_failed', { page: 'app' });
            return;
        }
        if (!Array.isArray(recipes)) return;
        el.logbookCount.textContent = recipes.length; el.logbookCount.style.display = recipes.length > 0 ? 'flex' : 'none';
        const todayCount = recipes.filter(r => r && r.date && new Date(r.date).toDateString() === new Date().toDateString()).length;
        el.dailyCount.textContent = todayCount;
    };

    const updateProHints = () => { 
        const qr = qualityRanges[currentMode];
        const t = i18n[currentLang];

        // Dosing
        el.hintDosing.textContent = t.proHintDosing.replace('{min}', qr.dosing.idealLow.toFixed(1)).replace('{max}', qr.dosing.idealHigh.toFixed(1));

        // Temp
        el.hintTemp.textContent = t.proHintTemp.replace('{min}', qr.temp.idealLow.toFixed(1)).replace('{max}', qr.temp.idealHigh.toFixed(1));

        // Time — 드립은 m:ss 표기이므로 "sec" 단위가 붙지 않는 전용 템플릿을 쓴다
        let tMin = qr.time.idealLow, tMax = qr.time.idealHigh;
        if (currentMode === 'drip') {
            const tMinStr = `${Math.floor(tMin / 60)}:${String(tMin % 60).padStart(2, '0')}`;
            const tMaxStr = `${Math.floor(tMax / 60)}:${String(tMax % 60).padStart(2, '0')}`;
            el.hintTime.textContent = t.proHintTimeDrip.replace('{min}', tMinStr).replace('{max}', tMaxStr);
        } else {
            el.hintTime.textContent = t.proHintTime.replace('{min}', tMin.toFixed(1)).replace('{max}', tMax.toFixed(1));
        }

        // Yield (Ratio)
        let ratioStr = currentMode === 'espresso' ? "1:2.0" : "1:15–1:18";
        el.hintYield.textContent = t.proHintYield.replace('{ratio}', ratioStr.split(':')[1] || ratioStr);

        el.ratioLabel.textContent = t.ratioLabel;
    };

    // --- SCA Guide Popovers ---
    // 각 변수 라벨 옆 ⓘ 버튼: 데스크톱은 호버, 모바일은 탭으로 열린다.
    // 콘텐츠는 i18n.scaGuide[모드][변수]에서 가져오므로 언어/모드 전환 시 함께 바뀐다.
    const scaPop = { openId: null, pinned: false };

    const renderScaPopover = (id) => {
        const pop = document.getElementById(`pop-${id}`);
        if (!pop) return;
        const t = i18n[currentLang];
        const g = t.scaGuide[currentMode][id];
        if (!g) return;
        const noteHtml = g.note ? `<div class="sca-pop-note">${g.note}</div>` : '';
        pop.innerHTML = `
            <div class="sca-pop-card">
                <div class="sca-pop-title">${t.scaTitle}</div>
                <div class="sca-pop-std">${g.std}</div>
                <div class="sca-pop-row"><span class="sca-dir up">▲</span><div><strong>${g.up.l}</strong> — ${g.up.t}</div></div>
                <div class="sca-pop-row"><span class="sca-dir down">▼</span><div><strong>${g.down.l}</strong> — ${g.down.t}</div></div>
                ${noteHtml}
            </div>`;
    };

    const closeScaPopovers = () => {
        scaPop.openId = null; scaPop.pinned = false;
        document.querySelectorAll('.sca-popover.open').forEach(p => p.classList.remove('open'));
        document.querySelectorAll('.info-btn[aria-expanded="true"]').forEach(b => {
            b.setAttribute('aria-expanded', 'false');
            b.classList.remove('active');
        });
    };

    const openScaPopover = (id, pin) => {
        // 호버로도 열리므로 계측은 '고정(클릭)'한 경우만 — 아니면 이벤트가 폭주한다.
        if (pin) track('sca_guide_opened', { variable: id, mode: currentMode });
        if (scaPop.openId && scaPop.openId !== id) closeScaPopovers();
        renderScaPopover(id);
        const pop = document.getElementById(`pop-${id}`);
        const btn = document.querySelector(`.info-btn[data-info="${id}"]`);
        if (!pop || !btn) return;
        pop.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('active');
        scaPop.openId = id;
        scaPop.pinned = pin || scaPop.pinned;
    };

    // 열린 상태에서 언어·모드가 바뀌면 내용만 다시 그린다
    const refreshScaPopover = () => { if (scaPop.openId) renderScaPopover(scaPop.openId); };

    document.querySelectorAll('.info-btn').forEach(btn => {
        const id = btn.getAttribute('data-info');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (scaPop.openId === id && scaPop.pinned) closeScaPopovers();
            else openScaPopover(id, true);
        });
        btn.addEventListener('mouseenter', () => { if (!scaPop.pinned) openScaPopover(id, false); });
        // 버튼과 팝오버를 감싸는 control-meta를 벗어나면 닫기 (고정된 경우 제외)
        const meta = btn.closest('.control-meta');
        if (meta) meta.addEventListener('mouseleave', () => { if (!scaPop.pinned) closeScaPopovers(); });
    });

    document.addEventListener('click', (e) => {
        if (scaPop.openId && !e.target.closest('.sca-popover') && !e.target.closest('.info-btn')) closeScaPopovers();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        closeScaPopovers();
        if (el.onboardingModal.classList.contains('active')) closeOnboarding();
        // 레시피 모달도 ESC로 닫는다 — 온보딩이 이미 그렇고 모달의 보편적 기대다.
        //
        // 다만 **백드롭 클릭으로는 닫지 않는다.** 온보딩 모달은 백드롭 클릭을 받지만
        // 이 모달은 원두 이름·테이스팅 노트를 직접 타이핑하는 폼이다. 바깥을 잘못
        // 눌러 입력이 통째로 날아가면 편의가 아니라 사고다. 온보딩이 안전한 건
        // 규약이 같아서가 아니라 잃을 데이터가 없기 때문이다.
        if (el.recipeModal.classList.contains('active')) closeRecipeModal();
    });

    // --- Onboarding Tour ---
    // 첫 방문(첫 설치·첫 로그인 포함)에만 자동으로 열리고,
    // 이후에는 헤더의 ? 버튼으로만 다시 볼 수 있다.
    const OB_SEEN_KEY = 'nmcGuideSeenV1';
    const ob = { step: 0 };

    // 온보딩 아이콘. 원래 ⚡ 🎚️ ✦ 📖 를 텍스트로 넣었는데 두 가지 문제가 있었다:
    // ✦(U+2726)은 이모지가 아니라 이 프로젝트가 싣는 웹폰트에 없는 글리프이고
    // (랜딩이 같은 이유로 이미 SVG로 뺐다), 🎚️는 플랫폼마다 모양이 크게 달라
    // 무엇인지 알아보기 어렵다. 앱의 다른 아이콘과 같은 인라인 SVG로 통일한다.
    // 순서는 i18n obSteps와 같다: 모드 선택 → 변수 조절 → 기록 → 로그북/공유.
    const OB_ICONS = [
        // 번개 (에스프레소/모드)
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z"/></svg>',
        // 슬라이더 (변수 조절)
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11M18.5 7H21M3 17h5M12.5 17H21"/><circle cx="16.2" cy="7" r="2.3"/><circle cx="10.2" cy="17" r="2.3"/></svg>',
        // 북마크 + 체크 (레시피 기록)
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.8h12v17l-6-4.2-6 4.2z"/><path d="M9.2 10.2l2.2 2.2 3.6-3.9"/></svg>',
        // 펼친 책 (로그북)
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5v14"/><path d="M12 6.5C9.6 4.6 6 4 3 4.5v14c3-.5 6.6.1 9 2"/><path d="M12 6.5c2.4-1.9 6-2.5 9-2v14c-3-.5-6.6.1-9 2"/></svg>',
    ];

    const renderObStep = () => {
        const t = i18n[currentLang];
        const s = t.obSteps[ob.step];
        el.obIcon.innerHTML = OB_ICONS[ob.step] || '';
        el.obTitle.textContent = s.title;
        el.obDesc.textContent = s.desc;
        el.obSkip.textContent = t.obSkip;
        el.obNext.textContent = ob.step === t.obSteps.length - 1 ? t.obDone : t.obNext;
        el.obDots.innerHTML = t.obSteps.map((_, i) =>
            `<button type="button" class="ob-dot${i === ob.step ? ' active' : i < ob.step ? ' done' : ''}" data-step="${i}" aria-label="Step ${i + 1}"></button>`).join('');
        el.obDots.querySelectorAll('.ob-dot').forEach(d =>
            d.addEventListener('click', () => { ob.step = parseInt(d.dataset.step, 10); renderObStep(); }));
    };

    // ── 모달과 안드로이드 뒤로가기 ──────────────────────────────────
    // 하드웨어 뒤로가기는 모달의 존재를 모른다. 히스토리에 항목을 밀어 넣지 않으면
    // 모달이 열린 상태에서 뒤로가기를 눌렀을 때 모달만 닫히는 게 아니라 페이지를
    // 통째로 빠져나가 랜딩으로 돌아간다(사용자 제보).
    //
    // 경로를 하나로 둔다: 여는 쪽은 pushState, **닫는 쪽은 무조건 history.back()**만
    // 부르고 실제 DOM 닫기는 popstate 핸들러 한 곳에서만 한다.
    // 처음에는 "버튼으로 닫을 때 DOM을 직접 닫고 밀어 넣은 항목을 따로 회수"하는
    // 이중 경로로 짰는데, 회수용 back()이 실제로 먹지 않아 항목이 남았다
    // (history.state가 계속 {nmcModal:1}이었다). 경로가 하나면 그런 어긋남이 없다.
    let modalHistoryDepth = 0;

    const pushModalHistory = () => {
        modalHistoryDepth++;
        history.pushState({ nmcModal: modalHistoryDepth }, '');
    };

    // 버튼·ESC로 닫을 때 쓴다.
    // 히스토리 항목이 있으면 back()만 부르고 DOM 닫기는 popstate에 맡긴다 — 경로가
    // 하나여야 어긋나지 않는다. 다만 어떤 이유로든 항목 없이 모달이 열려 있으면
    // back()이 페이지를 떠나보내거나 아무 일도 안 하므로, 그때는 직접 닫는다.
    // (이 방어가 없으면 항목이 없는 순간 닫기 버튼이 통째로 죽는다 — 실제로 겪었다.)
    const closeTopModalViaHistory = (closeDirect) => {
        if (modalHistoryDepth > 0) { history.back(); return; }
        if (closeDirect) closeDirect();
    };

    // 닫기 함수 스택을 쓰지 않는다. 스택은 모달이 스택 밖에서 닫히는 순간
    // 엉뚱한 것을 닫게 된다(온보딩이 자동으로 열려 항목을 밀어 넣은 뒤 다른 경로로
    // 닫히면, 레시피 모달을 닫으려던 뒤로가기가 온보딩을 닫아버렸다).
    // 지금 실제로 열려 있는 것을 닫는 편이 어긋나지 않는다.
    const closeAnyOpenModal = () => {
        if (el.recipeModal.classList.contains('active')) { closeRecipeModalDirect(); return; }
        if (el.onboardingModal.classList.contains('active')) { closeOnboardingDirect(); }
    };

    window.addEventListener('popstate', () => {
        // 우리가 밀어 넣은 게 없으면 진짜 페이지 이탈이다 — 막지 않는다.
        if (modalHistoryDepth === 0) return;
        modalHistoryDepth--;
        closeAnyOpenModal();
    });

    const closeRecipeModalDirect = () => el.recipeModal.classList.remove('active');

    // closeDirect는 히스토리를 건드리지 않는다 — popstate가 부를 때 쓰인다.
    // 사용자가 버튼으로 닫을 때만 밀어 넣은 항목을 회수한다.
    const closeOnboardingDirect = () => {
        el.onboardingModal.classList.remove('active');
        try { localStorage.setItem(OB_SEEN_KEY, '1'); } catch (e) { /* private mode 등 저장 불가 시 무시 */ }
    };
    const openOnboarding = () => {
        ob.step = 0; renderObStep();
        el.onboardingModal.classList.add('active');
        pushModalHistory();
    };
    const closeOnboarding = () => closeTopModalViaHistory(closeOnboardingDirect);

    el.btnHelp.addEventListener('click', () => { track('onboarding_reopened'); openOnboarding(); });
    el.obSkip.addEventListener('click', () => {
        track('onboarding_skipped', { step: ob.step + 1 });
        closeOnboarding();
    });
    el.obNext.addEventListener('click', () => {
        if (ob.step >= i18n[currentLang].obSteps.length - 1) {
            track('onboarding_completed');
            closeOnboarding();
        } else { ob.step++; renderObStep(); }
    });
    el.onboardingModal.querySelector('.modal-backdrop').addEventListener('click', closeOnboarding);

    const renderTagCloud = (container, tags, inputEl) => {
        if (!container || !inputEl) return;

        const updateTagsActiveState = () => {
            const currentVals = inputEl.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
            container.querySelectorAll('.taste-tag').forEach(tag => {
                const val = tag.getAttribute('data-value').toLowerCase();
                tag.classList.toggle('active', currentVals.includes(val));
            });
        };

        container.innerHTML = tags.map(tag => `<span class="taste-tag" data-value="${tag}">#${tag}</span>`).join('');
        container.querySelectorAll('.taste-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const val = tag.getAttribute('data-value');
                let currentVals = inputEl.value.split(',').map(s => s.trim()).filter(s => s);
                
                const index = currentVals.findIndex(v => v.toLowerCase() === val.toLowerCase());
                if (index === -1) {
                    currentVals.push(val);
                } else {
                    currentVals.splice(index, 1);
                }
                
                inputEl.value = currentVals.join(', ');
                updateTagsActiveState();
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });

        // Sync on manual input
        inputEl.addEventListener('input', updateTagsActiveState);
        updateTagsActiveState(); // Initial sync
    };

    const setLang = (lang) => {
        currentLang = lang; ['btnLangEn','btnLangKo'].forEach(k => el[k].classList.toggle('active', k.toLowerCase().endsWith(lang)));
        const t = i18n[lang]; 
        
        ['lblDosing','lblTemp','lblTime','lblYield','lblSave','saveNudge','brandTagline','progressLabelText'].forEach(k => {
            if (!el[k]) return;
            let key = k.replace('lbl','');
            // Specific overrides for keys that don't match standard mapping
            if (key === 'saveNudge') key = 'savingNudge';
            if (key === 'progressLabelText') key = 'progressLabel';
            // Try lowercase, then original key
            el[k].textContent = t[key.charAt(0).toLowerCase() + key.slice(1)] || t[key] || t[k];
        });

        ['lblModalBeanName','lblModalOrigin','lblModalPurchaseUrl','lblModalImageUrl','lblModalTasteNotes','lblModalOverallRating','lblModalSuccessFail','lblModalSave','modalTitle','modalSubtitle','lblLogin','lblModalBeanStatus'].forEach(k => {
            if (el[k]) el[k].textContent = t[k.replace('lbl','').charAt(0).toLowerCase() + k.replace('lbl','').slice(1)] || t[k];
        });
        if (el.btnStatusNew) el.btnStatusNew.textContent = t.statusNew;
        if (el.btnStatusOpen) el.btnStatusOpen.textContent = t.statusOpen;
        if (el.btnImageUpload) el.btnImageUpload.innerText = uploadedImageData ? t.photoSelected : t.selectPhoto;
        if (el.lblLogbook) el.lblLogbook.textContent = t.viewLogbook;
        if (el.trustPrefix) el.trustPrefix.textContent = t.trustPrefix;
        if (el.trustSuffix) el.trustSuffix.textContent = t.trustSuffix;
        el.lblStopwatch.textContent = el.stopwatchPanel.classList.contains('open') ? t.swBtnClose : t.swBtnOpen;
        el.lblSwStart.textContent = sw.running ? t.swStop : (sw.done ? t.swRestart : t.swStart);
        el.lblSwReset.textContent = t.swReset;
        el.lblSwApply.textContent = t.swApply;
        el.swStatus.textContent = sw.running ? t.swStatusRunning : (sw.done ? t.swStatusDone : t.swStatusReady);

        renderTagCloud(el.originTagCloud, t.originTags, el.modalOrigin);
        renderTagCloud(el.tasteTagCloud, t.tasteTags, el.modalTasteNotes);

        updateProHints(); updateProgress(); updateBrewRatio(); refreshScaPopover(); fetchWeather();
        if (el.onboardingModal.classList.contains('active')) renderObStep();
    };

    // --- Events ---
    // setMode는 부팅 시에도 호출되므로 계측은 클릭 핸들러 쪽에 붙인다.
    el.btnEspresso.addEventListener('click', () => { track('mode_selected', { mode: 'espresso' }); setMode('espresso'); });
    el.btnDrip.addEventListener('click', () => { track('mode_selected', { mode: 'drip' }); setMode('drip'); });
    el.btnLangEn.addEventListener('click', () => { track('language_changed', { lang: 'en', page: 'app' }); setLang('en'); });
    el.btnLangKo.addEventListener('click', () => { track('language_changed', { lang: 'ko', page: 'app' }); setLang('ko'); });
    el.btnViewLogbook.addEventListener('click', () => {
        track('logbook_opened', { from: 'app_header' });
        window.location.href = 'logbook.html';
    });

    // Range sliders
    [el.rDosing, el.rTemp, el.rTime, el.rYield].forEach(input => {
        if (!input) return;
        input.addEventListener('input', (e) => {
            const id = e.target.id.replace('r-', '');
            updateVal(id, e.target.value);
        });
    });

    // Fine tune buttons
    document.querySelectorAll('.fine-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const delta = btn.classList.contains('btn-plus') ? 1 : -1;
            fineTune(id, delta);
        });
    });

    el.btnStopwatch.addEventListener('click', () => {
        const isOpen = el.stopwatchPanel.classList.toggle('open');
        el.btnStopwatch.classList.toggle('active', isOpen);
        el.lblStopwatch.textContent = isOpen ? i18n[currentLang].swBtnClose : i18n[currentLang].swBtnOpen;
        if (isOpen && !sw.running && !sw.done) swReset();
    });
    el.swBtnStart.addEventListener('click', () => { if (sw.running) swStop(); else swStart(); });
    el.swBtnReset.addEventListener('click', swReset);
    el.swBtnApply.addEventListener('click', swApply);

    el.btnSave.addEventListener('click', () => {
        el.recipeModal.classList.add('active');
        pushModalHistory();
        el.modalBeanName.value = ''; 
        el.modalOrigin.value = ''; el.modalOrigin.dispatchEvent(new Event('input'));
        el.modalPurchaseUrl.value = ''; 
        el.modalImageFile.value = ''; uploadedImageData = ''; el.fileNameDisplay.innerText = ''; el.btnImageUpload.innerText = i18n[currentLang].selectPhoto; 
        el.modalTasteNotes.value = ''; el.modalTasteNotes.dispatchEvent(new Event('input'));
        
        el.modalOverallRatingContainer.querySelector('input[value="3"]').checked = true; successResult = false; el.btnFail.classList.add('active'); el.btnSuccess.classList.remove('active'); el.modalSuccessFail.checked = false; 
        setBeanStatus('new'); // Reset to new by default
        setTimeout(() => el.modalBeanName.focus(), 400);
    });

    // 닫는 방법이 늘었으므로 동작을 한 곳에 모은다. 하단 Cancel과 상단 X, ESC가
    // 전부 이걸 부른다 — 각자 remove('active')를 흩뿌리면 나중에 어긋난다.
    const closeRecipeModal = () => closeTopModalViaHistory(closeRecipeModalDirect);
    el.modalCancel.addEventListener('click', closeRecipeModal);
    if (el.modalClose) el.modalClose.addEventListener('click', closeRecipeModal);
    el.btnFail.addEventListener('click', () => { successResult = false; el.modalSuccessFail.checked = false; el.btnFail.classList.add('active'); el.btnSuccess.classList.remove('active'); });
    el.btnSuccess.addEventListener('click', () => { successResult = true; el.modalSuccessFail.checked = true; el.btnFail.classList.remove('active'); el.btnSuccess.classList.add('active'); });

    // 저장 중 재클릭을 막는다. 가드가 없으면 느린 연결·오프라인에서 사용자가
    // 여러 번 누르는 만큼 addDoc이 쌓이고, 재연결 시 전부 전송되어 중복 문서가 된다.
    let savingRecipe = false;
    el.modalSaveRecipe.addEventListener('click', async () => {
        if (savingRecipe) return;
        try {
            const bean = el.modalBeanName.value.trim(); if (!bean) return el.modalBeanName.focus();
            savingRecipe = true;
            el.modalSaveRecipe.disabled = true;

            // ── Guest trial gate ────────────────────────────────────────
            // First-time visitors may save ONE recipe locally to try the app.
            // Saving a second requires a login, which moves their data to the
            // cloud (Firestore) where we manage it across devices.
            //
            // 예전에는 confirm()으로 "로그인할래?"를 물었다. 제공자가 구글·카카오
            // 둘이 된 지금은 confirm으로 선택을 받을 수 없어서 선택 시트로 바꿨다.
            // 시트를 그냥 닫은 것과 로그인 실패는 똑같이 null로 돌아오고, 둘 다
            // "두 번째 레시피를 저장하지 않는다"는 같은 결론이라 함께 다룬다.
            let guestFirstSave = false;
            if (!auth.currentUser) {
                if (CoffeeNotesStorage.getLocalRecipeCount() >= 1) {
                    track('guest_gate_shown');
                    const user = await signInWithChooser({
                        source: 'guest_gate',
                        lang: currentLang,
                        desc: currentLang === 'ko'
                            ? '무료 체험은 레시피 1개까지 저장할 수 있어요. 로그인하면 체험으로 남긴 기록도 계정으로 함께 옮겨갑니다.'
                            : 'The free trial saves 1 recipe. Sign in to keep going — your trial recipe moves into your account too.'
                    });
                    if (!user) {
                        track('guest_gate_declined');
                        return; // declined → don't save the 2nd recipe
                    }
                    track('guest_gate_accepted');
                    // Point storage at the cloud now so this save lands in Firestore
                    // (don't wait on the async onAuthStateChanged callback), and
                    // carry the trial recipe into the account before saving this one.
                    CoffeeNotesStorage.setCurrentUser(user);
                    await CoffeeNotesStorage.migrateLocalToCloud();
                } else {
                    guestFirstSave = true; // first free recipe → save locally
                }
            }

            const ratingInput = el.modalOverallRatingContainer.querySelector('input[name="overallRating"]:checked');
            const weatherValue = lastWeatherText || (currentLang === 'ko' ? '날씨 정보 없음' : 'Weather unavailable');

            // Limit to 1MB (Firestore document limit)
            if (uploadedImageData && uploadedImageData.length > 1 * 1024 * 1024) {
                alert(currentLang === 'ko' ? '이미지 크기가 너무 큽니다. 다른 사진을 선택해 주세요.' : 'Image size is too large. Please choose another photo.');
                return;
            }

            const recipe = {
                date: new Date().toISOString(), mode: currentMode,
                dosing: parseFloat(parseFloat(el.rDosing.value).toFixed(1)),
                temp: parseFloat(parseFloat(el.rTemp.value).toFixed(1)),
                time: parseFloat(parseFloat(el.rTime.value).toFixed(1)),
                yield: parseFloat(parseFloat(el.rYield.value).toFixed(1)),
                beanName: bean, origin: el.modalOrigin.value.trim(), purchaseUrl: el.modalPurchaseUrl.value.trim(), imageUrl: uploadedImageData, tasteNotes: el.modalTasteNotes.value.trim(), 
                overallRating: ratingInput ? parseInt(ratingInput.value, 10) : 3, 
                success: successResult, weather: weatherValue,
                beanStatus: el.modalBeanStatus.value
            };

            const saved = await CoffeeNotesStorage.saveRecipe(recipe);
            track(saved ? 'recipe_saved' : 'recipe_save_failed', {
                mode: currentMode,
                has_photo: !!uploadedImageData,
                guest: !auth.currentUser,
                rated: !!ratingInput,
                success_flag: successResult,
            });
            if (saved) {
                if (guestFirstSave) {
                    alert(currentLang === 'ko'
                        ? "체험 레시피가 저장됐어요! ☕\n레시피를 더 기록하려면 카카오나 구글로 로그인만 하면 됩니다."
                        : "Your trial recipe is saved! ☕\nJust sign in to record more.");
                } else {
                    alert(i18n[currentLang].recipeSavedSuccess);
                }
                window.location.href = 'logbook.html';
            } else {
                alert(i18n[currentLang].recipeSavedFail);
            }
        } catch (error) {
            console.error("Save failed:", error);
            track('recipe_save_failed', { mode: currentMode, reason: 'exception' });
            alert(i18n[currentLang].recipeSavedFail);
        } finally {
            // 성공 시엔 곧 logbook으로 이동하지만, 이동이 취소되는 경우까지
            // 버튼이 잠긴 채 남지 않게 항상 되돌린다.
            savingRecipe = false;
            el.modalSaveRecipe.disabled = false;
        }
    });

    el.modalImageFile.addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        el.fileNameDisplay.innerText = f.name;
        el.btnImageUpload.innerText = currentLang === 'ko' ? '사진 처리 중…' : 'Processing…';
        try {
            // Downscale + JPEG-compress so a full-size phone photo (several MB)
            // fits Firestore's 1MB per-document limit instead of being rejected.
            // Step the size/quality down until it comfortably fits the budget.
            const BUDGET = 950 * 1024; // base64 chars; margin under the 1MB doc cap
            const attempts = [[1600, 1600, 0.72], [1280, 1280, 0.7], [1024, 1024, 0.62], [800, 800, 0.55]];
            let dataUrl = '';
            for (const [w, h, q] of attempts) {
                dataUrl = await compressImage(f, w, h, q);
                if (dataUrl.length <= BUDGET) break;
            }
            uploadedImageData = dataUrl;
            el.btnImageUpload.innerText = i18n[currentLang].photoSelected;
        } catch (err) {
            console.error('Image processing failed:', err);
            uploadedImageData = '';
            el.fileNameDisplay.innerText = '';
            el.btnImageUpload.innerText = i18n[currentLang].selectPhoto;
            alert(currentLang === 'ko' ? '이미지를 처리할 수 없습니다. 다른 사진을 선택해 주세요.' : 'Could not process this image. Please choose another photo.');
        }
    });

    initRulers(); setMode('espresso'); setLang(currentLang); fetchWeather(); updateLogbookBadge();

    // 첫 방문에만 서비스 안내를 자동으로 연다 (닫으면 다시 뜨지 않음)
    let obSeen = true;
    try { obSeen = !!localStorage.getItem(OB_SEEN_KEY); } catch (e) { /* 저장소 접근 불가 시 표시 생략 */ }
    if (!obSeen) setTimeout(openOnboarding, 600);
});

