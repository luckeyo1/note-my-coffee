// recipe-share-model.js
// 레시피 공유·가져오기의 "순수 로직"만 모은 모듈이다. Firebase·DOM에 의존하지
// 않으므로 단위 테스트가 가능하고(이 저장소엔 러너가 없어 node로 직접 돌린다),
// 이후 공유 작성/상세/가져오기 UI가 이 함수들을 가져다 쓴다.
//
// 여기서 다루는 개념(문서: docs/recipe-community.md):
//   - 공개 범위(visibility): private | unlisted | public
//   - 공유 토큰: '링크로 공유'용, 추측하기 어려운 값
//   - 공개 스냅샷: 개인 기록에서 "공개해도 되는 필드만" 뽑아낸 것
//   - 변경 비교(diff): 가져온 원본 기준값 대비 지금 값이 무엇이 바뀌었나
//   - 추출 비율: 도징 대비 추출량(에스프레소)·투입 물량(드립)

export const VISIBILITY = Object.freeze({
    PRIVATE: 'private',    // 소유자만
    UNLISTED: 'unlisted',  // 링크를 가진 사람만, 피드·프로필에는 노출 안 함
    PUBLIC: 'public',      // 피드·공개 프로필에 노출
});

const VISIBILITY_VALUES = Object.freeze(Object.values(VISIBILITY));

export function isValidVisibility(v) {
    return VISIBILITY_VALUES.includes(v);
}

// 기존 데이터에 공개 범위가 없으면 비공개로 간주한다(§8: 안전 기본값).
export function normalizeVisibility(v) {
    return isValidVisibility(v) ? v : VISIBILITY.PRIVATE;
}

// 피드/프로필 노출 여부 — public이고 활성(active) 상태일 때만.
export function isFeedVisible(post) {
    if (!post) return false;
    return normalizeVisibility(post.visibility) === VISIBILITY.PUBLIC
        && (post.status || 'active') === 'active';
}

// ── 공유 토큰 ────────────────────────────────────────────────────────────────
// '링크로 공유'(unlisted)의 접근 토큰. 추측하기 어렵게 만든다(§8).
// 가능하면 Web Crypto(crypto.getRandomValues)를 쓰고, 없으면 Math.random로
// 떨어진다(테스트/구형 환경). 길이는 22자 base62 ≈ 131비트.
export function generateShareToken(len = 22) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const out = [];
    const cryptoObj = (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto : null;
    if (cryptoObj && cryptoObj.getRandomValues) {
        const buf = new Uint32Array(len);
        cryptoObj.getRandomValues(buf);
        for (let i = 0; i < len; i++) out.push(alphabet[buf[i] % alphabet.length]);
    } else {
        for (let i = 0; i < len; i++) out.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
    return out.join('');
}

// ── 추출 비율 ────────────────────────────────────────────────────────────────
// 에스프레소: 추출량(음료 무게) / 도징. 드립: 투입 물량 / 원두량.
// 둘 다 "물(또는 음료) ÷ 가루"라 같은 수식이지만, 의미가 다르므로 호출부에서
// 라벨을 구분한다(§5-1: 추출량과 투입 물량을 혼용하지 않는다).
// 반환: { ratio:number|null, text:string } — 값이 유효하지 않으면 ratio=null.
export function brewRatio(dose, liquid, digits = 1) {
    const d = Number(dose);
    const l = Number(liquid);
    if (!Number.isFinite(d) || !Number.isFinite(l) || d <= 0 || l <= 0) {
        return { ratio: null, text: '—' };
    }
    const ratio = l / d;
    return { ratio, text: '1:' + ratio.toFixed(digits) };
}

// ── 공개 스냅샷 ──────────────────────────────────────────────────────────────
// 개인 기록에서 "공개해도 되는 필드만" 추린다. 개인 메모(privateNotes)·평점·
// 사진 원본 등은 명시적으로 제외한다(§5-3: 개인 메모를 공개 설명으로 자동 복사
// 하지 않는다 / 사진 공개는 별도 선택). 공개 제목·설명·사진은 작성자가 이 화면에서
// 따로 입력/선택한 값을 받는다.
//
// @param {Object} recipe  개인 레시피(추출 조건 원천)
// @param {Object} pub      작성자가 공유 작성 화면에서 정한 값
//   { title, description, method('espresso'|'drip'), visibility,
//     includePhoto:boolean, photoUrl?, bean?, roaster?, gear?, grinder?, grindSetting? }
// @returns {Object} 공개 게시물에 저장할 스냅샷(민감 필드 없음)
export function buildPublicSnapshot(recipe, pub) {
    const r = recipe || {};
    const p = pub || {};
    const method = p.method || r.mode || 'espresso';

    // 추출 조건은 원천(개인 기록)에서 그대로 가져오되, 숫자로 정규화한다.
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    const params = {
        dose: num(r.dosing),
        waterTemp: num(r.temp),
        timeSec: num(r.time),
        // 에스프레소=음료 무게, 드립=투입 물량. 필드명은 yield로 통일하되 의미는
        // method로 구분한다(라벨은 UI에서).
        yield: num(r.yield),
    };

    const snapshot = {
        title: (p.title || '').trim(),
        description: (p.description || '').trim(),
        method,
        params,
        visibility: normalizeVisibility(p.visibility),
        // 도구/원두는 공개용으로 작성자가 확인한 값만(없으면 원본에서 제안).
        bean: (p.bean != null ? p.bean : (r.beanName || '')).trim(),
        roaster: (p.roaster || '').trim(),
        gear: (p.gear || '').trim(),
        grinder: (p.grinder || '').trim(),
        grindSetting: (p.grindSetting || '').trim(),
        // 사진은 명시적으로 포함을 선택했을 때만.
        photoUrl: p.includePhoto && p.photoUrl ? p.photoUrl : '',
        hasPhoto: !!(p.includePhoto && p.photoUrl),
        status: 'active',
    };
    return snapshot;
}

// ── 가져오기(사본 생성) ─────────────────────────────────────────────────────
// 공개 게시물을 내 개인 레시피 "사본"으로 만든다(§5-6: 북마크가 아니라 독립 사본).
// baseline(변경 비교 기준값)과 출처 메타를 함께 심는다. 사본은 항상 비공개.
//
// @param {Object} post  공개 게시물(스냅샷)
// @param {Object} meta  { postId, ownerId, ownerName, version, importedAt }
// @returns {Object} 개인 recipes 컬렉션에 저장할 레시피 객체(부분)
export function buildImportedRecipe(post, meta) {
    const pr = (post && post.params) || {};
    const m = meta || {};
    const baseline = {
        dosing: pr.dose ?? null,
        temp: pr.waterTemp ?? null,
        time: pr.timeSec ?? null,
        yield: pr.yield ?? null,
    };
    return {
        // 추출 조건은 원본에서 그대로 시작한다.
        mode: post.method || 'espresso',
        dosing: baseline.dosing,
        temp: baseline.temp,
        time: baseline.time,
        yield: baseline.yield,
        beanName: post.bean || '',
        // 출처와 변경 기준.
        source: {
            postId: m.postId || null,
            ownerId: m.ownerId || null,
            ownerName: m.ownerName || '',
            version: m.version ?? null,
            importedAt: m.importedAt || new Date().toISOString(),
            title: post.title || '',
        },
        baseline,
        // 사본은 항상 비공개로 시작한다(§5-6).
        visibility: VISIBILITY.PRIVATE,
        // 가져온 원본 사진을 내 새 공개 게시물에 자동 재게시하지 않는다(§5-6).
        // 참고용으로 원본 사진 URL만 보관하고, imageUrl(내 사진)은 비운다.
        sourcePhotoUrl: post.photoUrl || '',
        imageUrl: '',
    };
}

// ── 변경 비교(diff) ─────────────────────────────────────────────────────────
// 가져온 기준값(baseline) 대비 현재 값이 무엇이 바뀌었는지 계산한다(§5-7).
// 변경 없는 항목은 기본적으로 생략한다. 단위와 소수 자릿수를 항목별로 다룬다.
//
// @param {Object} baseline { dosing, temp, time, yield }
// @param {Object} current  같은 형태
// @param {'espresso'|'drip'} method
// @returns {Array<{key,label,unit,from,to}>} 변경된 항목만
export function diffFromBaseline(baseline, current, method) {
    if (!baseline || !current) return [];
    const isEsp = (method || 'espresso') !== 'drip';
    const fields = [
        { key: 'dosing', label: isEsp ? '도징' : '원두량', unit: 'g', digits: 1 },
        { key: 'temp', label: '물 온도', unit: '℃', digits: 0 },
        { key: 'time', label: '추출 시간', unit: '초', digits: 0 },
        { key: 'yield', label: isEsp ? '추출량' : '투입 물량', unit: 'g', digits: 0 },
    ];
    const round = (v, d) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return null;
        const f = Math.pow(10, d);
        return Math.round(n * f) / f;
    };
    const out = [];
    for (const f of fields) {
        const from = round(baseline[f.key], f.digits);
        const to = round(current[f.key], f.digits);
        if (from === null || to === null) continue; // 값이 없으면 비교 생략
        if (from === to) continue;                  // 변경 없음은 생략(§5-7)
        out.push({ key: f.key, label: f.label, unit: f.unit, from, to });
    }
    return out;
}
