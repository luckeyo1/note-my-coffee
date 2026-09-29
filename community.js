// community.js — 공개 레시피 공유(SNS식 피드)의 데이터 계층.
// 기존 앱 구조를 그대로 재사용한다: Firestore `posts` 컬렉션 + 공개 사진만 Storage.
// 순수 로직(스냅샷·토큰·가져오기 변환)은 recipe-share-model.js가 담당한다.
//
// ⚠️ 이 계층은 Firestore/Storage 보안 규칙에 의존한다. 규칙(firestore.rules·
//    storage.rules)이 게시돼야 안전하게 동작한다(docs/recipe-community.md).

import {
    db, storage,
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, limit, startAfter, serverTimestamp,
    storageRef, uploadString, getDownloadURL, deleteObject,
} from "./firebase-config.js";
import CoffeeNotesStorage from "./storage.js";
import {
    VISIBILITY, buildPublicSnapshot, buildImportedRecipe, generateShareToken,
} from "./recipe-share-model.js";
import { isDemo, demoFeed, demoGetPost } from "./demo.js";

const POSTS = 'posts';
const FEED_PAGE = 12;

// 공개 게시물의 커버 사진을 Storage에 올린다. 경로에 uid가 들어가 규칙이 소유자를
// 검증한다. dataUrl은 이미 캔버스 재인코딩으로 EXIF가 제거된 JPEG/PNG다(main.js).
async function uploadCover(uid, postId, dataUrl) {
    const path = `posts/${uid}/${postId}/cover.jpg`;
    const r = storageRef(storage, path);
    await uploadString(r, dataUrl, 'data_url');
    const url = await getDownloadURL(r);
    return { url, path };
}

async function deleteCover(uid, postId) {
    try {
        await deleteObject(storageRef(storage, `posts/${uid}/${postId}/cover.jpg`));
    } catch (e) {
        // 이미 없거나 권한 문제면 조용히 넘어간다 — 게시물 상태 변경이 사진 삭제
        // 실패로 막히면 안 된다.
        console.warn('[community] 커버 사진 삭제 실패(무시)', e);
    }
}

/**
 * 개인 레시피를 공개 게시물로 게시한다.
 * @param {Object} o
 *   @param {Object} o.recipe  개인 레시피(추출 조건 원천)
 *   @param {Object} o.pub     공유 작성 값(title, description, visibility, includePhoto, photoUrl, bean, roaster, gear, grinder, grindSetting)
 *   @param {Object} o.user    현재 로그인 사용자(uid, displayName)
 * @returns {Promise<{postId:string, visibility:string, shareToken?:string}>}
 */
export async function publishPost({ recipe, pub, user }) {
    // 데모: Firebase에 쓰지 않고 성공을 흉내낸다(로그인도 요구 안 함).
    if (isDemo()) {
        const visibility = (pub && pub.visibility) || 'private';
        return { postId: 'demo-' + Date.now().toString(36), visibility,
                 shareToken: visibility === 'unlisted' ? 'demotoken' : undefined };
    }
    if (!user || !user.uid) throw new Error('로그인이 필요합니다.');

    // 문서 ID를 먼저 확보해 사진 경로에 쓴다(사진 → 문서 순서로 한 번만 쓴다).
    const ref = doc(collection(db, POSTS));
    const postId = ref.id;

    const snapshot = buildPublicSnapshot(recipe, pub);

    // 사진 업로드(포함을 선택했고 데이터가 있을 때만).
    let photoUrl = '';
    if (pub && pub.includePhoto && pub.photoUrl) {
        try {
            const up = await uploadCover(user.uid, postId, pub.photoUrl);
            photoUrl = up.url;
        } catch (e) {
            // 사진 실패가 게시 전체를 막지 않게: 사진 없이 게시하고 호출부에 알린다.
            console.warn('[community] 커버 업로드 실패 — 사진 없이 게시', e);
            photoUrl = '';
        }
    }

    const data = {
        ...snapshot,
        photoUrl,
        hasPhoto: !!photoUrl,
        ownerId: user.uid,
        ownerName: (user.displayName || '').trim() || '커피메이트',
        hiddenByAdmin: false,
        version: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    // unlisted(링크 공유)면 토큰을 남긴다(현재는 문서 ID가 사실상 비밀이지만,
    // 후속 재발급/무효화 확장을 위해 필드를 마련한다 — docs 4절 한계 참고).
    if (data.visibility === VISIBILITY.UNLISTED) data.shareToken = generateShareToken();

    await setDoc(ref, data);
    return { postId, visibility: data.visibility, shareToken: data.shareToken };
}

/** 공유 해제: 피드·비소유자 접근에서 내린다(visibility→private). 사진도 삭제한다. */
export async function unpublishPost(postId, user) {
    if (!user || !user.uid) throw new Error('로그인이 필요합니다.');
    await updateDoc(doc(db, POSTS, postId), {
        visibility: VISIBILITY.PRIVATE,
        updatedAt: serverTimestamp(),
    });
    await deleteCover(user.uid, postId);
    return true;
}

/** 게시물 완전 삭제(문서 + 사진). */
export async function deletePost(postId, user) {
    if (!user || !user.uid) throw new Error('로그인이 필요합니다.');
    await deleteCover(user.uid, postId);
    await deleteDoc(doc(db, POSTS, postId));
    return true;
}

/**
 * 발견 피드. 최신순, 커서 기반 페이지네이션.
 * @param {Object} [o]
 *   @param {'all'|'espresso'|'drip'} [o.method='all']
 *   @param {*} [o.cursor] 이전 페이지의 마지막 문서 스냅샷(startAfter용)
 * @returns {Promise<{items:Array, cursor:*, done:boolean}>}
 */
export async function fetchFeed({ method = 'all', cursor = null } = {}) {
    if (isDemo()) return demoFeed(method);
    const parts = [
        collection(db, POSTS),
        where('visibility', '==', VISIBILITY.PUBLIC),
        where('status', '==', 'active'),
    ];
    if (method === 'espresso' || method === 'drip') parts.push(where('method', '==', method));
    parts.push(orderBy('createdAt', 'desc'));
    if (cursor) parts.push(startAfter(cursor));
    parts.push(limit(FEED_PAGE));

    const snap = await getDocs(query(...parts));
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor;
    return { items, cursor: last, done: snap.docs.length < FEED_PAGE };
}

/** 게시물 1건. 규칙이 접근을 검증한다(비공개·해제·숨김·잘못된 ID는 실패로 온다). */
export async function getPost(postId) {
    if (isDemo()) return demoGetPost(postId);
    const snap = await getDoc(doc(db, POSTS, postId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

/** 특정 작성자의 전체 공개 게시물(공개 프로필용). */
export async function fetchUserPosts(ownerId) {
    const q = query(
        collection(db, POSTS),
        where('ownerId', '==', ownerId),
        where('visibility', '==', VISIBILITY.PUBLIC),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(30),
    );
    const snap = await getDocs(q);
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    return items;
}

/**
 * 게시물을 내 개인 레시피 "사본"으로 가져온다(§5-6: 독립 사본, 비공개).
 * 이미 같은 원본을 가져왔는지 확인해 중복 사본을 막는다(§12-9).
 * @returns {Promise<{recipeId:*, duplicated:boolean}>}
 */
export async function importPost(post, user) {
    // 데모: 실제 저장 없이 성공을 흉내낸다.
    if (isDemo()) return { recipeId: 'demo', duplicated: false, demo: true };
    if (!user || !user.uid) throw new Error('로그인이 필요합니다.');

    // 중복 방지: 내 recipes 중 source.postId가 같은 것이 있으면 새로 만들지 않는다.
    const existing = (await CoffeeNotesStorage.getRecipes()) || [];
    const dup = existing.find((r) => r && r.source && r.source.postId === post.id);
    if (dup) return { recipeId: dup.id, duplicated: true };

    const imported = buildImportedRecipe(post, {
        postId: post.id,
        ownerId: post.ownerId,
        ownerName: post.ownerName || '',
        version: post.version ?? null,
        importedAt: new Date().toISOString(),
    });
    imported.date = new Date().toISOString();
    const recipeId = await CoffeeNotesStorage.saveRecipe(imported);
    return { recipeId, duplicated: false };
}
