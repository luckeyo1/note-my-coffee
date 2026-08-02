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
    updateDoc,
    getDoc,
    setDoc,
    increment
} from "./firebase-config.js";

// ── 집계 (docs/admin-roadmap.md Phase 1) ────────────────────────────────
// 관리자 대시보드가 recipes 컬렉션을 통째로 내려받던 구조를 대체한다. 사진이
// base64로 문서에 들어 있어 기록이 쌓이면 한 번 여는 데 수백 MB가 나갔다.
// 저장·삭제 시점에 카운터를 올려두면 대시보드는 이 작은 문서들만 읽으면 된다.
//
// 집계는 부가 기능이다 — 실패해도 레시피 저장/삭제 자체는 성공으로 유지한다.
// track()이 절대 throw하지 않는 것과 같은 태도다.

const dayKeyOf = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// 원두 이름은 사용자 입력이라 문서 ID로 바로 쓸 수 없다(/ . # $ [ ] 금지, 길이 제한).
// FNV-1a로 짧고 안정적인 ID를 만들고, 사람이 읽을 이름은 문서 안에 따로 담는다.
const beanDocId = (name) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < name.length; i++) {
        h ^= name.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return 'b' + h.toString(36);
};

/**
 * 레시피 1건이 추가(+1)되거나 삭제(-1)될 때 집계를 갱신한다.
 * @param {Object} recipe 레시피(‑1일 때도 원본 필드가 필요하다)
 * @param {string} uid
 * @param {1|-1} delta
 */
async function bumpAggregates(recipe, uid, delta) {
    const key = dayKeyOf(recipe && recipe.date);
    if (!key || !uid) return;

    const espresso = recipe.mode === 'espresso';
    const rating = Number(recipe.overallRating);
    const rated = Number.isFinite(rating) && rating >= 1 && rating <= 5;
    const hour = new Date(recipe.date).getHours();

    // 일별 집계 — 전부 increment라 원자적이고 읽기가 필요 없다.
    //
    // uc(사용자별)·bn(원두별) 맵을 같이 두는 이유: 이게 없으면 대시보드에서
    // '기간 내 사용자 수'와 '기간 내 퍼널·원두 TOP'을 만들 수 없어, 집계로 옮기는
    // 순간 그 카드들이 생애 기준으로 바뀌어버린다. 맵을 두면 기간 스코프가 유지된다.
    // 하루치 항목 수는 그날 활동한 사용자/원두 수라 문서 1MB 한도에 여유가 크다.
    const daily = {
        count: increment(delta),
        [espresso ? 'espresso' : 'drip']: increment(delta),
        ['h' + hour]: increment(delta),
        uc: { [uid]: increment(delta) },
    };
    if (recipe.success === true) daily.successCount = increment(delta);
    if (rated) {
        daily.ratedCount = increment(delta);
        daily['rating' + rating] = increment(delta);
    }
    const beanName = (recipe.beanName || '').trim();
    if (beanName) daily.bn = { [beanDocId(beanName)]: increment(delta) };

    await setDoc(doc(db, 'stats_daily', key), daily, { merge: true });

    // 사용자 집계 — firstSeenAt은 처음 한 번만 쓴다. 같은 사용자가 동시에 두 건을
    // 저장해 둘 다 '없음'으로 읽는 경쟁은 이론상 가능하지만, 그래도 거의 같은
    // 시각이 두 번 써질 뿐이라 무해하다(recipeCount는 increment라 영향 없다).
    const userRef = doc(db, 'users', uid);
    const patch = { lastSeenAt: new Date().toISOString(), recipeCount: increment(delta) };
    if (delta > 0) {
        const snap = await getDoc(userRef);
        if (!snap.exists() || !snap.data().firstSeenAt) {
            // 가입일 필드가 없어 지금까지 '첫 기록일'을 프록시로 썼다. 이제 실제로 남긴다.
            patch.firstSeenAt = recipe.date || new Date().toISOString();
        }
    }
    await setDoc(userRef, patch, { merge: true });

    // 원두 이름 사전 — 위 bn 맵은 ID만 담으므로 사람이 읽을 이름을 여기서 찾는다.
    // 이름이 비어 있으면 만들지 않는다(빈 이름 문서가 생기면 TOP 목록이 더러워진다).
    if (beanName) {
        await setDoc(doc(db, 'stats_beans', beanDocId(beanName)),
            { name: beanName }, { merge: true });
    }
}

// 집계 실패가 본 기능을 끌고 내려가지 않게 감싼다.
async function bumpAggregatesSafe(recipe, uid, delta) {
    try {
        await bumpAggregates(recipe, uid, delta);
    } catch (e) {
        console.warn('[Stats] 집계 갱신 실패 — 기록 자체는 정상 처리됐습니다.', e);
    }
}

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
                    await bumpAggregatesSafe(data, this.currentUser.uid, 1);
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
                await bumpAggregatesSafe(recipeData, this.currentUser.uid, 1);
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
                // 지우기 전에 원본을 읽어둔다 — 어떤 날짜·모드·평점의 카운터를 내려야
                // 하는지는 문서 안에만 있다. 이걸 안 하면 집계가 원본과 어긋난다.
                // (읽기에 실패해도 삭제는 진행한다. 집계 표류는 '집계 재생성'으로 복구된다.)
                let prior = null;
                try {
                    const snap = await getDoc(doc(db, "recipes", id));
                    if (snap.exists()) prior = snap.data();
                } catch (e) {
                    console.warn('[Stats] 삭제 전 원본을 읽지 못했습니다. 집계가 어긋날 수 있습니다.', e);
                }

                await deleteDoc(doc(db, "recipes", id));
                if (prior) await bumpAggregatesSafe(prior, this.currentUser.uid, -1);
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
