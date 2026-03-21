// storage.js
// Centralized utility for managing coffee notes in localStorage

const CoffeeNotesStorage = {
    KEY: 'coffeeRecipes', // Changed key to reflect new recipe focus
    getRecipes() {
        try {
            const recipesString = localStorage.getItem(this.KEY);
            const recipes = recipesString ? JSON.parse(recipesString) : [];
            return Array.isArray(recipes) ? recipes : [];
        } catch (e) {
            console.error("Error getting recipes from localStorage", e);
            return [];
        }
    },
    saveRecipe(recipe) {
        const recipes = this.getRecipes();
        // Ensure a unique ID for new recipes
        if (!recipe.id) {
            recipe.id = Date.now().toString();
        }
        recipes.push(recipe);
        try {
            localStorage.setItem(this.KEY, JSON.stringify(recipes));
            return true; // Indicate success
        } catch (e) {
            console.error("Error saving recipe to localStorage", e);
            return false; // Indicate failure
        }
    },
    deleteRecipe(id) {
        let recipes = this.getRecipes();
        const initialLength = recipes.length;
        recipes = recipes.filter(recipe => recipe.id !== id);
        if (recipes.length < initialLength) { // Only save if a recipe was actually removed
            try {
                localStorage.setItem(this.KEY, JSON.stringify(recipes));
                return true; // Indicate success
            } catch (e) {
                console.error("Error deleting recipe from localStorage", e);
                return false; // Indicate failure
            }
        }
        return false; // Recipe not found
    },
    updateRecipe(updatedRecipe) {
        let recipes = this.getRecipes();
        let updated = false;
        recipes = recipes.map(recipe => {
            if (recipe.id === updatedRecipe.id) {
                updated = true;
                return updatedRecipe;
            }
            return recipe;
        });
        if (updated) {
            try {
                localStorage.setItem(this.KEY, JSON.stringify(recipes));
                return true; // Indicate success
            } catch (e) {
                console.error("Error updating recipe in localStorage", e);
                return false; // Indicate failure
            }
        }
        return false; // Recipe not found
    }
};
