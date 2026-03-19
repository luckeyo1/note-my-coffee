document.addEventListener('DOMContentLoaded', () => {
    let currentMode = 'espresso';
    let currentLang = 'en';

    // IMPORTANT: Replace 'YOUR_WEATHERAPI_KEY' with your actual WeatherAPI.com API key.
    // You can get one by signing up at https://www.weatherapi.com/
    const WEATHERAPI_KEY = 'YOUR_WEATHERAPI_KEY'; 

    const i18n = {
        en: { 
            dosing: "DOSING", temp: "WATER TEMP", time: "EXTRACTION TIME", yield: "YIELD", save: "LOG RECIPE", 
            weather: "📍 Getting weather...", 
            locationDenied: "📍 Location access denied.",
            weatherError: "📍 Weather data unavailable.",
            viewLogbook: "VIEW LOGBOOK",
            modalBeanName: "Bean Name",
            modalPurchaseUrl: "Purchase URL",
            modalImageUrl: "Image URL (Optional)",
            modalTasteNotes: "Taste Notes",
            modalOverallRating: "Overall Rating",
            modalSuccessFail: "Success / Fail",
            modalSave: "Save Recipe",
            modalCancel: "Cancel",
            recipeSavedSuccess: "Recipe logged! Redirecting to logbook...",
            recipeSavedFail: "Failed to save recipe.",
            confirmExitModal: "Are you sure you want to cancel? Your current input will be lost."
        },
        ko: { 
            dosing: "도징량", temp: "물 온도", time: "추출 시간", yield: "추출량", save: "레시피 기록하기", 
            weather: "📍 날씨 정보 불러오는 중...", 
            locationDenied: "📍 위치 접근 거부됨.",
            weatherError: "📍 날씨 정보 없음.",
            viewLogbook: "로그북 보기",
            modalBeanName: "원두 이름",
            modalPurchaseUrl: "구매처 URL",
            modalImageUrl: "원두 이미지 URL (선택)",
            modalTasteNotes: "맛 노트",
            modalOverallRating: "전체 평점",
            modalSuccessFail: "성공 / 실패",
            modalSave: "레시피 저장",
            modalCancel: "취소",
            recipeSavedSuccess: "레시피가 기록되었습니다! 로그북으로 이동합니다...",
            recipeSavedFail: "레시피 저장 실패.",
            confirmExitModal: "취소하시겠습니까? 현재 입력된 내용은 저장되지 않습니다."
        }
    };

    // --- Element Cache ---
    const elements = {
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
        weatherInfo: document.getElementById('weather-info'),

        rDosing: document.getElementById('r-dosing'),
        rTemp: document.getElementById('r-temp'),
        rTime: document.getElementById('r-time'),
        rYield: document.getElementById('r-yield'),

        vDosing: document.getElementById('v-dosing'),
        vTemp: document.getElementById('v-temp'),
        vTime: document.getElementById('v-time'),
        vYield: document.getElementById('v-yield'),
        uTime: document.getElementById('u-time'),

        // Modal elements
        recipeModal: document.getElementById('recipe-modal'),
        modalBeanName: document.getElementById('modal-bean-name'),
        modalPurchaseUrl: document.getElementById('modal-purchase-url'),
        modalImageUrl: document.getElementById('modal-image-url'),
        modalTasteNotes: document.getElementById('modal-taste-notes'),
        modalOverallRatingContainer: document.getElementById('modal-overall-rating-container'),
        modalSuccessFail: document.getElementById('modal-success-fail'),
        modalSaveRecipe: document.getElementById('modal-save-recipe'),
        modalCancel: document.getElementById('modal-cancel'),

        // Modal labels for i18n
        lblModalBeanName: document.getElementById('lbl-modal-bean-name'),
        lblModalPurchaseUrl: document.getElementById('lbl-modal-purchase-url'),
        lblModalImageUrl: document.getElementById('lbl-modal-image-url'),
        lblModalTasteNotes: document.getElementById('lbl-modal-taste-notes'),
        lblModalOverallRating: document.getElementById('lbl-modal-overall-rating'),
        lblModalSuccessFail: document.getElementById('lbl-modal-success-fail'),
    };

    // --- Functions ---
    const setMode = (mode) => {
        currentMode = mode;
        elements.btnEspresso.classList.toggle('active', mode === 'espresso');
        elements.btnDrip.classList.toggle('active', mode === 'drip');

        if (mode === 'espresso') {
            elements.rTime.max = 60; elements.rTime.step = 0.5; elements.rTime.value = 28;
            elements.rYield.max = 60; elements.rYield.step = 1; elements.rYield.value = 36;
            elements.uTime.innerText = "sec";
        } else {
            elements.rTime.max = 300; elements.rTime.step = 1; elements.rTime.value = 150;
            elements.rYield.max = 600; elements.rYield.step = 5; elements.rYield.value = 250;
            elements.uTime.innerText = "sec";
        }
        
        updateVal('time', elements.rTime.value);
        updateVal('yield', elements.rYield.value);
    };

    const updateVal = (id, val) => {
        let displayVal = val;
        if (id === 'time' && currentMode === 'drip' && val >= 60) {
            const m = Math.floor(val / 60);
            const s = val % 60;
            displayVal = `${m}:${s < 10 ? '0'+s : s}`;
        }
        
        const valueElement = elements[`v${id.charAt(0).toUpperCase() + id.slice(1)}`];
        if(valueElement) {
            valueElement.innerText = displayVal;
        }

        if (window.navigator.vibrate) window.navigator.vibrate(5);
    };

    const setLang = (lang) => {
        currentLang = lang;
        elements.btnLangEn.classList.toggle('active', lang === 'en');
        elements.btnLangKo.classList.toggle('active', lang === 'ko');
        
        elements.lblDosing.innerText = i18n[lang].dosing;
        elements.lblTemp.innerText = i18n[lang].temp;
        elements.lblTime.innerText = i18n[lang].time;
        elements.lblYield.innerText = i18n[lang].yield;
        elements.btnSave.innerText = i18n[lang].save;
        elements.weatherInfo.innerText = i18n[lang].weather; 
        elements.btnViewLogbook.innerText = i18n[lang].viewLogbook;

        // Modal labels
        elements.lblModalBeanName.innerText = i18n[lang].modalBeanName;
        elements.lblModalPurchaseUrl.innerText = i18n[lang].modalPurchaseUrl;
        elements.lblModalImageUrl.innerText = i18n[lang].modalImageUrl;
        elements.lblModalTasteNotes.innerText = i18n[lang].modalTasteNotes;
        elements.lblModalOverallRating.innerText = i18n[lang].modalOverallRating;
        elements.lblModalSuccessFail.innerText = i18n[lang].modalSuccessFail;
        elements.modalSaveRecipe.innerText = i18n[lang].modalSave;
        elements.modalCancel.innerText = i18n[lang].modalCancel;
    };

    const fetchWeather = () => {
        if (!WEATHERAPI_KEY || WEATHERAPI_KEY === 'YOUR_WEATHERAPI_KEY') {
            console.warn("WeatherAPI.com API key is not set. Please replace 'YOUR_WEATHERAPI_KEY' in main.js with your actual key.");
            elements.weatherInfo.innerText = i18n[currentLang].weatherError;
            return;
        }

        if ("geolocation" in navigator) {
            elements.weatherInfo.innerText = i18n[currentLang].weather; 
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const langCode = currentLang === 'ko' ? 'ko' : 'en'; // WeatherAPI uses 'ko' for Korean
                    const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no&lang=${langCode}`;

                    try {
                        const response = await fetch(weatherUrl);
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        const data = await response.json();
                        const city = data.location.name;
                        const temp = Math.round(data.current.temp_c);
                        const humidity = data.current.humidity;
                        const weatherIconUrl = data.current.condition.icon; 
                        const weatherDescription = data.current.condition.text; 

                        elements.weatherInfo.innerHTML = `
                            📍 ${city} | 
                            <img src="${weatherIconUrl}" alt="${weatherDescription}" style="vertical-align: middle; height: 20px; width: 20px;">
                            ${temp}°C | 💧 ${humidity}%
                        `;
                    } catch (error) {
                        console.error("Failed to fetch weather data:", error);
                        elements.weatherInfo.innerText = i18n[currentLang].weatherError;
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    elements.weatherInfo.innerText = i18n[currentLang].locationDenied;
                }
            );
        } else {
            elements.weatherInfo.innerText = i18n[currentLang].locationDenied; 
        }
    };

    // --- Modal Functions ---
    const openModal = () => {
        elements.recipeModal.classList.add('active');
        // Reset modal fields
        elements.modalBeanName.value = '';
        elements.modalPurchaseUrl.value = '';
        elements.modalImageUrl.value = '';
        elements.modalTasteNotes.value = '';
        // Reset rating to 3 stars
        elements.modalOverallRatingContainer.querySelector('input[value="3"]').checked = true;
        elements.modalSuccessFail.checked = false; // Default to fail
    };

    const closeModal = (confirmExit = true) => {
        if (confirmExit && !confirm(i18n[currentLang].confirmExitModal)) {
            return;
        }
        elements.recipeModal.classList.remove('active');
    };

    const getSelectedRating = () => {
        const selected = elements.modalOverallRatingContainer.querySelector('input[name="overallRating"]:checked');
        return selected ? parseInt(selected.value) : 0;
    };

    // --- Event Listeners ---
    elements.btnEspresso.addEventListener('click', () => setMode('espresso'));
    elements.btnDrip.addEventListener('click', () => setMode('drip'));
    elements.btnLangEn.addEventListener('click', () => setLang('en'));
    elements.btnLangKo.addEventListener('click', () => setLang('ko'));
    elements.btnViewLogbook.addEventListener('click', () => { window.location.href = 'logbook.html'; }); 
    
    elements.rDosing.addEventListener('input', (e) => updateVal('dosing', e.target.value));
    elements.rTemp.addEventListener('input', (e) => updateVal('temp', e.target.value));
    elements.rTime.addEventListener('input', (e) => updateVal('time', e.target.value));
    elements.rYield.addEventListener('input', (e) => updateVal('yield', e.target.value));

    elements.btnSave.addEventListener('click', () => {
        openModal();
    });

    elements.modalSaveRecipe.addEventListener('click', () => {
        const beanName = elements.modalBeanName.value.trim();
        if (!beanName) {
            alert(currentLang === 'ko' ? "원두 이름을 입력해주세요." : "Please enter the bean name.");
            elements.modalBeanName.focus();
            return;
        }

        const recipe = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            mode: currentMode,
            dosing: parseFloat(elements.rDosing.value),
            temp: parseFloat(elements.rTemp.value),
            time: parseFloat(elements.rTime.value),
            yield: parseFloat(elements.rYield.value),
            beanName: beanName,
            purchaseUrl: elements.modalPurchaseUrl.value.trim(),
            imageUrl: elements.modalImageUrl.value.trim(),
            tasteNotes: elements.modalTasteNotes.value.trim(),
            overallRating: getSelectedRating(),
            success: elements.modalSuccessFail.checked,
            weather: elements.weatherInfo.innerHTML 
        };

        if (CoffeeNotesStorage.saveRecipe(recipe)) {
            alert(i18n[currentLang].recipeSavedSuccess);
            window.location.href = 'logbook.html'; // Redirect to logbook page
        } else {
            alert(i18n[currentLang].recipeSavedFail);
        }
    });

    elements.modalCancel.addEventListener('click', () => closeModal());

    // --- Initial Setup ---
    setLang(currentLang); 
    setMode(currentMode); 
    fetchWeather(); 
});