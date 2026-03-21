document.addEventListener('DOMContentLoaded', () => {
    let currentMode = 'espresso';
    let currentLang = 'en';
    let successResult = false;
    let uploadedImageData = ''; // Base64 image string

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
            modalBeanName: "BEAN NAME", modalPurchaseUrl: "PURCHASE URL",
            modalImageUrl: "COVER PHOTO", modalTasteNotes: "TASTING NOTES",
            modalOverallRating: "RATING", modalSuccessFail: "RESULT",
            modalSave: "Save Recipe →", modalCancel: "Cancel",
            recipeSavedSuccess: "Recipe logged! Opening logbook...",
            recipeSavedFail: "Failed to save recipe.",
            confirmExitModal: "Discard this recipe?",
            progressLabel: "RECIPE COMPLETENESS",
            progressHint: "Add bean name to complete",
            proHintDosing: "Pro range: 18–21g",
            proHintTemp: "Pro range: 90–96°C",
            proHintTime: "Pro range: 25–35sec",
            proHintYield: "Brew ratio: 1:2",
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
            swBtnOpen: "⏱ OPEN STOPWATCH", swBtnClose: "⏱ CLOSE STOPWATCH"
        },
        ko: {
            dosing: "도징량", temp: "물 온도", time: "추출 시간", yield: "추출량",
            save: "레시피 기록하기",
            weather: "📍 위치 확인 중...",
            locationDenied: "📍 위치 접근 거부",
            weatherError: "📍 날씨 정보 없음",
            viewLogbook: "로그북",
            brandTagline: "당신의 추출을 과학으로",
            modalBeanName: "원두 이름", modalPurchaseUrl: "구매처 URL",
            modalImageUrl: "겉표지 사진", modalTasteNotes: "테이스팅 노트",
            modalOverallRating: "평점", modalSuccessFail: "결과",
            modalSave: "레시피 저장하기 →", modalCancel: "취소",
            recipeSavedSuccess: "레시피가 기록되었습니다! 로그북으로 이동합니다...",
            recipeSavedFail: "레시피 저장 실패.",
            confirmExitModal: "이 레시피를 버리겠습니까?",
            progressLabel: "레시피 완성도",
            progressHint: "원두 이름을 기록하면 완성됩니다",
            proHintDosing: "프로 범위: 18–21g",
            proHintTemp: "프로 범위: 90–96°C",
            proHintTime: "프로 범위: 25–35sec",
            proHintYield: "브루 비율: 1:2",
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
            swBtnOpen: "⏱ 스톱워치 열기", swBtnClose: "⏱ 스톱워치 닫기"
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
        modalPurchaseUrl: document.getElementById('modal-purchase-url'),
        modalImageFile: document.getElementById('modal-image-file'),
        btnImageUpload: document.getElementById('btn-image-upload'),
        fileNameDisplay: document.getElementById('file-name-display'),
        modalTasteNotes: document.getElementById('modal-taste-notes'),
        modalOverallRatingContainer: document.getElementById('modal-overall-rating-container'),
        modalSuccessFail: document.getElementById('modal-success-fail'),
        modalSaveRecipe: document.getElementById('modal-save-recipe'),
        modalCancel: document.getElementById('modal-cancel'),
        lblModalBeanName: document.getElementById('lbl-modal-bean-name'),
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
    };

    // ===== Stopwatch State =====
    const sw = {
        running: false,
        elapsed: 0,
        startTime: null,
        rafId: null,
        done: false,
    };

    const RING_CIRC = 326.7;
    const swGetMax = () => currentMode === 'espresso' ? 60 : 300;

    const swFormatTime = (ms) => {
        const total = ms / 1000;
        const min = Math.floor(total / 60);
        const sec = Math.floor(total % 60);
        const tenth = Math.floor((ms % 1000) / 100);
        if (min > 0) return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${tenth}`;
        return `${String(sec).padStart(2,'0')}.${tenth}`;
    };

    const swUpdateRing = (elapsed) => {
        const max = swGetMax() * 1000;
        const pct = Math.min(elapsed / max, 1);
        const offset = RING_CIRC * (1 - pct);
        el.swRingProgress.style.strokeDashoffset = offset;

        if (elapsed > max) {
            el.swRingProgress.style.stroke = 'var(--danger)';
        } else if (!sw.running && elapsed > 0) {
            el.swRingProgress.style.stroke = 'var(--success)';
        } else {
            el.swRingProgress.style.stroke = 'var(--accent)';
        }
    };

    const swTick = () => {
        if (!sw.running) return;
        sw.elapsed = Date.now() - sw.startTime;
        el.swTime.textContent = swFormatTime(sw.elapsed);
        swUpdateRing(sw.elapsed);
        sw.rafId = requestAnimationFrame(swTick);
    };

    const swStart = () => {
        sw.running = true;
        sw.done = false;
        sw.startTime = Date.now() - sw.elapsed;
        el.swTime.classList.add('running');
        el.swTime.classList.remove('done');
        el.swStatus.textContent = i18n[currentLang].swStatusRunning;
        el.lblSwStart.textContent = i18n[currentLang].swStop;
        el.swBtnStart.classList.add('stop-mode');
        el.swBtnReset.disabled = false;
        el.swBtnApply.disabled = true;
        el.swHint.textContent = i18n[currentLang].swHintRunning;
        sw.rafId = requestAnimationFrame(swTick);
    };

    const swStop = () => {
        sw.running = false;
        sw.done = true;
        cancelAnimationFrame(sw.rafId);
        el.swTime.classList.remove('running');
        el.swTime.classList.add('done');
        el.swStatus.textContent = i18n[currentLang].swStatusDone;
        el.lblSwStart.textContent = i18n[currentLang].swRestart;
        el.swBtnStart.classList.remove('stop-mode');
        el.swBtnApply.disabled = false;
        swUpdateRing(sw.elapsed);

        const secs = sw.elapsed / 1000;
        const proLow = currentMode === 'espresso' ? 25 : 120;
        const proHigh = currentMode === 'espresso' ? 35 : 240;
        
        let hintKey = 'swHintIdeal';
        if (secs < proLow) hintKey = 'swHintUnder';
        else if (secs > proHigh) hintKey = 'swHintOver';
        
        el.swHint.textContent = i18n[currentLang][hintKey].replace('{sec}', secs.toFixed(1));
    };

    const swReset = () => {
        cancelAnimationFrame(sw.rafId);
        sw.running = false;
        sw.done = false;
        sw.elapsed = 0;
        sw.startTime = null;
        el.swTime.textContent = '00.0';
        el.swTime.classList.remove('running','done');
        el.swStatus.textContent = i18n[currentLang].swStatusReady;
        el.lblSwStart.textContent = i18n[currentLang].swStart;
        el.swBtnStart.classList.remove('stop-mode');
        el.swBtnReset.disabled = true;
        el.swBtnApply.disabled = true;
        el.swRingProgress.style.strokeDashoffset = RING_CIRC;
        el.swHint.textContent = i18n[currentLang].swHintReady;
    };

    const swApply = () => {
        if (sw.elapsed === 0) return;
        const secs = sw.elapsed / 1000;
        const max = swGetMax();
        const clamped = Math.min(Math.max(secs, 0), max);
        const step = currentMode === 'espresso' ? 0.5 : 1;
        const snapped = Math.round(clamped / step) * step;

        el.rTime.value = snapped;
        updateVal('time', snapped);

        el.swBtnApply.textContent = '✓';
        el.swHint.textContent = i18n[currentLang].swApplied.replace('{sec}', snapped);

        setTimeout(() => {
            el.lblSwApply.textContent = i18n[currentLang].swApply;
            el.stopwatchPanel.classList.remove('open');
            el.btnStopwatch.classList.remove('active');
            el.lblStopwatch.textContent = i18n[currentLang].swBtnOpen;
        }, 1500);
    };

    // ===== Marketing & Logic =====
    const qualityRanges = {
        espresso: {
            dosing:  { low: 14, idealLow: 17, idealHigh: 22, high: 26 },
            temp:    { low: 85, idealLow: 90, idealHigh: 96, high: 99 },
            time:    { low: 20, idealLow: 25, idealHigh: 35, high: 45 },
            yield:   { low: 15, idealLow: 30, idealHigh: 50, high: 58 },
        },
        drip: {
            dosing:  { low: 10, idealLow: 15, idealHigh: 25, high: 35 },
            temp:    { low: 85, idealLow: 90, idealHigh: 96, high: 99 },
            time:    { low: 90, idealLow: 120, idealHigh: 240, high: 280 },
            yield:   { low: 80, idealLow: 150, idealHigh: 400, high: 500 },
        }
    };

    const getQualityLabel = (val, key) => {
        const r = qualityRanges[currentMode][key];
        if (val < r.low || val > r.high) return 'extreme';
        if (val < r.idealLow || val > r.idealHigh) return 'low';
        return 'ideal';
    };

    const updateQualityBadge = (badgeEl, label) => {
        badgeEl.className = `quality-badge ${label}`;
        const labels = { ideal: 'IDEAL', low: 'CHECK', high: 'CHECK', extreme: 'OFF' };
        badgeEl.textContent = labels[label] || 'IDEAL';
    };

    const updateBrewRatio = () => {
        const dosing = parseFloat(el.rDosing.value);
        const yieldVal = parseFloat(el.rYield.value);
        const ratio = yieldVal / dosing;
        el.ratioNum.textContent = `1 : ${ratio.toFixed(1)}`;

        const coffeeWidth = (dosing / (dosing + yieldVal)) * 100;
        el.ratioCoffeeBar.style.width = `${coffeeWidth}%`;

        const lang = i18n[currentLang];
        let isIdeal;
        if (currentMode === 'espresso') {
            isIdeal = ratio >= 1.5 && ratio <= 2.5;
        } else {
            isIdeal = ratio >= 13 && ratio <= 18;
        }

        el.ratioStatus.textContent = isIdeal ? lang.ratioIdeal : lang.ratioWarning;
        el.ratioStatus.className = `ratio-status ${isIdeal ? 'ideal' : 'warning'}`;
    };

    const updateProgress = () => {
        let score = 75; 
        const beanFilled = el.modalBeanName && el.modalBeanName.value.trim().length > 0;
        if (beanFilled) score = 100;

        el.progressFill.style.width = `${score}%`;
        el.progressPct.textContent = `${score}%`;
        el.progressHint.textContent = beanFilled
            ? (currentLang === 'ko' ? '완성된 레시피입니다 ✓' : 'Recipe complete ✓')
            : i18n[currentLang].progressHint;
    };

    const updateLogbookBadge = () => {
        const recipes = (typeof CoffeeNotesStorage !== 'undefined') ? CoffeeNotesStorage.getRecipes() : [];
        const count = recipes.length;
        el.logbookCount.textContent = count;
        el.logbookCount.style.display = count > 0 ? 'flex' : 'none';

        const today = new Date().toDateString();
        const todayCount = recipes.filter(r => new Date(r.date).toDateString() === today).length;
        el.dailyCount.textContent = todayCount;
    };

    const setMode = (mode) => {
        currentMode = mode;
        el.btnEspresso.classList.toggle('active', mode === 'espresso');
        el.btnDrip.classList.toggle('active', mode === 'drip');

        if (mode === 'espresso') {
            el.rTime.max = 60; el.rTime.step = 0.5; el.rTime.value = 28.5;
            el.rYield.max = 60; el.rYield.step = 1; el.rYield.value = 36;
            el.uTime.textContent = "sec";
        } else {
            el.rTime.max = 300; el.rTime.step = 1; el.rTime.value = 150;
            el.rYield.max = 600; el.rYield.step = 5; el.rYield.value = 250;
            el.uTime.textContent = "sec";
        }

        updateVal('dosing', el.rDosing.value);
        updateVal('temp', el.rTemp.value);
        updateVal('time', el.rTime.value);
        updateVal('yield', el.rYield.value);
        updateBrewRatio();
        updateProHints();
        if (el.stopwatchPanel.classList.contains('open')) swReset();
    };

    const updateVal = (id, val) => {
        let displayVal = parseFloat(val);
        let displayStr = '';

        if (id === 'time' && currentMode === 'drip' && displayVal >= 60) {
            const m = Math.floor(displayVal / 60);
            const s = displayVal % 60;
            displayStr = `${m}:${s < 10 ? '0' + s : s}`;
        } else {
            displayStr = (id === 'dosing' || id === 'yield') ? displayVal.toFixed(1) : displayVal.toString();
        }

        const vEl = el[`v${id.charAt(0).toUpperCase() + id.slice(1)}`];
        if (vEl) vEl.textContent = displayStr;

        const qbEl = el[`qb${id.charAt(0).toUpperCase() + id.slice(1)}`];
        if (qbEl) {
            const quality = getQualityLabel(parseFloat(val), id);
            updateQualityBadge(qbEl, quality);
        }

        // Update Visuals
        if (id === 'dosing') {
            const pct = (displayVal - 7) / (40 - 7) * 100;
            el.visDosing.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        }
        if (id === 'temp') {
            const pct = (displayVal - 80) / (100 - 80) * 100;
            el.visTemp.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        }

        if (window.navigator.vibrate) window.navigator.vibrate(5);
        updateBrewRatio();
        updateProgress();
    };

    const updateProHints = () => {
        const lang = i18n[currentLang];
        el.hintDosing.textContent = lang.proHintDosing;
        el.hintTemp.textContent = lang.proHintTemp;
        el.hintTime.textContent = lang.proHintTime;
        el.hintYield.textContent = lang.proHintYield;
        el.ratioLabel.textContent = lang.ratioLabel;
    };

    const setLang = (lang) => {
        currentLang = lang;
        el.btnLangEn.classList.toggle('active', lang === 'en');
        el.btnLangKo.classList.toggle('active', lang === 'ko');

        const t = i18n[lang];
        el.lblDosing.textContent = t.dosing;
        el.lblTemp.textContent = t.temp;
        el.lblTime.textContent = t.time;
        el.lblYield.textContent = t.yield;
        el.lblSave.textContent = t.save;
        el.saveNudge.textContent = t.savingNudge;
        el.brandTagline.textContent = t.brandTagline;
        el.progressLabelText.textContent = t.progressLabel;

        if (el.lblModalBeanName) el.lblModalBeanName.textContent = t.modalBeanName;
        if (el.lblModalPurchaseUrl) el.lblModalPurchaseUrl.textContent = t.modalPurchaseUrl;
        if (el.lblModalImageUrl) el.lblModalImageUrl.textContent = t.modalImageUrl;
        if (el.lblModalTasteNotes) el.lblModalTasteNotes.textContent = t.modalTasteNotes;
        if (el.lblModalOverallRating) el.lblModalOverallRating.textContent = t.modalOverallRating;
        if (el.lblModalSuccessFail) el.lblModalSuccessFail.textContent = t.modalSuccessFail;
        if (el.lblModalSave) el.lblModalSave.textContent = t.modalSave;
        if (el.modalTitle) el.modalTitle.textContent = t.modalTitle;
        if (el.modalSubtitle) el.modalSubtitle.textContent = t.modalSubtitle;
        if (el.btnImageUpload) el.btnImageUpload.innerText = uploadedImageData ? t.photoSelected : t.selectPhoto;
        
        el.lblStopwatch.textContent = el.stopwatchPanel.classList.contains('open') ? t.swBtnClose : t.swBtnOpen;
        el.lblSwStart.textContent = sw.running ? t.swStop : (sw.done ? t.swRestart : t.swStart);
        el.lblSwReset.textContent = "RESET";
        el.lblSwApply.textContent = t.swApply;
        el.swStatus.textContent = sw.running ? t.swStatusRunning : (sw.done ? t.swStatusDone : t.swStatusReady);

        updateProHints();
        updateProgress();
        updateBrewRatio();
    };

    const fetchWeather = () => {
        const infoSpan = el.weatherInfo.querySelector('span:last-child');
        const setFallback = (msg) => {
            const defaultLoc = currentLang === 'ko' ? '서울' : 'SEOUL';
            if (infoSpan) infoSpan.innerHTML = `📍 <span contenteditable="true" class="editable-loc" title="Click to edit">${defaultLoc}</span> · ☀️ 18°C · 💧 45% <br><small style="font-size:0.7em; opacity:0.6;">(${msg})</small>`;
        };

        if (!WEATHERAPI_KEY || WEATHERAPI_KEY === 'YOUR_WEATHERAPI_KEY') {
            setFallback(currentLang === 'ko' ? "API 키 필요" : "API Key Required"); return;
        }
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude: lat, longitude: lon } = pos.coords;
                const langCode = currentLang === 'ko' ? 'ko' : 'en';
                const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no&lang=${langCode}`;
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    
                    // Improve location name: combine region and name if helpful
                    const city = data.location.name;
                    const region = data.location.region;
                    const locationName = (region && !region.includes(city)) ? `${region} ${city}` : city;
                    
                    const temp = Math.round(data.current.temp_c);
                    const humidity = data.current.humidity;
                    const iconUrl = data.current.condition.icon;
                    if (infoSpan) infoSpan.innerHTML = `📍 <span contenteditable="true" class="editable-loc" title="Click to edit">${locationName}</span> · <img src="${iconUrl}" style="vertical-align:middle;height:16px;"> ${temp}°C · 💧 ${humidity}%`;
                    
                    if (humidity > 65) el.envHint.textContent = currentLang === 'ko' ? `습도 ${humidity}% — 분쇄도를 약간 굵게 조정하세요` : `Humidity ${humidity}% — try slightly coarser grind`;
                    else if (humidity < 40) el.envHint.textContent = currentLang === 'ko' ? `습도 ${humidity}% — 추출 강도 +0.5g 권장` : `Humidity ${humidity}% — consider +0.5g dosing`;
                    else el.envHint.textContent = currentLang === 'ko' ? '추출 조건 최적' : 'Ideal conditions';
                } catch (e) { setFallback(currentLang === 'ko' ? "에러 발생" : "Error occurred"); }
            }, (err) => {
                const msg = err.code === 1 
                    ? (currentLang === 'ko' ? "위치 권한 거부됨" : "Location Denied")
                    : (currentLang === 'ko' ? "위치 오류" : "Location Error");
                setFallback(msg);
            }, {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 0
            });
        }
    };

    // --- Events ---
    // Handle Enter key on editable location
    document.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('editable-loc') && e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        }
    });

    el.btnEspresso.addEventListener('click', () => setMode('espresso'));
    el.btnDrip.addEventListener('click', () => setMode('drip'));
    el.btnLangEn.addEventListener('click', () => setLang('en'));
    el.btnLangKo.addEventListener('click', () => setLang('ko'));
    el.btnViewLogbook.addEventListener('click', () => window.location.href = 'logbook.html');

    el.rDosing.addEventListener('input', (e) => updateVal('dosing', e.target.value));
    el.rTemp.addEventListener('input', (e) => updateVal('temp', e.target.value));
    el.rTime.addEventListener('input', (e) => updateVal('time', e.target.value));
    el.rYield.addEventListener('input', (e) => updateVal('yield', e.target.value));

    el.btnStopwatch.addEventListener('click', () => {
        const isOpen = el.stopwatchPanel.classList.toggle('open');
        el.btnStopwatch.classList.toggle('active', isOpen);
        el.lblStopwatch.textContent = isOpen ? i18n[currentLang].swBtnClose : i18n[currentLang].swBtnOpen;
        if (isOpen && !sw.running && !sw.done) swReset();
    });
    el.swBtnStart.addEventListener('click', () => { if (sw.running) swStop(); else swStart(); });
    el.swBtnReset.addEventListener('click', swReset);
    el.swBtnApply.addEventListener('click', swApply);

    el.btnSave.addEventListener('click', openModal);
    el.modalCancel.addEventListener('click', () => closeModal());
    el.recipeModal.querySelector('.modal-backdrop')?.addEventListener('click', () => closeModal());

    el.btnFail.addEventListener('click', () => {
        successResult = false; el.modalSuccessFail.checked = false;
        el.btnFail.classList.add('active'); el.btnSuccess.classList.remove('active');
    });
    el.btnSuccess.addEventListener('click', () => {
        successResult = true; el.modalSuccessFail.checked = true;
        el.btnFail.classList.remove('active'); el.btnSuccess.classList.add('active');
    });

    el.modalSaveRecipe.addEventListener('click', () => {
        const beanName = el.modalBeanName.value.trim();
        if (!beanName) { el.modalBeanName.focus(); return; }

        const recipe = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            mode: currentMode,
            dosing: parseFloat(el.rDosing.value),
            temp: parseFloat(el.rTemp.value),
            time: parseFloat(el.rTime.value),
            yield: parseFloat(el.rYield.value),
            beanName,
            purchaseUrl: el.modalPurchaseUrl.value.trim(),
            imageUrl: uploadedImageData,
            tasteNotes: el.modalTasteNotes.value.trim(),
            overallRating: getSelectedRating(),
            success: successResult,
            weather: el.weatherInfo.querySelector('span:last-child').innerHTML
        };

        if (typeof CoffeeNotesStorage !== 'undefined' && CoffeeNotesStorage.saveRecipe(recipe)) {
            alert(i18n[currentLang].recipeSavedSuccess);
            window.location.href = 'logbook.html';
        }
    });

    setLang(currentLang);
    setMode(currentMode);
    fetchWeather();
    updateLogbookBadge();
    updateProgress();
});