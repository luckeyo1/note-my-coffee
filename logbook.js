// logbook.js
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
        btnLangEn: document.getElementById('l-en'),
        btnLangKo: document.getElementById('l-ko'),
        logbookTitle: document.querySelector('.logbook-title'),
        recipeCardsGrid: document.getElementById('recipe-cards-grid'),
    };

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

    const deleteRecipe = (id) => {
        if (confirm(i18n[currentLang].deleteConfirm)) {
            CoffeeNotesStorage.deleteRecipe(id);
            renderRecipeCards(); // Re-render the list after deletion
        }
    };

    const renderRecipeCards = () => {
        elements.recipeCardsGrid.innerHTML = ''; // Clear existing cards
        const recipes = CoffeeNotesStorage.getRecipes();

        if (recipes.length === 0) {
            elements.recipeCardsGrid.innerHTML = `<p class="no-recipes-message">${i18n[currentLang].noRecipes}</p>`;
            return;
        }

        // Sort by date (newest first)
        recipes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        recipes.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            
            // Photo display logic: Only show if imageUrl exists
            const photoHtml = recipe.imageUrl 
                ? `<img src="${recipe.imageUrl}" alt="${recipe.beanName || 'Coffee'}" class="recipe-card-image">`
                : '';

            card.innerHTML = `
                ${photoHtml}
                <div class="recipe-card-content">
                    <h4>${recipe.beanName || (currentLang === 'ko' ? '원두명 미상' : 'Unknown Bean')}</h4>
                    <p><span class="label">${i18n[currentLang].mode}</span> ${recipe.mode.toUpperCase()}</p>
                    <p><span class="label">${i18n[currentLang].dosing}</span> ${recipe.dosing}g</p>
                    <p><span class="label">${i18n[currentLang].temp}</span> ${recipe.temp}°C</p>
                    <p><span class="label">${i18n[currentLang].time}</span> ${recipe.mode === 'espresso' ? recipe.time + 'sec' : `${Math.floor(recipe.time / 60)}:${(recipe.time % 60).toString().padStart(2, '0')}min`}</p>
                    <p><span class="label">${i18n[currentLang].yield}</span> ${recipe.yield}g</p>
                    <p><span class="label">${i18n[currentLang].tasteNotes}</span> ${recipe.tasteNotes || '-'}</p>
                    <p class="recipe-card-rating">${_renderStars(recipe.overallRating)}</p>
                    ${recipe.purchaseUrl ? `<p><a href="${recipe.purchaseUrl}" target="_blank">${i18n[currentLang].purchaseLink}</a></p>` : ''}
                    <p><span class="label">${i18n[currentLang].weather}</span> ${recipe.weather}</p>
                    <p><span class="label">Date:</span> ${new Date(recipe.date).toLocaleDateString(currentLang === 'ko' ? 'ko-KR' : 'en-US')}</p>
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

        // Event listeners are now handled by event delegation on the parent grid
    };

    // --- Event Listeners ---
    elements.btnNewRecipe.addEventListener('click', () => { window.location.href = 'index.html'; });
    elements.btnLangEn.addEventListener('click', () => setLang('en'));
    elements.btnLangKo.addEventListener('click', () => setLang('ko'));

    // **FIX: Use Event Delegation for delete buttons**
    elements.recipeCardsGrid.addEventListener('click', (e) => {
        // Check if a delete button was clicked
        if (e.target && e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (id) {
                deleteRecipe(id);
            }
        }
    });

    // --- Initial Setup ---
    setLang(currentLang); // Apply initial language settings and render cards
});