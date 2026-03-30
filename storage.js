// storage.js
import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    doc, 
    deleteDoc, 
    updateDoc 
} from "./firebase-config.js";

const CoffeeNotesStorage = {
    KEY: 'coffeeRecipes',
    currentUser: null,

    setCurrentUser(user) {
        this.currentUser = user;
    },

    async getRecipes() {
        // If logged in, get from Firestore
        if (this.currentUser) {
            try {
                const q = query(collection(db, "recipes"), where("userId", "==", this.currentUser.uid));
                const querySnapshot = await getDocs(q);
                const recipes = [];
                querySnapshot.forEach((doc) => {
                    recipes.push({ id: doc.id, ...doc.data() });
                });
                // Sort by date descending
                return recipes.sort((a, b) => new Date(b.date) - new Date(a.date));
            } catch (e) {
                console.error("Error getting recipes from Firestore", e);
                return [];
            }
        }

        // Fallback to localStorage
        try {
            const recipesString = localStorage.getItem(this.KEY);
            const recipes = recipesString ? JSON.parse(recipesString) : [];
            return Array.isArray(recipes) ? recipes : [];
        } catch (e) {
            console.error("Error getting recipes from localStorage", e);
            return [];
        }
    },

    async saveRecipe(recipe) {
        // If logged in, save to Firestore
        if (this.currentUser) {
            try {
                const recipeData = {
                    ...recipe,
                    userId: this.currentUser.uid,
                    updatedAt: new Date().toISOString()
                };
                // Remove local id if it exists, Firestore will generate one
                delete recipeData.id;
                const docRef = await addDoc(collection(db, "recipes"), recipeData);
                return docRef.id;
            } catch (e) {
                console.error("Error saving recipe to Firestore", e);
                alert("Firestore 저장 실패: " + e.message);
                return false;
            }
        }

        // Save to localStorage
        const recipes = await this.getRecipes();
        if (!recipe.id) {
            recipe.id = Date.now().toString();
        }
        recipes.push(recipe);
        try {
            localStorage.setItem(this.KEY, JSON.stringify(recipes));
            return true;
        } catch (e) {
            console.error("Error saving recipe to localStorage", e);
            return false;
        }
    },

    async deleteRecipe(id) {
        if (this.currentUser) {
            try {
                await deleteDoc(doc(db, "recipes", id));
                return true;
            } catch (e) {
                console.error("Error deleting recipe from Firestore", e);
                return false;
            }
        }

        let recipes = await this.getRecipes();
        const initialLength = recipes.length;
        recipes = recipes.filter(recipe => recipe.id !== id);
        if (recipes.length < initialLength) {
            try {
                localStorage.setItem(this.KEY, JSON.stringify(recipes));
                return true;
            } catch (e) {
                console.error("Error deleting recipe from localStorage", e);
                return false;
            }
        }
        return false;
    },

    async updateRecipe(updatedRecipe) {
        if (this.currentUser) {
            try {
                const recipeRef = doc(db, "recipes", updatedRecipe.id);
                const recipeData = { ...updatedRecipe };
                delete recipeData.id; // Don't save the id inside the document
                await updateDoc(recipeRef, recipeData);
                return true;
            } catch (e) {
                console.error("Error updating recipe in Firestore", e);
                return false;
            }
        }

        let recipes = await this.getRecipes();
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
                return true;
            } catch (e) {
                console.error("Error updating recipe in localStorage", e);
                return false;
            }
        }
        return false;
    },

    // Helper to get unique bean names for "Opened" status
    async getRecentBeans() {
        const recipes = await this.getRecipes();
        const beans = recipes
            .filter(r => r.beanName)
            .map(r => r.beanName);
        return [...new Set(beans)].slice(0, 10); // Return top 10 unique recent beans
    }
};

export default CoffeeNotesStorage;
