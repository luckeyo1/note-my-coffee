// bean-ai.js — 기록한 레시피를 바탕으로 원두를 추천하는 팝업.
//
// 그라운딩 원칙: AI는 절대 원두를 지어내지 않는다. beans.js의 카탈로그(window.COFFEE_BEANS)
// 안에서만 골라 id로 반환하고, 프론트가 그 id로 실제 카탈로그 항목(진짜 구매 링크)을
// 렌더한다. AI가 없거나(미설정·차단·쿼터 초과) 유효한 id를 못 주면 규칙 기반 점수화로
// 폴백한다 — 둘 다 같은 카탈로그를 쓰므로 어떤 경로든 "실제 구매 가능한 원두"가 나온다.
//
// firebase-config.js의 aiGenerateJSON은 Firebase AI Logic(Gemini, 무료 티어)로 호출된다.

import { aiGenerateJSON, track } from "./firebase-config.js";

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';

const T = {
    en: {
        title: "AI Bean Picks", loading: "Reading your recipes…",
        buy: (store) => `Buy at ${store} →`,
        emptyTitle: "Not enough recipes yet",
        emptyBody: "Log a few brews first, or take the taste quiz to get bean picks.",
        quizCta: "Take the taste quiz →",
        aiBadge: "AI pick", ruleBadge: "Matched to your logs",
        errNote: "Couldn't reach the AI — here are picks matched to your logs.",
        close: "Close",
        heading: (n) => `Based on your ${n} logged ${n === 1 ? 'recipe' : 'recipes'}`,
    },
    ko: {
        title: "AI 원두 추천", loading: "레시피를 분석하는 중…",
        buy: (store) => `${store}에서 구매 →`,
        emptyTitle: "아직 기록이 부족해요",
        emptyBody: "먼저 몇 잔 기록하거나, 취향 검사로 원두를 추천받아 보세요.",
        quizCta: "취향 검사 하러 가기 →",
        aiBadge: "AI 추천", ruleBadge: "기록 기반 추천",
        errNote: "AI에 연결하지 못해, 기록에 맞춘 추천을 보여드려요.",
        close: "닫기",
        heading: (n) => `기록한 ${n}개의 레시피를 바탕으로`,
    },
};

// 사용자가 자유 입력한 테이스팅 노트/태그(앱 태그: Floral·Fruity·Nutty·Chocolaty·Sweet·
// Acidic·Bitter·Spicy)를 카탈로그 flavorTags 어휘로 잇는 매핑.
const FLAVOR_KEYWORDS = {
    floral: ['floral', '플로럴', '꽃'],
    fruity: ['fruity', 'fruit', '프루티', '과일', 'berry', '베리', 'citrus', '시트러스'],
    acidic: ['acidic', 'acidity', 'bright', '산미', '신맛'],
    'tea-like': ['tea', '홍차', '티'],
    sweet: ['sweet', '단맛', '달'],
    caramel: ['caramel', '캐러멜', 'honey', '꿀'],
    honey: ['honey', '꿀'],
    balanced: ['balanced', 'balance', '밸런스', '균형'],
    nutty: ['nutty', 'nut', '견과', '고소'],
    chocolate: ['chocolate', 'chocolaty', 'cocoa', '초콜릿', '초콜렛', '카카오'],
    milky: ['milk', 'latte', '우유', '라떼', 'creamy'],
    bitter: ['bitter', '쓴맛', '쓴'],
    'dark-chocolate': ['dark chocolate', 'dark-chocolate', '다크초콜릿', '다크'],
    heavy: ['heavy', 'body', 'bold', '바디', '묵직', '진한'],
    smoky: ['smoky', 'smoke', '스모키', '스모크'],
};

// flavorTag → 선호 로스팅(라이트/미디엄/미디엄다크/다크) 방향 힌트
const TAG_ROAST = {
    floral: 'light', fruity: 'light', acidic: 'light', 'tea-like': 'light',
    sweet: 'medium', caramel: 'medium', honey: 'medium', balanced: 'medium',
    nutty: 'medium-dark', chocolate: 'medium-dark', milky: 'medium-dark',
    bitter: 'dark', 'dark-chocolate': 'dark', heavy: 'dark', smoky: 'dark',
};

// ── 순수 로직 (오프라인 테스트 가능) ────────────────────────────────────────

// 기록 배열 → 취향 요약. 평점 높은/성공한 잔의 노트에 가중치를 준다.
export function summarizeRecipes(recipes) {
    const list = Array.isArray(recipes) ? recipes.filter(Boolean) : [];
    const flavorCounts = {};
    const originCounts = {};
    const modeCounts = { espresso: 0, drip: 0 };
    let ratingSum = 0, ratingN = 0, successN = 0;

    for (const r of list) {
        const rating = Math.max(0, Math.min(5, parseInt(r.overallRating, 10) || 0));
        if (rating) { ratingSum += rating; ratingN++; }
        if (r.success) successN++;
        const mode = r.mode === 'drip' ? 'drip' : 'espresso';
        modeCounts[mode]++;
        if (r.origin) originCounts[r.origin] = (originCounts[r.origin] || 0) + 1;

        // 좋았던 잔일수록 그 맛 취향을 더 신뢰한다
        const weight = (rating >= 4 ? 2 : 1) + (r.success ? 0.5 : 0);
        const text = `${r.tasteNotes || ''} ${r.beanName || ''}`.toLowerCase();
        for (const [tag, kws] of Object.entries(FLAVOR_KEYWORDS)) {
            if (kws.some((k) => text.includes(k))) flavorCounts[tag] = (flavorCounts[tag] || 0) + weight;
        }
    }

    const topOrigins = Object.entries(originCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([o]) => o);
    const preferredMode = modeCounts.drip > modeCounts.espresso ? 'drip' : 'espresso';

    // 선호 로스팅: 향미 태그의 로스팅 방향을 합산해 가장 강한 쪽
    const roastScore = { light: 0, medium: 0, 'medium-dark': 0, dark: 0 };
    for (const [tag, w] of Object.entries(flavorCounts)) {
        const roast = TAG_ROAST[tag];
        if (roast) roastScore[roast] += w;
    }
    const preferredRoast = Object.entries(roastScore).sort((a, b) => b[1] - a[1])[0][1] > 0
        ? Object.entries(roastScore).sort((a, b) => b[1] - a[1])[0][0]
        : null;

    return {
        count: list.length,
        avgRating: ratingN ? Math.round((ratingSum / ratingN) * 10) / 10 : null,
        successRate: list.length ? Math.round((successN / list.length) * 100) : null,
        preferredMode, preferredRoast, topOrigins,
        flavorCounts, // { tag: weight }
    };
}

// 규칙 기반 점수화 → 카탈로그에서 상위 n개. AI 폴백이자 항상 결과를 보장하는 경로.
export function ruleBasedPicks(summary, catalog, n = 3) {
    const beans = Array.isArray(catalog) ? catalog : [];
    const flavors = summary.flavorCounts || {};
    const scored = beans.map((b) => {
        let score = 0;
        for (const tag of (b.flavorTags || [])) if (flavors[tag]) score += flavors[tag] * 2;
        if (summary.preferredRoast && b.roastLevel === summary.preferredRoast) score += 3;
        if ((b.brewFit || []).includes(summary.preferredMode)) score += 1.5;
        return { bean: b, score };
    });
    // 신호가 전혀 없으면(초기 사용자) 선호 추출에 맞는 밸런스 원두를 기본 제시
    const anySignal = scored.some((s) => s.score > 0);
    if (!anySignal) {
        return beans
            .map((b) => ({ bean: b, score: (b.brewFit || []).includes(summary.preferredMode) ? 1 : 0, tie: b.profile === 'B' ? 1 : 0 }))
            .sort((a, b) => (b.score + b.tie) - (a.score + a.tie))
            .slice(0, n).map((s) => s.bean);
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, n).map((s) => s.bean);
}

export function buildPrompt(summary, catalog, lang) {
    const slim = catalog.map((b) => ({
        id: b.id, name: b.name, roaster: b.roaster, roastLevel: b.roastLevel,
        flavorTags: b.flavorTags, brewFit: b.brewFit, profile: b.profile,
    }));
    const langName = lang === 'ko' ? 'Korean' : 'English';
    return [
        'You recommend coffee beans for a specialty-coffee logging app.',
        'Recommend beans ONLY from the CATALOG below. Never invent beans or ids.',
        'Choose the 3 distinct beans that best match the user\'s taste from their brewing history.',
        `Write each "reason" and the "summary" in ${langName}, one short sentence each.`,
        'Respond with STRICT JSON only, no markdown:',
        '{"summary": string, "picks": [{"id": string, "reason": string}]}',
        `USER_TASTE_SUMMARY: ${JSON.stringify(summary)}`,
        `CATALOG: ${JSON.stringify(slim)}`,
    ].join('\n');
}

// AI 응답 텍스트 → 카탈로그로 검증된 추천. 유효 id가 없으면 null(→폴백).
export function parseAIPicks(text, catalog) {
    let data;
    try {
        // 혹시 코드펜스로 감싸 오면 벗겨낸다
        const cleaned = String(text).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        data = JSON.parse(cleaned);
    } catch { return null; }
    if (!data || !Array.isArray(data.picks)) return null;
    const byId = new Map(catalog.map((b) => [b.id, b]));
    const seen = new Set();
    const picks = [];
    for (const p of data.picks) {
        const bean = byId.get(p && p.id);
        if (bean && !seen.has(bean.id)) {
            seen.add(bean.id);
            picks.push({ bean, reason: typeof p.reason === 'string' ? p.reason : '' });
        }
    }
    if (!picks.length) return null;
    return { summary: typeof data.summary === 'string' ? data.summary : '', picks: picks.slice(0, 3) };
}

// ── 팝업 UI ─────────────────────────────────────────────────────────────────

function removeModal() {
    const el = document.getElementById('bean-ai-modal');
    if (el) el.remove();
}

function shell(lang, inner) {
    const t = T[lang];
    removeModal();
    const overlay = document.createElement('div');
    overlay.id = 'bean-ai-modal';
    overlay.className = 'recipe-share-overlay';
    overlay.innerHTML = `
        <div class="recipe-share-box bean-ai-box">
            <div class="recipe-share-header">
                <span>✨ ${esc(t.title)}</span>
                <button class="recipe-share-close" data-close>✕</button>
            </div>
            <div class="bean-ai-body">${inner}</div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.dataset.close !== undefined) removeModal();
    });
    return overlay;
}

function renderPicks(overlay, lang, result, source, count) {
    const t = T[lang];
    const body = overlay.querySelector('.bean-ai-body');
    const badge = source === 'ai' ? t.aiBadge : t.ruleBadge;
    const note = source === 'ai-failed' ? `<p class="bean-ai-errnote">${esc(t.errNote)}</p>` : '';
    const summaryLine = result.summary ? `<p class="bean-ai-summary">${esc(result.summary)}</p>` : '';
    const cards = result.picks.map(({ bean, reason }) => {
        const url = safeUrl(bean.url);
        return `
            <div class="bean-ai-card">
                <div class="bean-ai-name">${esc(bean.name)}</div>
                <div class="bean-ai-roaster">${esc(bean.roaster)}</div>
                ${reason ? `<div class="bean-ai-reason">${esc(reason)}</div>` : `<div class="bean-ai-reason">${esc(bean.desc || '')}</div>`}
                ${url ? `<a class="bean-ai-buy" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-bean="${esc(bean.id)}" data-store="${esc(bean.store)}">${esc(t.buy(bean.store))}</a>` : ''}
            </div>`;
    }).join('');
    body.innerHTML = `
        <p class="bean-ai-heading"><span class="bean-ai-badge ${source === 'ai' ? 'is-ai' : ''}">${esc(badge)}</span> ${esc(t.heading(count))}</p>
        ${summaryLine}${note}
        <div class="bean-ai-grid">${cards}</div>`;

    // 구매 클릭은 제휴 수익화 판단 지표 — 취향 검사와 동일하게 계측
    body.querySelectorAll('.bean-ai-buy').forEach((a) => {
        a.addEventListener('click', () => {
            try { track('ai_bean_link_click', { source, bean_id: a.dataset.bean, store: a.dataset.store }); } catch (e) { /* noop */ }
        });
    });
}

function renderEmpty(overlay, lang) {
    const t = T[lang];
    overlay.querySelector('.bean-ai-body').innerHTML = `
        <div class="bean-ai-empty">
            <p class="bean-ai-empty-title">${esc(t.emptyTitle)}</p>
            <p class="bean-ai-empty-body">${esc(t.emptyBody)}</p>
            <a class="recipe-share-btn recipe-share-btn--gold" href="index.html#quiz">${esc(t.quizCta)}</a>
        </div>`;
}

/**
 * AI 원두 추천 팝업을 연다.
 * @param {Object} opts
 * @param {Array}  opts.recipes  사용자 레시피 배열(로그북 캐시)
 * @param {string} opts.lang     'ko' | 'en'
 */
export async function openBeanRecommender({ recipes, lang }) {
    const L = T[lang] ? lang : 'en';
    const t = T[L];
    const catalog = Array.isArray(window.COFFEE_BEANS) ? window.COFFEE_BEANS : [];

    const list = Array.isArray(recipes) ? recipes.filter(Boolean) : [];
    if (!list.length || !catalog.length) {
        const overlay = shell(L, `<div class="bean-ai-loading">${esc(t.loading)}</div>`);
        renderEmpty(overlay, L);
        try { track('ai_bean_recommend_opened', { state: 'empty', recipes: list.length }); } catch (e) { /* noop */ }
        return;
    }

    const overlay = shell(L, `<div class="bean-ai-loading"><span class="bean-ai-spinner"></span>${esc(t.loading)}</div>`);
    const summary = summarizeRecipes(list);
    try { track('ai_bean_recommend_opened', { state: 'ok', recipes: list.length }); } catch (e) { /* noop */ }

    let result = null, source = 'rule';
    try {
        const text = await aiGenerateJSON(buildPrompt(summary, catalog, L));
        result = parseAIPicks(text, catalog);
        if (result) { source = 'ai'; }
    } catch (e) {
        console.warn('[bean-ai] AI 추천 실패 — 규칙 기반으로 폴백합니다.', e);
        source = 'ai-failed';
    }
    if (!result) {
        if (source !== 'ai-failed') source = 'rule';
        const picks = ruleBasedPicks(summary, catalog, 3).map((bean) => ({ bean, reason: '' }));
        result = { summary: '', picks };
    }

    // 팝업이 그 사이 닫혔으면 렌더하지 않는다
    if (!document.getElementById('bean-ai-modal')) return;
    renderPicks(overlay, L, result, source, list.length);
    try { track('ai_bean_recommend_result', { source, picks: result.picks.length }); } catch (e) { /* noop */ }
}
