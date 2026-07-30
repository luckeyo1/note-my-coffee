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

    /**
     * 레시피 목록을 읽어온다.
     *
     * 반환값 규약이 중요하다:
     *   - 배열  → 성공. 빈 배열은 "기록이 정말 없다"는 뜻.
     *   - null  → 읽기 실패(네트워크·권한·손상된 저장소).
     *
     * 예전에는 실패도 []를 돌려줬다. 그래서 일시적인 네트워크 오류가 로그북에
     * "아직 기록된 레시피가 없습니다"로 표시되고 배지가 0으로 떨어져서,
     * 사용자에게는 기록이 전부 사라진 것처럼 보였다. 호출부가 두 경우를
     * 다르게 처리할 수 있어야 한다.
     */
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
                return null; // 실패 — "기록 없음"과 구분되어야 한다
            }
        }

        // Fallback to localStorage
        try {
            const recipesString = localStorage.getItem(this.KEY);
            const recipes = recipesString ? JSON.parse(recipesString) : [];
            // 값이 있는데 배열이 아니면 손상된 저장소다 — 빈 목록이 아니라 실패다.
            if (!Array.isArray(recipes)) return null;
            return recipes;
        } catch (e) {
            console.error("Error getting recipes from localStorage", e);
            return null; // 실패 — "기록 없음"과 구분되어야 한다
        }
    },

    // 게스트 쓰기 경로용. getRecipes()는 실패를 null로 알리지만 쓰기 경로는
    // 항상 배열이 필요하다(null.push는 던진다). 저장소가 손상됐으면 빈 배열로
    // 시작한다 — 읽을 수 없는 값을 보존해봐야 쓸 수 없고, 새 기록은 저장돼야 한다.
    _localRecipesForWrite() {
        try {
            const s = localStorage.getItem(this.KEY);
            const parsed = s ? JSON.parse(s) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("Local store unreadable; starting a fresh list", e);
            return [];
        }
    },

    // How many recipes the (not-logged-in) visitor has stored on this device.
    // Used to gate the free guest trial before requiring login.
    getLocalRecipeCount() {
        try {
            const recipesString = localStorage.getItem(this.KEY);
            const recipes = recipesString ? JSON.parse(recipesString) : [];
            return Array.isArray(recipes) ? recipes.length : 0;
        } catch (e) {
            return 0;
        }
    },

    // Move any recipes saved as a guest (localStorage) into the now-logged-in
    // user's cloud account, then clear local. Lets a trial recipe follow the
    // customer into their account on sign-up. Idempotent: a no-op once local
    // is empty, and guarded against concurrent runs from multiple auth events.
    async migrateLocalToCloud() {
        if (!this.currentUser || this._migrating) return 0;
        this._migrating = true;
        try {
            let local = [];
            try {
                const s = localStorage.getItem(this.KEY);
                local = s ? JSON.parse(s) : [];
            } catch (e) { local = []; }
            if (!Array.isArray(local) || local.length === 0) return 0;

            let migrated = 0;
            for (const r of local) {
                try {
                    const data = { ...r, userId: this.currentUser.uid, updatedAt: new Date().toISOString() };
                    delete data.id; // Firestore assigns its own id
                    await addDoc(collection(db, "recipes"), data);
                    migrated++;
                } catch (e) {
                    console.error("Error migrating local recipe to cloud", e);
                }
            }
            // Only clear local once every recipe moved, so a partial failure
            // never loses the customer's data.
            if (migrated === local.length) {
                try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ }
            }
            return migrated;
        } finally {
            this._migrating = false;
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
        const recipes = this._localRecipesForWrite();
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

        let recipes = this._localRecipesForWrite();
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

        let recipes = this._localRecipesForWrite();
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
        const recipes = (await this.getRecipes()) || [];
        const beans = recipes
            .filter(r => r.beanName)
            .map(r => r.beanName);
        return [...new Set(beans)].slice(0, 10); // Return top 10 unique recent beans
    }
};

export default CoffeeNotesStorage;
