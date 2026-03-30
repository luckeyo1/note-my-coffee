// main.js
import { 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "./firebase-config.js";
import CoffeeNotesStorage from "./storage.js";

document.addEventListener('DOMContentLoaded', () => {
    let currentMode = 'espresso';
    let currentLang = 'en';
    let successResult = false;
    let uploadedImageData = ''; // Base64 image string
    let audioCtx = null;

    // IMPORTANT: Replace 'YOUR_WEATHERAPI_KEY' with your actual WeatherAPI.com API key.
    const WEATHERAPI_KEY = '549486968354490e95c131115262003';

    const i18n = {
        en: {
            dosing: "DOSING", temp: "WATER TEMP", time: "EXTRACTION TIME", yield: "YIELD",
            save: "LOG THIS RECIPE",
            weather: "📍 Getting location...",
            locationDenied: "📍 Location denied",
            weatherError: "📍 Weather unavailable",
            viewLogbook: "LOG BOOK",
            brandTagline: "Turn extraction into science",
            lblLogin: "Login with Google",
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
            proHintYield: "Brew ratio: 1:{ratio}",
            ratioLabel: "BREW RATIO",
            ratioIdeal: "✓ SCA recommended",
            ratioWarning: "⚡ Adjust for balance",
            savingNudge: "Unsaved recipes are lost forever",
            modalTitle: "Complete Your Recipe",
            modalSubtitle: "Adding bean info lets you recreate this cup perfectly",
            trustRecipes: "recipes logged today",
            selectPhoto: "📷 Choose Photo",
            photoSelected: "✓ Photo Selected",
            swStart: "START", swStop: "STOP", swRestart: "RESTART", swApply: "APPLY",
            swStatusReady: "READY", swStatusRunning: "RUNNING", swStatusDone: "DONE",
            swHintReady: "Press START to begin extraction",
            swHintRunning: "Extracting… press STOP to record",
            swHintUnder: "⚡ {sec}s — possible under-extraction",
            swHintOver: "⚡ {sec}s — possible over-extraction",
            swHintIdeal: "✓ {sec}s — within SCA range",
            swApplied: "{sec}s applied to extraction time",
            swBtnOpen: "⏱ OPEN STOPWATCH", swBtnClose: "⏱ CLOSE STOPWATCH",
            originTags: ["Ethiopia", "Colombia", "Brazil", "Kenya", "Guatemala", "Indonesia", "Costa Rica", "Panama"],
            tasteTags: ["Floral", "Fruity", "Nutty", "Chocolaty", "Sweet", "Acidic", "Bitter", "Spicy"]
        },
        ko: {
            dosing: "도징량", temp: "물 온도", time: "추출 시간", yield: "추출 량",
            save: "레시피 기록하기",
            weather: "📍 위치 확인 중...",
            locationDenied: "📍 위치 접근 거부",
            weatherError: "📍 날씨 정보 없음",
            viewLogbook: "로그북",
            brandTagline: "당신의 추출을 과학으로",
            lblLogin: "구글 로그인",
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
            proHintTime: "프로 범위: {min}–{max}sec",
            proHintYield: "브루 비율: 1:{ratio}",
            ratioLabel: "브루 레이시오",
            ratioIdeal: "✓ SCA 권장 범위",
            ratioWarning: "⚡ 균형을 위해 조정 필요",
            savingNudge: "지금 기록하지 않으면 이 레시피는 사라집니다",
            modalTitle: "레시피 완성하기",
            modalSubtitle: "원두 정보를 추가하면 나중에 재현할 수 있습니다",
            trustRecipes: "개의 레시피가 오늘 기록됨",
            selectPhoto: "📷 사진 선택하기",
            photoSelected: "✓ 사진 선택됨",
            swStart: "시작", swStop: "정지", swRestart: "재시작", swApply: "적용",
            swStatusReady: "준비", swStatusRunning: "추출 중", swStatusDone: "완료",
            swHintReady: "시작을 누르고 추출을 시작하세요",
            swHintRunning: "추출 중... 정지를 누르면 기록됩니다",
            swHintUnder: "⚡ {sec}초 — 과소추출 가능성",
            swHintOver: "⚡ {sec}초 — 과다추출 가능성",
            swHintIdeal: "✓ {sec}초 — SCA 권장 범위 내",
            swApplied: "{sec}초가 추출 시간에 반영되었습니다",
            swBtnOpen: "⏱ 스톱워치 열기", swBtnClose: "⏱ 스톱워치 닫기",
            originTags: ["에티오피아", "콜롬비아", "브라질", "케냐", "과테말라", "인도네시아", "코스타리카", "파나마"],
            tasteTags: ["플로럴", "프루티", "고소한", "초콜릿", "달콤한", "산미있는", "쌉쌀한", "스파이시"]
        }
    };

    // --- Element Cache ---
    const el = {
        btnEspresso: document.getElementById('btn-espresso'),
        btnDrip: document.getElementById('btn-drip'),
        btnLangEn: document.getElementById('l-en'),
        btnLangKo: document.getElementById('l-ko'),
        btnViewLogbook: document.getElementById('btn-view-logbook'),
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
        progressFill: document.getElementById('progress-fill'),
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
    onAuthStateChanged(auth, (user) => {
        if (user) {
            el.btnLogin.style.display = 'none';
            el.userProfile.style.display = 'flex';
            el.userPhoto.src = user.photoURL || '';
            el.userName.textContent = user.displayName || 'User';
            CoffeeNotesStorage.setCurrentUser(user);
        } else {
            el.btnLogin.style.display = 'flex';
            el.userProfile.style.display = 'none';
            CoffeeNotesStorage.setCurrentUser(null);
        }
        updateLogbookBadge();
    });

    el.btnLogin.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed", error);
        }
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
            const recentBeans = await CoffeeNotesStorage.getRecentBeans();
            if (recentBeans.length > 0) {
                el.openedBeansContainer.innerHTML = recentBeans
                    .map(bean => `<span class="taste-tag" data-bean="${bean}">${bean}</span>`)
                    .join('');
                el.openedBeansContainer.style.display = 'flex';

                // Add click events to chips
                el.openedBeansContainer.querySelectorAll('.taste-tag').forEach(chip => {
                    chip.addEventListener('click', () => {
                        el.modalBeanName.value = chip.getAttribute('data-bean');
                        updateProgress();
                    });
                });
            } else {
                el.openedBeansContainer.style.display = 'none';
            }
        } else {
            el.openedBeansContainer.style.display = 'none';
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

        let displaySecs;
        if (currentMode === 'drip' && secs >= 60) {
            displaySecs = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
        } else {
            displaySecs = secs.toFixed(1);
        }
        el.swHint.textContent = i18n[currentLang][k].replace('{sec}', displaySecs);
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
        if (sw.elapsed === 0) return;
        const snapped = Math.floor((sw.elapsed / 1000) * 10) / 10;
        el.rTime.value = snapped.toFixed(1);
        updateVal('time', snapped);
        syncRuler('time', snapped);
        el.swBtnApply.textContent = '✓';
        el.swHint.textContent = i18n[currentLang].swApplied.replace('{sec}', snapped.toFixed(1));
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
        if (id === 'time' && currentMode === 'drip' && dv >= 60) {
            const m = Math.floor(dv / 60); const s = (dv % 60).toFixed(1);
            ds = `${m}:${s < 10 ? '0' + s : s}`;
        } else {
            ds = dv.toFixed(1);
        }
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

    const setMode = (mode) => {
        currentMode = mode;
        el.btnEspresso.classList.toggle('active', mode === 'espresso');
        el.btnDrip.classList.toggle('active', mode === 'drip');

        const timeMax = mode === 'espresso' ? 60 : 300;
        const yieldMax = mode === 'espresso' ? 60 : 600;
        el.rTime.max = timeMax;
        el.rYield.max = yieldMax;

        if (el.zTimeMax) el.zTimeMax.textContent = `${timeMax}s`;
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

        updateBrewRatio(); updateProHints();
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

    const fetchWeather = () => {
        const infoSpan = el.weatherInfo.querySelector('span:last-child');
        const setFallback = (msg) => { 
            const defaultWeather = currentLang === 'ko' ? "📍 서울 · ☀️ 18.0°C · 💧 45%" : "📍 SEOUL · ☀️ 18.0°C · 💧 45%";
            if (infoSpan) infoSpan.innerHTML = `${defaultWeather} <br><small style="font-size:0.7em; opacity:0.6;">(${msg})</small>`; 
        };

        if (infoSpan) infoSpan.innerHTML = i18n[currentLang].weather;

        if (!WEATHERAPI_KEY) return setFallback(currentLang === 'ko' ? "API 키 필요" : "API Key Required");

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude: lat, longitude: lon } = pos.coords;
                const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no&lang=${currentLang === 'ko' ? 'ko' : 'en'}`;
                try {
                    const res = await fetch(url); const data = await res.json();
                    const city = data.location.name; const temp = data.current.temp_c; const hum = data.current.humidity; const icon = data.current.condition.icon;
                    if (infoSpan) infoSpan.innerHTML = `📍 ${city} · <img src="${icon}" style="vertical-align:middle;height:16px;"> ${temp.toFixed(1)}°C · 💧 ${hum}%`;
                    if (hum > 65) el.envHint.textContent = currentLang === 'ko' ? `습도 ${hum}% — 분쇄도를 약간 굵게 조정하세요` : `Humidity ${hum}% — try slightly coarser grind`;
                    else if (hum < 40) el.envHint.textContent = currentLang === 'ko' ? `습도 ${hum}% — 추출 강도 +0.5g 권장` : `Humidity ${hum}% — consider +0.5g dosing`;
                    else el.envHint.textContent = currentLang === 'ko' ? '추출 조건 최적' : 'Ideal conditions';
                } catch (e) { setFallback(currentLang === 'ko' ? "데이터 오류" : "API Error"); }
            }, (err) => {
                let msg = currentLang === 'ko' ? "위치 권한 필요" : "Location Denied";
                if (err.code === 1) msg = currentLang === 'ko' ? "위치 차단됨" : "Location Blocked";
                setFallback(msg);
            }, { timeout: 10000 });
        } else {
            setFallback(currentLang === 'ko' ? "지원 안 함" : "Not Supported");
        }
    };

    const updateBrewRatio = () => {
        const d = parseFloat(el.rDosing.value); const y = parseFloat(el.rYield.value); const r = y / d;
        el.ratioNum.textContent = `1 : ${r.toFixed(1)}`;
        el.ratioCoffeeBar.style.width = `${(d / (d + y)) * 100}%`;
        let ideal = currentMode === 'espresso' ? (r >= 1.5 && r <= 2.5) : (r >= 13 && r <= 18);
        el.ratioStatus.textContent = ideal ? i18n[currentLang].ratioIdeal : i18n[currentLang].ratioWarning;
        el.ratioStatus.className = `ratio-status ${ideal ? 'ideal' : 'warning'}`;
    };

    const updateProgress = () => {
        let score = (el.modalBeanName && el.modalBeanName.value.trim().length > 0) ? 100 : 75;
        el.progressFill.style.width = `${score}%`; el.progressPct.textContent = `${score}%`;
        el.progressHint.textContent = score === 100 ? (currentLang === 'ko' ? '완성된 레시피입니다 ✓' : 'Recipe complete ✓') : i18n[currentLang].progressHint;
    };

    const updateLogbookBadge = async () => {
        const recipes = await CoffeeNotesStorage.getRecipes();
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

        // Time
        let tMin = qr.time.idealLow, tMax = qr.time.idealHigh;
        let tMinStr, tMaxStr;
        if (currentMode === 'drip') {
            tMinStr = `${Math.floor(tMin / 60)}:${String(tMin % 60).padStart(2, '0')}`;
            tMaxStr = `${Math.floor(tMax / 60)}:${String(tMax % 60).padStart(2, '0')}`;
        } else {
            tMinStr = tMin.toFixed(1);
            tMaxStr = tMax.toFixed(1);
        }
        el.hintTime.textContent = t.proHintTime.replace('{min}', tMinStr).replace('{max}', tMaxStr);

        // Yield (Ratio)
        let ratioStr = currentMode === 'espresso' ? "1:2.0" : "1:15–1:18";
        el.hintYield.textContent = t.proHintYield.replace('{ratio}', ratioStr.split(':')[1] || ratioStr);

        el.ratioLabel.textContent = t.ratioLabel;
    };

    const renderTagCloud = (container, tags, inputEl) => {
        container.innerHTML = tags.map(tag => `<span class="taste-tag" data-value="${tag}">#${tag}</span>`).join('');
        container.querySelectorAll('.taste-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                tag.classList.toggle('active');
                const val = tag.getAttribute('data-value');
                let currentVals = inputEl.value.split(',').map(s => s.trim()).filter(s => s);
                if (tag.classList.contains('active')) {
                    if (!currentVals.includes(val)) currentVals.push(val);
                } else {
                    currentVals = currentVals.filter(s => s !== val);
                }
                inputEl.value = currentVals.join(', ');
            });
        });
    };

    const setLang = (lang) => {
        currentLang = lang; ['btnLangEn','btnLangKo'].forEach(k => el[k].classList.toggle('active', k.toLowerCase().endsWith(lang)));
        const t = i18n[lang]; ['lblDosing','lblTemp','lblTime','lblYield','lblSave','saveNudge','brandTagline','progressLabelText'].forEach(k => el[k].textContent = t[k.replace('lbl','').toLowerCase()] || t[k]);
        ['lblModalBeanName','lblModalOrigin','lblModalPurchaseUrl','lblModalImageUrl','lblModalTasteNotes','lblModalOverallRating','lblModalSuccessFail','lblModalSave','modalTitle','modalSubtitle','lblLogin','lblModalBeanStatus'].forEach(k => {
            if (el[k]) el[k].textContent = t[k.replace('lbl','').charAt(0).toLowerCase() + k.replace('lbl','').slice(1)] || t[k];
        });
        if (el.btnStatusNew) el.btnStatusNew.textContent = t.statusNew;
        if (el.btnStatusOpen) el.btnStatusOpen.textContent = t.statusOpen;
        if (el.btnImageUpload) el.btnImageUpload.innerText = uploadedImageData ? t.photoSelected : t.selectPhoto;
        el.lblStopwatch.textContent = el.stopwatchPanel.classList.contains('open') ? t.swBtnClose : t.swBtnOpen;
        el.lblSwStart.textContent = sw.running ? t.swStop : (sw.done ? t.swRestart : t.swStart);
        el.swStatus.textContent = sw.running ? t.swStatusRunning : (sw.done ? t.swStatusDone : t.swStatusReady);

        renderTagCloud(el.originTagCloud, t.originTags, el.modalOrigin);
        renderTagCloud(el.tasteTagCloud, t.tasteTags, el.modalTasteNotes);

        updateProHints(); updateProgress(); updateBrewRatio(); fetchWeather();
    };

    // --- Events ---
    el.btnEspresso.addEventListener('click', () => setMode('espresso'));
    el.btnDrip.addEventListener('click', () => setMode('drip'));
    el.btnLangEn.addEventListener('click', () => setLang('en'));
    el.btnLangKo.addEventListener('click', () => setLang('ko'));
    el.btnViewLogbook.addEventListener('click', () => window.location.href = 'logbook.html');

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
        el.modalBeanName.value = ''; el.modalOrigin.value = ''; el.modalPurchaseUrl.value = ''; el.modalImageFile.value = ''; uploadedImageData = ''; el.fileNameDisplay.innerText = ''; el.btnImageUpload.innerText = i18n[currentLang].selectPhoto; el.modalTasteNotes.value = '';
        if (el.tasteTagCloud) el.tasteTagCloud.querySelectorAll('.taste-tag').forEach(t => t.classList.remove('active'));
        if (el.originTagCloud) el.originTagCloud.querySelectorAll('.taste-tag').forEach(t => t.classList.remove('active'));
        el.modalOverallRatingContainer.querySelector('input[value="3"]').checked = true; successResult = false; el.btnFail.classList.add('active'); el.btnSuccess.classList.remove('active'); el.modalSuccessFail.checked = false; 
        setBeanStatus('new'); // Reset to new by default
        setTimeout(() => el.modalBeanName.focus(), 400);
    });

    el.modalCancel.addEventListener('click', () => el.recipeModal.classList.remove('active'));
    el.btnFail.addEventListener('click', () => { successResult = false; el.modalSuccessFail.checked = false; el.btnFail.classList.add('active'); el.btnSuccess.classList.remove('active'); });
    el.btnSuccess.addEventListener('click', () => { successResult = true; el.modalSuccessFail.checked = true; el.btnFail.classList.remove('active'); el.btnSuccess.classList.add('active'); });

    el.modalSaveRecipe.addEventListener('click', async () => {
        try {
            const bean = el.modalBeanName.value.trim(); if (!bean) return el.modalBeanName.focus();

            // Login Nudge
            if (!auth.currentUser) {
                const wantLogin = confirm(currentLang === 'ko' 
                    ? "로그인하지 않고 저장하면 이 기기에만 저장됩니다. 구글 로그인으로 모든 기기에서 레시피를 동기화하시겠습니까?" 
                    : "Saving as guest will only store data on this device. Would you like to login with Google to sync across all devices?");
                if (wantLogin) {
                    try {
                        await signInWithPopup(auth, googleProvider);
                        // After successful login, the onAuthStateChanged will trigger and update the storage user
                    } catch (error) {
                        console.error("Login nudge failed", error);
                    }
                }
            }

            const ratingInput = el.modalOverallRatingContainer.querySelector('input[name="overallRating"]:checked');
            const weatherSpan = el.weatherInfo ? el.weatherInfo.querySelector('span:last-child') : null;
            const weatherValue = weatherSpan ? weatherSpan.innerHTML : (currentLang === 'ko' ? '날씨 정보 없음' : 'Weather unavailable');

            if (uploadedImageData && uploadedImageData.length > 2 * 1024 * 1024) {
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
            if (saved) {
                alert(i18n[currentLang].recipeSavedSuccess);
                window.location.href = 'logbook.html';
            } else {
                alert(i18n[currentLang].recipeSavedFail);
            }
        } catch (error) {
            console.error("Save failed:", error);
            alert(i18n[currentLang].recipeSavedFail);
        }
    });

    el.modalImageFile.addEventListener('change', (e) => {
        const f = e.target.files[0]; if (f) { el.fileNameDisplay.innerText = f.name; const r = new FileReader(); r.onload = (ev) => { uploadedImageData = ev.target.result; el.btnImageUpload.innerText = i18n[currentLang].photoSelected; }; r.readAsDataURL(f); }
    });

    initRulers(); setMode('espresso'); fetchWeather(); updateLogbookBadge();
});

