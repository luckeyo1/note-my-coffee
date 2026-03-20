document.addEventListener('DOMContentLoaded', () => {
    let currentMode = 'espresso';
    let currentLang = 'en';
    let successResult = false;

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
            modalImageUrl: "IMAGE URL", modalTasteNotes: "TASTING NOTES",
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
            trustText: "Pro Barista Edition · today <strong>{count}</strong> recipes logged",
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
            modalImageUrl: "이미지 URL", modalTasteNotes: "테이스팅 노트",
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
            trustText: "Pro Barista Edition · 오늘 <strong>{count}</strong>개의 레시피가 기록되었습니다",
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
        modalImageUrl: document.getElementById('modal-image-url'),
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
        trustText: document.getElementById('trust-text'),
        btnFail: document.getElementById('btn-fail'),
        btnSuccess: document.getElementById('btn-success'),
    };

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
        
        if (el.logbookCount) {
            el.logbookCount.textContent = count;
            el.logbookCount.style.display = count > 0 ? 'flex' : 'none';
        }

        const today = new Date().toDateString();
        const todayCount = recipes.filter(r => new Date(r.date).toDateString() === today).length;
        
        if (el.trustText) {
            // Fix: Only update the number part if possible, or use a simpler string
            const template = i18n[currentLang].trustText;
            el.trustText.innerHTML = template.replace('{count}', todayCount);
        }
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
    };

    const updateVal = (id, val) => {
        let displayVal = parseFloat(val);
        let displayStr = '';

        if (id === 'time' && currentMode === 'drip' && displayVal >= 60) {
            const m = Math.floor(displayVal / 60);
            const s = displayVal % 60;
            displayStr = `${m}:${s < 10 ? '0' + s : s}`;
        } else {
            displayStr = id === 'dosing' ? displayVal.toFixed(1) : displayVal.toString();
        }

        const vEl = el[`v${id.charAt(0).toUpperCase() + id.slice(1)}`];
        if (vEl) vEl.textContent = displayStr;

        const qbEl = el[`qb${id.charAt(0).toUpperCase() + id.slice(1)}`];
        if (qbEl) {
            const quality = getQualityLabel(parseFloat(val), id);
            updateQualityBadge(qbEl, quality);
        }

        if (window.navigator.vibrate) window.navigator.vibrate(5);
        updateBrewRatio();
        updateProgress();
    };

    const updateProHints = () => {
        const lang = i18n[currentLang];
        if (el.hintDosing) el.hintDosing.textContent = lang.proHintDosing;
        if (el.hintTemp) el.hintTemp.textContent = lang.proHintTemp;
        if (el.hintTime) el.hintTime.textContent = lang.proHintTime;
        if (el.hintYield) el.hintYield.textContent = lang.proHintYield;
        if (el.ratioLabel) el.ratioLabel.textContent = lang.ratioLabel;
    };

    const setLang = (lang) => {
        currentLang = lang;
        el.btnLangEn.classList.toggle('active', lang === 'en');
        el.btnLangKo.classList.toggle('active', lang === 'ko');

        const t = i18n[lang];
        if (el.lblDosing) el.lblDosing.textContent = t.dosing;
        if (el.lblTemp) el.lblTemp.textContent = t.temp;
        if (el.lblTime) el.lblTime.textContent = t.time;
        if (el.lblYield) el.lblYield.textContent = t.yield;
        if (el.lblSave) el.lblSave.textContent = t.save;
        if (el.saveNudge) el.saveNudge.textContent = t.savingNudge;
        if (el.brandTagline) el.brandTagline.textContent = t.brandTagline;
        if (el.progressLabelText) el.progressLabelText.textContent = t.progressLabel;

        if (el.lblModalBeanName) el.lblModalBeanName.textContent = t.modalBeanName;
        if (el.lblModalPurchaseUrl) el.lblModalPurchaseUrl.textContent = t.modalPurchaseUrl;
        if (el.lblModalImageUrl) el.lblModalImageUrl.textContent = t.modalImageUrl;
        if (el.lblModalTasteNotes) el.lblModalTasteNotes.textContent = t.modalTasteNotes;
        if (el.lblModalOverallRating) el.lblModalOverallRating.textContent = t.modalOverallRating;
        if (el.lblModalSuccessFail) el.lblModalSuccessFail.textContent = t.modalSuccessFail;
        if (el.lblModalSave) el.lblModalSave.textContent = t.modalSave;
        if (el.modalTitle) el.modalTitle.textContent = t.modalTitle;
        if (el.modalSubtitle) el.modalSubtitle.textContent = t.modalSubtitle;

        updateProHints();
        updateProgress();
        updateBrewRatio();
        updateLogbookBadge();
    };

    const fetchWeather = () => {
        const infoSpan = el.weatherInfo.querySelector('span:last-child');
        
        // Helper to set fallback data
        const setFallbackWeather = (reason) => {
            if (infoSpan) {
                infoSpan.innerHTML = `📍 SEOUL · ☀️ 18°C · 💧 45% <br><small style="font-size:0.7em; opacity:0.6;">(${reason})</small>`;
            }
            el.envHint.textContent = currentLang === 'ko' ? '기본 위치 정보로 표시 중입니다' : 'Showing default location data';
        };

        if (!WEATHERAPI_KEY || WEATHERAPI_KEY === 'YOUR_WEATHERAPI_KEY') {
            setFallbackWeather(currentLang === 'ko' ? 'API 키 필요' : 'API Key Required');
            return;
        }

        if ('geolocation' in navigator) {
            if (infoSpan) infoSpan.textContent = i18n[currentLang].weather;
            
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude: lat, longitude: lon } = position.coords;
                const langCode = currentLang === 'ko' ? 'ko' : 'en';
                const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no&lang=${langCode}`;
                
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    const city = data.location.name;
                    const temp = Math.round(data.current.temp_c);
                    const humidity = data.current.humidity;
                    const iconUrl = data.current.condition.icon;
                    const desc = data.current.condition.text;

                    if (infoSpan) {
                        infoSpan.innerHTML = `📍 ${city} · <img src="${iconUrl}" alt="${desc}" style="vertical-align:middle;height:16px;width:16px;"> ${temp}°C · 💧 ${humidity}%`;
                    }

                    // Weather tips based on humidity
                    if (humidity > 65) {
                        el.envHint.textContent = currentLang === 'ko'
                            ? `습도 ${humidity}% — 분쇄도를 약간 굵게 조정하세요`
                            : `Humidity ${humidity}% — try slightly coarser grind`;
                    } else if (humidity < 40) {
                        el.envHint.textContent = currentLang === 'ko'
                            ? `습도 ${humidity}% — 추출 강도 +0.5g 권장`
                            : `Humidity ${humidity}% — consider +0.5g dosing`;
                    } else {
                        el.envHint.textContent = currentLang === 'ko'
                            ? '오늘 날씨 기준 추출 조건 최적입니다'
                            : 'Ideal extraction conditions today';
                    }
                } catch (e) {
                    console.error('Weather fetch error:', e);
                    setFallbackWeather(i18n[currentLang].weatherError);
                }
            }, (err) => {
                console.warn('Geolocation error:', err.message);
                let reason = i18n[currentLang].locationDenied;
                if (err.code === 1) reason = currentLang === 'ko' ? '위치 권한/정책 차단됨' : 'Location Policy Blocked';
                setFallbackWeather(reason);
            }, { timeout: 5000 });
        } else {
            setFallbackWeather(i18n[currentLang].locationDenied);
        }
    };

    const openModal = () => {
        el.recipeModal.classList.add('active');
        el.modalBeanName.value = '';
        el.modalPurchaseUrl.value = '';
        el.modalImageUrl.value = '';
        el.modalTasteNotes.value = '';
        el.modalOverallRatingContainer.querySelector('input[value="3"]').checked = true;
        successResult = false;
        el.btnFail.classList.add('active');
        el.btnSuccess.classList.remove('active');
        el.modalSuccessFail.checked = false;
        setTimeout(() => el.modalBeanName.focus(), 400);
    };

    const closeModal = (confirmExit = true) => {
        if (confirmExit && !confirm(i18n[currentLang].confirmExitModal)) return;
        el.recipeModal.classList.remove('active');
    };

    const getSelectedRating = () => {
        const sel = el.modalOverallRatingContainer.querySelector('input[name="overallRating"]:checked');
        return sel ? parseInt(sel.value) : 3;
    };

    el.btnEspresso.addEventListener('click', () => setMode('espresso'));
    el.btnDrip.addEventListener('click', () => setMode('drip'));
    el.btnLangEn.addEventListener('click', () => setLang('en'));
    el.btnLangKo.addEventListener('click', () => setLang('ko'));
    el.btnViewLogbook.addEventListener('click', () => window.location.href = 'logbook.html');

    el.rDosing.addEventListener('input', (e) => updateVal('dosing', e.target.value));
    el.rTemp.addEventListener('input', (e) => updateVal('temp', e.target.value));
    el.rTime.addEventListener('input', (e) => updateVal('time', e.target.value));
    el.rYield.addEventListener('input', (e) => updateVal('yield', e.target.value));

    el.btnSave.addEventListener('click', openModal);
    el.modalCancel.addEventListener('click', () => closeModal());
    
    el.btnFail.addEventListener('click', () => {
        successResult = false;
        el.modalSuccessFail.checked = false;
        el.btnFail.classList.add('active');
        el.btnSuccess.classList.remove('active');
    });
    el.btnSuccess.addEventListener('click', () => {
        successResult = true;
        el.modalSuccessFail.checked = true;
        el.btnFail.classList.remove('active');
        el.btnSuccess.classList.add('active');
    });

    el.modalSaveRecipe.addEventListener('click', () => {
        const beanName = el.modalBeanName.value.trim();
        if (!beanName) {
            el.modalBeanName.style.borderColor = '#C0392B';
            el.modalBeanName.focus();
            setTimeout(() => el.modalBeanName.style.borderColor = '', 2000);
            return;
        }

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
            imageUrl: el.modalImageUrl.value.trim(),
            tasteNotes: el.modalTasteNotes.value.trim(),
            overallRating: getSelectedRating(),
            success: successResult,
            weather: el.weatherInfo.querySelector('span:last-child').innerHTML
        };

        if (typeof CoffeeNotesStorage !== 'undefined' && CoffeeNotesStorage.saveRecipe(recipe)) {
            alert(i18n[currentLang].recipeSavedSuccess);
            window.location.href = 'logbook.html';
        } else {
            alert(i18n[currentLang].recipeSavedFail);
        }
    });

    setLang(currentLang);
    setMode(currentMode);
    fetchWeather();
    updateProgress();
});