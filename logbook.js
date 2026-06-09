// logbook.js
import { 
    auth, 
    onAuthStateChanged 
} from "./firebase-config.js";
import CoffeeNotesStorage from "./storage.js";

document.addEventListener('DOMContentLoaded', () => {
    let currentLang = 'en'; // Default language

    const i18n = {
        en: {
            newRecipe: "NEW RECIPE",
            logbookTitle: "MY RECIPE LOGBOOK",
            noRecipes: "No recipes logged yet. Go create one!",
            deleteConfirm: "Are you sure you want to delete this recipe?",
            beanName: "Bean:",
            mode: "Mode:",
            dosing: "Dosing:",
            temp: "Temp:",
            time: "Time:",
            yield: "Yield:",
            tasteNotes: "Notes:",
            overallRating: "Rating:",
            success: "SUCCESS",
            fail: "FAIL",
            purchaseLink: "Purchase Link",
            delete: "Delete",
            weather: "Weather:"
        },
        ko: {
            newRecipe: "새 레시피",
            logbookTitle: "나의 레시피 기록",
            noRecipes: "아직 기록된 레시피가 없습니다. 지금 바로 레시피를 만들어보세요!",
            deleteConfirm: "정말로 이 레시피를 삭제하시겠습니까?",
            beanName: "원두명:",
            mode: "모드:",
            dosing: "도징량:",
            temp: "물 온도:",
            time: "추출 시간:",
            yield: "추출량:",
            tasteNotes: "맛 노트:",
            overallRating: "전체 평점:",
            success: "성공",
            fail: "실패",
            purchaseLink: "구매처 링크",
            delete: "삭제",
            weather: "날씨:"
        }
    };

    // --- Element Cache ---
    const elements = {
        btnNewRecipe: document.getElementById('btn-new-recipe'),
        mobileFab: document.getElementById('mobile-fab'),
        btnLangEn: document.getElementById('l-en'),
        btnLangKo: document.getElementById('l-ko'),
        logbookTitle: document.querySelector('.logbook-title'),
        recipeCardsGrid: document.getElementById('recipe-cards-grid'),
    };

    // --- Auth Logic ---
    onAuthStateChanged(auth, (user) => {
        CoffeeNotesStorage.setCurrentUser(user);
        renderRecipeCards(); // Re-render when auth state changes
    });

    // --- Functions ---
    const setLang = (lang) => {
        currentLang = lang;
        elements.btnLangEn.classList.toggle('active', lang === 'en');
        elements.btnLangKo.classList.toggle('active', lang === 'ko');
        
        elements.btnNewRecipe.innerText = i18n[lang].newRecipe;
        elements.logbookTitle.innerText = i18n[lang].logbookTitle;
        renderRecipeCards(); // Re-render cards to update their language
    };

    const _renderStars = (rating) => {
        return '★'.repeat(rating) + '☆'.repeat(5 - rating);
    };

    const deleteRecipe = async (id) => {
        if (confirm(i18n[currentLang].deleteConfirm)) {
            await CoffeeNotesStorage.deleteRecipe(id);
            renderRecipeCards(); // Re-render the list after deletion
        }
    };

    const renderRecipeCards = async () => {
        elements.recipeCardsGrid.innerHTML = '<div class="loading">Loading recipes...</div>';
        const recipes = await CoffeeNotesStorage.getRecipes();

        elements.recipeCardsGrid.innerHTML = ''; // Clear existing cards

        if (!Array.isArray(recipes) || recipes.length === 0) {
            elements.recipeCardsGrid.innerHTML = `<p class="no-recipes-message">${i18n[currentLang].noRecipes}</p>`;
            return;
        }

        recipes.forEach(recipe => {
            if (!recipe) return;
            const card = document.createElement('div');
            card.className = 'recipe-card';
            
            const photoHtml = recipe.imageUrl 
                ? `<img src="${recipe.imageUrl}" alt="${recipe.beanName || 'Coffee'}" class="recipe-card-image">`
                : '';

            const safeMode = recipe.mode ? recipe.mode.toUpperCase() : 'UNKNOWN';
            const safeWeather = recipe.weather || (currentLang === 'ko' ? '정보 없음' : 'No info');
            const safeRating = parseInt(recipe.overallRating, 10) || 0;

            card.innerHTML = `
                ${photoHtml}
                <div class="recipe-card-content">
                    <h4>${recipe.beanName || (currentLang === 'ko' ? '원두명 미상' : 'Unknown Bean')}</h4>
                    <p><span class="label">${i18n[currentLang].mode}</span> ${safeMode}</p>
                    <p><span class="label">${i18n[currentLang].dosing}</span> ${recipe.dosing || 0}g</p>
                    <p><span class="label">${i18n[currentLang].temp}</span> ${recipe.temp || 0}°C</p>
                    <p><span class="label">${i18n[currentLang].time}</span> ${recipe.mode === 'espresso' ? (recipe.time || 0) + 'sec' : `${Math.floor((recipe.time || 0) / 60)}:${((recipe.time || 0) % 60).toString().padStart(2, '0')}min`}</p>
                    <p><span class="label">${i18n[currentLang].yield}</span> ${recipe.yield || 0}g</p>
                    <p><span class="label">${i18n[currentLang].tasteNotes}</span> ${recipe.tasteNotes || '-'}</p>
                    <p class="recipe-card-rating">${_renderStars(safeRating)}</p>
                    ${recipe.purchaseUrl ? `<p><a href="${recipe.purchaseUrl}" target="_blank">${i18n[currentLang].purchaseLink}</a></p>` : ''}
                    <p><span class="label">${i18n[currentLang].weather}</span> ${safeWeather}</p>
                    <p><span class="label">Date:</span> ${recipe.date ? new Date(recipe.date).toLocaleDateString(currentLang === 'ko' ? 'ko-KR' : 'en-US') : '-'}</p>
                </div>
                <div class="recipe-card-footer">
                    <span class="status-indicator ${recipe.success ? 'status-success' : 'status-fail'}">
                        ${recipe.success ? i18n[currentLang].success : i18n[currentLang].fail}
                    </span>
                    <button class="delete-btn" data-id="${recipe.id}">${i18n[currentLang].delete}</button>
                </div>
            `;
            elements.recipeCardsGrid.appendChild(card);
        });
    };

    // --- Event Listeners ---
    elements.btnNewRecipe.addEventListener('click', () => { window.location.href = 'app.html'; });
    if (elements.mobileFab) {
        elements.mobileFab.addEventListener('click', () => { window.location.href = 'app.html'; });
    }
    elements.btnLangEn.addEventListener('click', () => setLang('en'));
    elements.btnLangKo.addEventListener('click', () => setLang('ko'));

    elements.recipeCardsGrid.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (id) {
                deleteRecipe(id);
            }
        }
    });

    // --- Initial Setup ---
    setLang(currentLang);
});
