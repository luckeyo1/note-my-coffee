// admin.js — 운영 지표 대시보드
//
// 접근 제어에 대해: 아래 ADMIN_EMAILS는 화면을 가리는 용도일 뿐 보안 장치가 아니다.
// 실제 차단은 Firestore 보안 규칙에서 해야 한다. 규칙이 관리자에게 recipes 전체
// 읽기를 허용하지 않으면 이 페이지의 조회는 permission-denied로 실패한다.
// (필요한 규칙은 ADMIN.md 참고)
const ADMIN_EMAILS = [
    'qorlgh1994@gmail.com',
];

// 구글 로그인만 인정한다. 이메일/비밀번호 계정은 같은 주소를 스스로 지어낼 수 있고,
// 그 경우 emailVerified가 false로 남는다.
const isAdminUser = (user) =>
    !!user
    && user.emailVerified
    && user.providerData.some((p) => p.providerId === 'google.com')
    && ADMIN_EMAILS.includes((user.email || '').toLowerCase());

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (id) => document.getElementById(id);
const isDemo = new URLSearchParams(location.search).get('demo') === '1';

let allRecipes = [];
let rangeDays = 30;
let userSort = 'count';   // 사용자 목록 정렬: 'count'(기록순) | 'recent'(최근순)
let leads = [];           // 리드마그넷으로 수집된 이메일 (leads 컬렉션)
let visits = new Map();   // dayKey → { sessions, visitors, p_* } (stats_visits 컬렉션)

// 데이터 출처. 'aggregate'는 stats_daily/users를 읽는 가벼운 경로,
// 'scan'은 recipes 전체를 내려받는 예전 경로다(집계가 아직 없거나 권한이 없을 때).
// docs/admin-roadmap.md Phase 1 참고.
let dataMode = 'scan';
let agg = null;   // { daily: Map<dayKey, obj>, users: [], beanNames: Map<id,name>, recent: [] }
let fbRef = null; // 로드된 firebase-config 모듈. '집계 재생성' 버튼이 쓴다.

/* ────────────────────────── helpers ────────────────────────── */

const svg = (name, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
};

const nfInt = new Intl.NumberFormat('ko-KR');
const fmt = (n) => nfInt.format(n);
const compact = (n) => (n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : fmt(n));

const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };

const dayKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
const shortDate = (key) => key.slice(5).replace('-', '.');

// 값(길이)이 이미 크기를 말해주므로 막대 색은 정체성만 담당한다.
const cssVar = (name) => `var(${name})`;

/* ────────────────────────── demo data ────────────────────────── */

// 시드 고정 PRNG — 새로고침해도 같은 화면이 나와야 디자인 검토가 가능하다.
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeDemoRecipes() {
    const rnd = mulberry32(20260727);
    const beans = [
        'Ethiopia Yirgacheffe', 'Colombia Huila', 'Kenya AA', 'Brazil Cerrado',
        'Guatemala Antigua', 'Costa Rica Tarrazu', 'Panama Geisha',
        'Indonesia Mandheling', 'Ethiopia Sidamo', 'Peru Cajamarca', 'Rwanda Kivu',
    ];
    const notes = ['Floral · Peach', 'Chocolate · Nutty', 'Citrus · Bright', 'Caramel · Round', 'Berry · Juicy'];
    // 사용자마다 '합류일'을 준다. 이게 없으면(매 기록마다 무작위 배정) 모든 사용자의
    // 첫 기록이 초반에 몰려서, 신규 유입 추이가 0으로 깔리고 리텐션 코호트도 한 줄만
    // 생긴다 — 데모 모드로 그 카드들을 검증할 수 없다.
    // joinDay는 '며칠 전'이며 89(가장 오래전)~0(오늘) 범위다.
    const users = Array.from({ length: 52 }, (_, i) => ({
        id: 'demoUser' + String(i).padStart(3, '0'),
        // 지수를 1보다 작게 둬서 최근으로 갈수록 합류가 조금씩 늘어난다(완만한 성장)
        joinDay: Math.floor(89 * Math.pow(rnd(), 1.25)),
    }));
    const out = [];
    const now = Date.now();

    const pushRecipe = (user, day) => {
        const d = new Date(now - day * 864e5);
        d.setHours(6 + Math.floor(rnd() * 15), Math.floor(rnd() * 60), 0, 0);
        const espresso = rnd() < 0.62;
        const rr = rnd();
        const rating = rr < 0.06 ? 1 : rr < 0.16 ? 2 : rr < 0.38 ? 3 : rr < 0.74 ? 4 : 5;
        const bi = Math.min(beans.length - 1, Math.floor(Math.pow(rnd(), 1.7) * beans.length));
        out.push({
            id: 'demo-' + day + '-' + user.id + '-' + out.length,
            userId: user.id,
            date: d.toISOString(),
            mode: espresso ? 'espresso' : 'drip',
            dosing: espresso ? 17 + Math.round(rnd() * 40) / 10 : 14 + Math.round(rnd() * 60) / 10,
            temp: 90 + Math.round(rnd() * 60) / 10,
            time: espresso ? 24 + Math.round(rnd() * 120) / 10 : 150 + Math.round(rnd() * 900) / 10,
            yield: espresso ? 30 + Math.round(rnd() * 150) / 10 : 220 + Math.round(rnd() * 1200) / 10,
            beanName: beans[bi],
            origin: '',
            tasteNotes: notes[Math.floor(rnd() * notes.length)],
            overallRating: rating,
            success: rating >= 4,
            beanStatus: 'opened',
        });
    };

    for (let day = 89; day >= 0; day--) {
        const weekend = [0, 6].includes(new Date(now - day * 864e5).getDay()) ? 1.45 : 1;

        // 1) 오늘 합류한 사람은 반드시 첫 기록을 남긴다 → 첫 기록일 = 합류일
        for (const u of users) {
            if (u.joinDay === day) pushRecipe(u, day);
        }

        // 2) 기존 사용자의 재방문 — 합류 후 시간이 지날수록 확률이 떨어진다(리텐션 감쇠)
        for (const u of users) {
            if (u.joinDay <= day) continue;              // 아직 합류 전
            const weeksSince = (u.joinDay - day) / 7;
            const p = 0.34 * Math.exp(-weeksSince / 5) * weekend;
            if (rnd() < p) pushRecipe(u, day);
        }
    }
    return out;
}

/* ────────────────────────── aggregation ────────────────────────── */

function sliceByRange(recipes, days) {
    if (!days) return recipes.slice();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
    return recipes.filter((r) => {
        const t = new Date(r.date);
        return !isNaN(t) && t >= from;
    });
}

function aggregate(recipes, days) {
    const valid = recipes.filter((r) => r && r.date && !isNaN(new Date(r.date)));

    // 일별 시계열 — 기록이 0인 날도 자리를 지켜야 추이가 왜곡되지 않는다.
    const span = days || (() => {
        if (!valid.length) return 30;
        const oldest = valid.reduce((a, r) => Math.min(a, new Date(r.date).getTime()), Infinity);
        return Math.min(365, Math.max(7, Math.ceil((Date.now() - oldest) / 864e5) + 1));
    })();

    const byDay = new Map();
    for (let i = span - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        byDay.set(dayKey(d), 0);
    }
    for (const r of valid) {
        const k = dayKey(new Date(r.date));
        if (byDay.has(k)) byDay.set(k, byDay.get(k) + 1);
    }

    const users = new Set(valid.map((r) => r.userId).filter(Boolean));

    // 활성화 → 유지 퍼널 (Firestore 부분 퍼널).
    // 랜딩·CTA·가입 단계는 GA4에만 있어 여기서 못 그린다(docs/funnel.md 참고).
    // Firestore recipes로 그릴 수 있는 건 '기록을 남긴 사용자'가 얼마나 깊이
    // 정착하는가다 — 사용자별 기록 수로 단계를 나눈다. 각 단계는 앞 단계의
    // 부분집합이라 반드시 단조 감소한다(진짜 퍼널). 선택한 기간으로 스코프된다.
    const perUser = new Map();
    for (const r of valid) {
        if (!r.userId) continue;
        perUser.set(r.userId, (perUser.get(r.userId) || 0) + 1);
    }
    const perUserCounts = [...perUser.values()];
    const funnel = [
        { label: '기록 사용자', hint: '1건 이상 저장', min: 1 },
        { label: '재기록', hint: '2건 이상 — 다시 돌아옴', min: 2 },
        { label: '정착', hint: '5건 이상 — 습관화', min: 5 },
        { label: '헤비 유저', hint: '10건 이상', min: 10 },
    ].map((s) => ({ ...s, users: perUserCounts.filter((c) => c >= s.min).length }));

    const todayK = dayKey(new Date());
    const today = valid.filter((r) => dayKey(new Date(r.date)) === todayK).length;

    const rated = valid.filter((r) => Number.isFinite(Number(r.overallRating)));
    const avgRating = rated.length
        ? rated.reduce((a, r) => a + Number(r.overallRating), 0) / rated.length
        : 0;

    const ratingCounts = [1, 2, 3, 4, 5].map(
        (n) => rated.filter((r) => Number(r.overallRating) === n).length
    );

    const espresso = valid.filter((r) => r.mode === 'espresso').length;
    const drip = valid.filter((r) => r.mode && r.mode !== 'espresso').length;

    const successCount = valid.filter((r) => r.success === true).length;
    const successRate = valid.length ? successCount / valid.length : 0;

    const beanMap = new Map();
    for (const r of valid) {
        const name = (r.beanName || '').trim();
        if (!name) continue;
        beanMap.set(name, (beanMap.get(name) || 0) + 1);
    }
    const beans = [...beanMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 10);

    const recent = valid
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20);

    return {
        total: valid.length,
        series: [...byDay.entries()].map(([key, count]) => ({ key, count })),
        users: users.size,
        funnel,
        today,
        avgRating,
        ratingCounts,
        ratedTotal: rated.length,
        espresso,
        drip,
        successCount,
        successRate,
        beans,
        recent,
    };
}

/* ──────────────── 마케팅 지표: 신규 유입 · 리텐션 · 활동 시간대 ────────────────
 *
 * 이 블록의 계산은 **항상 전체 기록(allRecipes)을 받아야 한다.** 기간으로 자른
 * 데이터로 '첫 기록일'을 구하면, 60일 전에 시작한 사용자가 "최근 30일" 화면에서
 * 신규로 잡힌다 — 유입이 실제보다 부풀려지는 치명적 오독이다.
 *
 * 가입일 필드가 따로 없으므로 **첫 기록일을 가입 시점의 프록시**로 쓴다. 또한
 * Firestore에는 로그인 사용자의 기록만 올라오므로 게스트는 잡히지 않는다.
 */

// 주 시작(월요일 00:00)으로 내림
function weekStart(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // 월=0
    return x;
}

// userId → 첫 기록 시각(ms)
function firstSeenMap(allRecipes) {
    const m = new Map();
    for (const r of allRecipes) {
        if (!r || !r.userId || !r.date) continue;
        const t = new Date(r.date).getTime();
        if (!Number.isFinite(t)) continue;
        const prev = m.get(r.userId);
        if (prev === undefined || t < prev) m.set(r.userId, t);
    }
    return m;
}

// 선택 기간의 일별 **신규** 사용자 수.
// 기존 '사용자 수' 타일은 기간 내 기록을 남긴 계정 수라 신규와 복귀가 섞여 있다.
// 이건 그 기간에 '처음' 기록한 사람만 센다 — 획득(acquisition) 지표.
function newUserSeries(allRecipes, days) {
    const firstSeen = firstSeenMap(allRecipes);
    const times = [...firstSeen.values()];

    const span = days || (() => {
        if (!times.length) return 30;
        const oldest = Math.min(...times);
        return Math.min(365, Math.max(7, Math.ceil((Date.now() - oldest) / 864e5) + 1));
    })();

    const byDay = new Map();
    for (let i = span - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        byDay.set(dayKey(d), 0);
    }
    for (const t of times) {
        const k = dayKey(new Date(t));
        if (byDay.has(k)) byDay.set(k, byDay.get(k) + 1);
    }
    return {
        series: [...byDay.entries()].map(([key, count]) => ({ key, count })),
        total: times.filter((t) => byDay.has(dayKey(new Date(t)))).length,
    };
}

// 주간 리텐션 코호트. 첫 기록 주차로 사람을 묶고, 그 뒤 N주차에 다시 기록했는지 본다.
// 기간 필터와 무관하게 전체 데이터로 계산한다 — 코호트는 원래 시간축 전체가 필요하다.
function retentionCohorts(allRecipes, cohortCount, horizon) {
    const firstSeen = firstSeenMap(allRecipes);

    // userId → 활동한 주차 집합
    const active = new Map();
    for (const r of allRecipes) {
        if (!r || !r.userId || !r.date) continue;
        const d = new Date(r.date);
        if (isNaN(d)) continue;
        const k = dayKey(weekStart(d));
        if (!active.has(r.userId)) active.set(r.userId, new Set());
        active.get(r.userId).add(k);
    }

    // 코호트 주차 → 멤버 (한 번만 훑는다)
    const byCohort = new Map();
    for (const [uid, t] of firstSeen) {
        const k = dayKey(weekStart(new Date(t)));
        if (!byCohort.has(k)) byCohort.set(k, []);
        byCohort.get(k).push(uid);
    }

    const thisWeek = weekStart(new Date());
    const out = [];
    for (let i = cohortCount - 1; i >= 0; i--) {
        const ws = new Date(thisWeek);
        ws.setDate(ws.getDate() - i * 7);
        const key = dayKey(ws);
        const members = byCohort.get(key) || [];

        const cells = [];
        for (let w = 0; w <= horizon; w++) {
            const target = new Date(ws);
            target.setDate(target.getDate() + w * 7);
            if (target > thisWeek) { cells.push(null); continue; } // 아직 오지 않은 주는 0%가 아니라 빈칸
            const tk = dayKey(target);
            const n = members.filter((u) => active.get(u) && active.get(u).has(tk)).length;
            cells.push({ n, pct: members.length ? n / members.length : 0 });
        }
        out.push({ key, label: shortDate(key), size: members.length, cells });
    }
    return out;
}

// 요일(월=0) × 시간(0~23) 기록 수. 언제 푸시·포스팅할지 정하는 데 쓴다.
// 이건 '기간 내 활동 분포'라 스코프된 기록을 받는 게 맞다.
function hourDowMatrix(recipes) {
    const m = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const r of recipes) {
        const d = new Date(r.date);
        if (isNaN(d)) continue;
        m[(d.getDay() + 6) % 7][d.getHours()] += 1;
    }
    return m;
}

/* ─────────────── 집계 문서에서 뷰 만들기 (Phase 1 경로) ───────────────
 *
 * 전체 스캔 경로의 aggregate()/newUserSeries()/retentionCohorts()/hourDowMatrix()가
 * 만들어내는 것과 **같은 모양**을 stats_daily·users에서 만든다. 그래야 렌더러를
 * 그대로 쓰고 화면 의미도 안 바뀐다.
 *
 * 기간 스코프가 유지되는 건 일별 문서에 uc(사용자별)·bn(원두별) 맵이 있기 때문이다.
 * 이게 없으면 '기간 내 사용자 수'와 퍼널이 생애 기준으로 밀린다.
 */

// 선택 기간에 해당하는 일별 문서 키 목록(오래된 것부터). days=0이면 전체.
function rangeDayKeys(dailyMap, days) {
    if (!days) return [...dailyMap.keys()].sort();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        out.push(dayKey(d));
    }
    return out;
}

function buildViewFromAggregates(a, days) {
    const keys = rangeDayKeys(a.daily, days);
    const get = (k) => a.daily.get(k) || {};
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    const series = keys.map((k) => ({ key: k, count: num(get(k).count) }));
    const total = series.reduce((s, d) => s + d.count, 0);

    let espresso = 0, drip = 0, successCount = 0, ratedTotal = 0;
    const ratingCounts = [0, 0, 0, 0, 0];
    const perUser = new Map();   // 기간 내 사용자별 기록 수 → 사용자 수와 퍼널
    const perBean = new Map();   // 기간 내 원두별 기록 수 → TOP 10
    const hourDow = Array.from({ length: 7 }, () => new Array(24).fill(0));

    for (const k of keys) {
        const d = get(k);
        espresso += num(d.espresso);
        drip += num(d.drip);
        successCount += num(d.successCount);
        ratedTotal += num(d.ratedCount);
        for (let r = 1; r <= 5; r++) ratingCounts[r - 1] += num(d['rating' + r]);

        const dow = (new Date(k + 'T00:00:00').getDay() + 6) % 7;
        for (let h = 0; h < 24; h++) hourDow[dow][h] += num(d['h' + h]);

        for (const [uid, n] of Object.entries(d.uc || {})) {
            perUser.set(uid, (perUser.get(uid) || 0) + num(n));
        }
        for (const [bid, n] of Object.entries(d.bn || {})) {
            perBean.set(bid, (perBean.get(bid) || 0) + num(n));
        }
    }

    const ratingSum = ratingCounts.reduce((s, c, i) => s + c * (i + 1), 0);
    const perUserCounts = [...perUser.values()].filter((n) => n > 0);

    const funnel = [
        { label: '기록 사용자', hint: '1건 이상 저장', min: 1 },
        { label: '재기록', hint: '2건 이상 — 다시 돌아옴', min: 2 },
        { label: '정착', hint: '5건 이상 — 습관화', min: 5 },
        { label: '헤비 유저', hint: '10건 이상', min: 10 },
    ].map((s) => ({ ...s, users: perUserCounts.filter((c) => c >= s.min).length }));

    const beans = [...perBean.entries()]
        .map(([id, count]) => ({ name: a.beanNames.get(id) || '(이름 없음)', count }))
        .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name))
        .slice(0, 10);

    const todayK = dayKey(new Date());

    return {
        total,
        series,
        users: perUserCounts.length,
        today: num(get(todayK).count),
        avgRating: ratedTotal ? ratingSum / ratedTotal : 0,
        ratingCounts,
        ratedTotal,
        espresso,
        drip,
        successCount,
        successRate: total ? successCount / total : 0,
        beans,
        recent: a.recent,
        funnel,
        hourDow,
    };
}

// users 컬렉션의 firstSeenAt으로 신규 유입 시계열. 전체 스캔 경로의
// newUserSeries()와 같은 모양을 돌려준다 — 다만 여기서는 프록시가 아니라 실제 값이다.
function newUserSeriesFromUsers(users, days) {
    const times = users
        .map((u) => new Date(u.firstSeenAt).getTime())
        .filter((t) => Number.isFinite(t));

    const span = days || (() => {
        if (!times.length) return 30;
        return Math.min(365, Math.max(7, Math.ceil((Date.now() - Math.min(...times)) / 864e5) + 1));
    })();

    const byDay = new Map();
    for (let i = span - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        byDay.set(dayKey(d), 0);
    }
    for (const t of times) {
        const k = dayKey(new Date(t));
        if (byDay.has(k)) byDay.set(k, byDay.get(k) + 1);
    }
    return {
        series: [...byDay.entries()].map(([key, count]) => ({ key, count })),
        total: times.filter((t) => byDay.has(dayKey(new Date(t)))).length,
    };
}

// 코호트 — 소속은 users.firstSeenAt으로, 주차별 활동은 stats_daily.uc로 판정한다.
function retentionFromAggregates(a, cohortCount, horizon) {
    const byCohort = new Map();
    for (const u of a.users) {
        const t = new Date(u.firstSeenAt).getTime();
        if (!Number.isFinite(t)) continue;
        const k = dayKey(weekStart(new Date(t)));
        if (!byCohort.has(k)) byCohort.set(k, []);
        byCohort.get(k).push(u.id);
    }

    // uid → 활동한 주차 집합
    const active = new Map();
    for (const [dk, d] of a.daily) {
        const wk = dayKey(weekStart(new Date(dk + 'T00:00:00')));
        for (const [uid, n] of Object.entries(d.uc || {})) {
            if (!Number(n)) continue;
            if (!active.has(uid)) active.set(uid, new Set());
            active.get(uid).add(wk);
        }
    }

    const thisWeek = weekStart(new Date());
    const out = [];
    for (let i = cohortCount - 1; i >= 0; i--) {
        const ws = new Date(thisWeek);
        ws.setDate(ws.getDate() - i * 7);
        const key = dayKey(ws);
        const members = byCohort.get(key) || [];
        const cells = [];
        for (let w = 0; w <= horizon; w++) {
            const target = new Date(ws);
            target.setDate(target.getDate() + w * 7);
            if (target > thisWeek) { cells.push(null); continue; }
            const tk = dayKey(target);
            const n = members.filter((u) => active.get(u) && active.get(u).has(tk)).length;
            cells.push({ n, pct: members.length ? n / members.length : 0 });
        }
        out.push({ key, label: shortDate(key), size: members.length, cells });
    }
    return out;
}

/* ─────────────── Phase 2: 휴면 · 급상승 원두 · 실패율 ───────────────
 *
 * 세 지표 모두 집계 경로와 스캔 폴백 양쪽에서 **같은 모양**을 만들어야 한다.
 * 그래야 규칙 게시 전후로 화면이 달라지지 않는다.
 */

// 마지막 활동 이후 경과일 구간. 리인게이지먼트 대상 규모를 본다.
// 기간 필터와 무관한 '현재 시점 상태'다 — 코호트와 같은 성격.
const DORMANCY_BUCKETS = [
    { label: '활성', hint: '6일 이내', max: 6 },
    { label: '주의', hint: '7–13일', max: 13 },
    { label: '위험', hint: '14–29일', max: 29 },
    { label: '휴면', hint: '30일 이상', max: Infinity },
];

function dormancyFromLastSeen(lastSeenList) {
    const now = Date.now();
    const buckets = DORMANCY_BUCKETS.map((b) => ({ ...b, users: 0 }));
    for (const iso of lastSeenList) {
        const t = new Date(iso).getTime();
        if (!Number.isFinite(t)) continue;
        const days = Math.floor((now - t) / 864e5);
        for (const b of buckets) {
            if (days <= b.max) { b.users += 1; break; }
        }
    }
    return buckets;
}

// 원두별 {기간 내 건수, 직전 동일 기간 건수, 성공 건수}
// days=0(전체)이면 직전 기간이 없으므로 prev는 전부 0이고 급상승 카드는 안내로 대체된다.
function beanStatsFromAggregates(a, days) {
    const cur = new Map(), prev = new Map(), suc = new Map();

    const addTo = (map, obj) => {
        for (const [id, n] of Object.entries(obj || {})) {
            map.set(id, (map.get(id) || 0) + (Number(n) || 0));
        }
    };

    if (!days) {
        for (const d of a.daily.values()) { addTo(cur, d.bn); addTo(suc, d.bs); }
    } else {
        const inRange = (offset) => {
            const keys = [];
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() - i - offset);
                keys.push(dayKey(d));
            }
            return keys;
        };
        for (const k of inRange(0)) {
            const d = a.daily.get(k); if (!d) continue;
            addTo(cur, d.bn); addTo(suc, d.bs);
        }
        for (const k of inRange(days)) {
            const d = a.daily.get(k); if (!d) continue;
            addTo(prev, d.bn);
        }
    }

    return [...cur.entries()].map(([id, count]) => ({
        name: a.beanNames.get(id) || '(이름 없음)',
        count,
        prev: prev.get(id) || 0,
        success: suc.get(id) || 0,
    }));
}

function beanStatsFromScan(allRecipes, days) {
    const key = (r) => (r.beanName || '').trim();
    const now = new Date(); now.setHours(0, 0, 0, 0);

    const from = (offset) => {
        if (!days) return null;
        const f = new Date(now); f.setDate(f.getDate() - (days - 1) - offset);
        const t = new Date(now); t.setDate(t.getDate() + 1 - offset);
        return [f, t];
    };
    const within = (r, span) => {
        if (!span) return true;
        const d = new Date(r.date);
        return !isNaN(d) && d >= span[0] && d < span[1];
    };

    const curSpan = from(0), prevSpan = from(days);
    const cur = new Map(), prev = new Map(), suc = new Map();

    for (const r of allRecipes) {
        const name = key(r);
        if (!name) continue;
        if (within(r, curSpan)) {
            cur.set(name, (cur.get(name) || 0) + 1);
            if (r.success === true) suc.set(name, (suc.get(name) || 0) + 1);
        }
        if (days && within(r, prevSpan)) prev.set(name, (prev.get(name) || 0) + 1);
    }

    return [...cur.entries()].map(([name, count]) => ({
        name, count, prev: prev.get(name) || 0, success: suc.get(name) || 0,
    }));
}

// 급상승 — 직전 기간 대비 증가분 기준. 신규 진입(prev 0)도 포함한다.
function risingBeans(stats, topN) {
    return stats
        .filter((b) => b.count > b.prev)
        .map((b) => ({
            ...b,
            delta: b.count - b.prev,
            // prev가 0이면 증가율이 무한대라 숫자 대신 '신규'로 표시한다
            pct: b.prev ? (b.count - b.prev) / b.prev : null,
        }))
        .sort((x, y) => y.delta - x.delta || y.count - x.count || x.name.localeCompare(y.name))
        .slice(0, topN);
}

// 실패율 — 표본이 적으면 요동친다. 최소 표본 미만은 제외한다.
// 이걸 안 하면 1건 기록해 1건 실패한 원두가 100%로 1위에 올라 목록이 쓸모없어진다.
const FAILURE_MIN_SAMPLE = 5;

function failingBeans(stats, topN) {
    return stats
        .filter((b) => b.count >= FAILURE_MIN_SAMPLE)
        .map((b) => ({ ...b, failed: b.count - b.success, rate: (b.count - b.success) / b.count }))
        .filter((b) => b.failed > 0)
        .sort((x, y) => y.rate - x.rate || y.count - x.count || x.name.localeCompare(y.name))
        .slice(0, topN);
}

/* ────────────────────────── chart: trend ────────────────────────── */

function renderTrend(wrap, series, ariaLabel) {
    clear(wrap);
    const W = Math.max(320, wrap.clientWidth || 640);
    const H = 250;
    const pad = { t: 16, r: 18, b: 30, l: 44 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;

    const max = Math.max(1, ...series.map((d) => d.count));
    const niceMax = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
    const x = (i) => pad.l + (series.length <= 1 ? pw / 2 : (i / (series.length - 1)) * pw);
    const y = (v) => pad.t + ph - (v / niceMax) * ph;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    s.setAttribute('aria-label', ariaLabel || '일별 기록 추이');

    // 하한선 위 격자 — 실선 헤어라인, 뒤로 물러나게
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
        const v = (niceMax / ticks) * i;
        const gy = y(v);
        const line = svg('line', { x1: pad.l, x2: W - pad.r, y1: gy, y2: gy, 'stroke-width': 1 });
        line.style.stroke = i === 0 ? cssVar('--axis') : cssVar('--grid');
        s.appendChild(line);

        const t = svg('text', { x: pad.l - 10, y: gy + 4, 'text-anchor': 'end', 'font-size': 11 });
        t.style.fill = cssVar('--muted');
        t.style.fontVariantNumeric = 'tabular-nums';
        t.textContent = fmt(Math.round(v));
        s.appendChild(t);
    }

    // 면적: 시리즈 색 10% 워시
    const areaPts = series.map((d, i) => `${x(i)},${y(d.count)}`).join(' ');
    const area = svg('polygon', {
        points: `${pad.l},${pad.t + ph} ${areaPts} ${x(series.length - 1)},${pad.t + ph}`,
    });
    area.style.fill = cssVar('--series-1');
    area.style.opacity = '0.1';
    s.appendChild(area);

    // 선: 2px, 둥근 조인
    const line = svg('polyline', {
        points: areaPts, fill: 'none', 'stroke-width': 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    });
    line.style.stroke = cssVar('--series-1');
    s.appendChild(line);

    // 끝점 마커 — 표면색 2px 링
    const last = series.length - 1;
    if (last >= 0) {
        const ring = svg('circle', { cx: x(last), cy: y(series[last].count), r: 6.5 });
        ring.style.fill = cssVar('--surface');
        s.appendChild(ring);
        const dot = svg('circle', { cx: x(last), cy: y(series[last].count), r: 4.5 });
        dot.style.fill = cssVar('--series-1');
        s.appendChild(dot);

        // 직접 라벨은 선별적으로 — 끝점 하나만
        const lbl = svg('text', {
            x: x(last), y: y(series[last].count) - 13,
            'text-anchor': 'end', 'font-size': 12, 'font-weight': 600,
        });
        lbl.style.fill = cssVar('--ink');
        lbl.textContent = fmt(series[last].count);
        s.appendChild(lbl);
    }

    // x축 라벨 — 처음/중간/끝만
    const marks = series.length > 1 ? [0, Math.floor(last / 2), last] : [0];
    for (const i of new Set(marks)) {
        const t = svg('text', {
            x: x(i), y: H - 8, 'font-size': 11,
            'text-anchor': i === 0 ? 'start' : i === last ? 'end' : 'middle',
        });
        t.style.fill = cssVar('--muted');
        t.textContent = shortDate(series[i].key);
        s.appendChild(t);
    }

    // 크로스헤어 — 독자는 2px 선이 아니라 날짜를 겨냥한다
    const cross = svg('line', {
        y1: pad.t, y2: pad.t + ph, 'stroke-width': 1, opacity: 0,
    });
    cross.style.stroke = cssVar('--axis');
    s.appendChild(cross);
    const hover = svg('circle', { r: 4.5, opacity: 0 });
    hover.style.fill = cssVar('--series-1');
    s.appendChild(hover);

    const hit = svg('rect', {
        x: pad.l, y: pad.t, width: pw, height: ph, fill: 'transparent',
    });
    hit.style.cursor = 'crosshair';
    s.appendChild(hit);

    wrap.appendChild(s);

    const tip = document.createElement('div');
    tip.className = 'tip';
    wrap.appendChild(tip);

    const show = (i, clientX) => {
        const d = series[i];
        cross.setAttribute('x1', x(i));
        cross.setAttribute('x2', x(i));
        cross.setAttribute('opacity', 1);
        hover.setAttribute('cx', x(i));
        hover.setAttribute('cy', y(d.count));
        hover.setAttribute('opacity', 1);

        clear(tip);
        const head = document.createElement('div');
        head.className = 'tip-head';
        head.textContent = shortDate(d.key);
        tip.appendChild(head);

        const row = document.createElement('div');
        row.className = 'tip-row';
        const key = document.createElement('span');
        key.className = 'tip-key';
        key.style.background = cssVar('--series-1');
        const val = document.createElement('span');
        val.className = 'tip-val';
        val.textContent = fmt(d.count);
        const name = document.createElement('span');
        name.className = 'tip-name';
        name.textContent = '건';
        row.append(key, val, name);
        tip.appendChild(row);

        tip.classList.add('on');
        const wrapBox = wrap.getBoundingClientRect();
        const px = clientX != null ? clientX - wrapBox.left : x(i) * (wrapBox.width / W);
        tip.style.left = Math.min(Math.max(8, px + 14), wrapBox.width - tip.offsetWidth - 8) + 'px';
        tip.style.top = Math.max(4, y(d.count) * (wrapBox.height / H) - 12) + 'px';
    };

    const hide = () => {
        cross.setAttribute('opacity', 0);
        hover.setAttribute('opacity', 0);
        tip.classList.remove('on');
    };

    const nearest = (clientX) => {
        const box = s.getBoundingClientRect();
        const rel = ((clientX - box.left) / box.width) * W;
        const ratio = (rel - pad.l) / pw;
        return Math.max(0, Math.min(series.length - 1, Math.round(ratio * (series.length - 1))));
    };

    hit.addEventListener('pointermove', (e) => show(nearest(e.clientX), e.clientX));
    hit.addEventListener('pointerleave', hide);

    // 키보드로도 같은 정보에 닿을 수 있어야 한다
    s.setAttribute('tabindex', '0');
    let focusIdx = last;
    s.addEventListener('focus', () => show(focusIdx));
    s.addEventListener('blur', hide);
    s.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        focusIdx = Math.max(0, Math.min(series.length - 1, focusIdx + (e.key === 'ArrowRight' ? 1 : -1)));
        show(focusIdx);
    });
}

/* ────────────────────────── chart: sparkline ────────────────────────── */

function renderSpark(wrap, series) {
    clear(wrap);
    const pts = series.slice(-12);
    if (pts.length < 2) return;
    const W = 168, H = 46, pad = 5;
    const max = Math.max(1, ...pts.map((d) => d.count));
    const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
    const y = (v) => H - pad - (v / max) * (H - pad * 2);

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' });
    const line = svg('polyline', {
        points: pts.map((d, i) => `${x(i)},${y(d.count)}`).join(' '),
        fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    });
    line.style.stroke = cssVar('--muted');
    line.style.opacity = '0.5';
    s.appendChild(line);

    // 마지막 구간만 강조색
    const tailPts = pts.slice(-2).map((d, i) => `${x(pts.length - 2 + i)},${y(d.count)}`).join(' ');
    const tail = svg('polyline', {
        points: tailPts, fill: 'none', 'stroke-width': 2, 'stroke-linecap': 'round',
    });
    tail.style.stroke = cssVar('--series-1');
    s.appendChild(tail);

    const ring = svg('circle', { cx: x(pts.length - 1), cy: y(pts[pts.length - 1].count), r: 5 });
    ring.style.fill = cssVar('--surface');
    s.appendChild(ring);
    const dot = svg('circle', { cx: x(pts.length - 1), cy: y(pts[pts.length - 1].count), r: 3.5 });
    dot.style.fill = cssVar('--series-1');
    s.appendChild(dot);

    wrap.appendChild(s);
}

/* ────────────────────────── chart: mode split ────────────────────────── */

function renderModeSplit(wrap, legendBox, espresso, drip) {
    clear(wrap);
    clear(legendBox);

    const total = espresso + drip;
    const items = [
        { name: '에스프레소', value: espresso, color: '--series-1' },
        { name: '핸드드립', value: drip, color: '--series-2' },
    ];

    // 시리즈가 둘 이상이면 범례는 항상 있다
    for (const it of items) {
        const wrapEl = document.createElement('span');
        wrapEl.className = 'legend-item';
        const key = document.createElement('span');
        key.className = 'legend-key';
        key.style.background = cssVar(it.color);
        const label = document.createElement('span');
        label.textContent = `${it.name} ${total ? Math.round((it.value / total) * 100) : 0}%`;
        wrapEl.append(key, label);
        legendBox.appendChild(wrapEl);
    }

    if (!total) {
        const p = document.createElement('p');
        p.className = 'card-sub';
        p.textContent = '이 기간에는 기록이 없습니다.';
        wrap.appendChild(p);
        return;
    }

    const W = Math.max(280, wrap.clientWidth || 420);
    const BAR = 24;            // 막대는 24px를 넘지 않는다
    const H = BAR + 34;
    const GAP = 2;             // 세그먼트를 가르는 건 표면색 2px 틈
    const R = 4;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    s.setAttribute('aria-label', '추출 모드 분포');

    const usable = W - GAP;
    let cursor = 0;
    const tip = document.createElement('div');
    tip.className = 'tip';

    items.forEach((it, idx) => {
        const w = (it.value / total) * usable;
        if (w <= 0) return;
        const isFirst = idx === 0;
        const x0 = cursor + (isFirst ? 0 : GAP);
        // 바깥쪽 끝만 둥글게, 맞닿는 쪽은 각지게
        const path = isFirst
            ? `M${x0 + R},0 H${x0 + w} V${BAR} H${x0 + R} A${R},${R} 0 0 1 ${x0},${BAR - R} V${R} A${R},${R} 0 0 1 ${x0 + R},0 Z`
            : `M${x0},0 H${x0 + w - R} A${R},${R} 0 0 1 ${x0 + w},${R} V${BAR - R} A${R},${R} 0 0 1 ${x0 + w - R},${BAR} H${x0} Z`;
        const seg = svg('path', { d: path });
        seg.style.fill = cssVar(it.color);
        seg.style.cursor = 'pointer';
        s.appendChild(seg);

        // 라벨은 여유를 두고 들어갈 때만 안에 — 잘릴 바엔 넣지 않는다
        const text = `${fmt(it.value)}건`;
        if (w > text.length * 8 + 20) {
            const t = svg('text', {
                x: x0 + w / 2, y: BAR / 2 + 4, 'text-anchor': 'middle',
                'font-size': 12, 'font-weight': 600,
            });
            t.style.fill = '#FFFFFF';   // 채워진 면 위 라벨은 명도로 대비를 맞춘다
            t.textContent = text;
            s.appendChild(t);
        }

        const cap = svg('text', { x: x0 + w / 2, y: BAR + 22, 'text-anchor': 'middle', 'font-size': 11.5 });
        cap.style.fill = cssVar('--muted');
        cap.textContent = `${Math.round((it.value / total) * 100)}%`;
        s.appendChild(cap);

        seg.addEventListener('pointerenter', () => {
            clear(tip);
            const head = document.createElement('div');
            head.className = 'tip-head';
            head.textContent = it.name;
            const row = document.createElement('div');
            row.className = 'tip-row';
            const key = document.createElement('span');
            key.className = 'tip-key';
            key.style.background = cssVar(it.color);
            const val = document.createElement('span');
            val.className = 'tip-val';
            val.textContent = fmt(it.value) + '건';
            row.append(key, val);
            tip.append(head, row);
            tip.classList.add('on');
            tip.style.left = Math.min(x0 + w / 2, W - 130) + 'px';
            tip.style.top = '-6px';
        });
        seg.addEventListener('pointerleave', () => tip.classList.remove('on'));

        cursor = x0 + w;
    });

    wrap.appendChild(s);
    wrap.appendChild(tip);
}

/* ────────────────────────── chart: rating distribution ────────────────────────── */

function renderRatings(wrap, counts) {
    clear(wrap);
    const W = Math.max(280, wrap.clientWidth || 420);
    const H = 230;
    const pad = { t: 22, r: 8, b: 34, l: 34 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;
    const max = Math.max(1, ...counts);
    const band = pw / counts.length;
    const BAR = Math.min(24, band - 14);   // 슬롯을 다 채우지 않는다 — 남는 건 공기
    const R = 4;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    s.setAttribute('aria-label', '평점 분포');

    // 기준선
    const base = svg('line', { x1: pad.l, x2: W - pad.r, y1: pad.t + ph, y2: pad.t + ph, 'stroke-width': 1 });
    base.style.stroke = cssVar('--axis');
    s.appendChild(base);

    const tip = document.createElement('div');
    tip.className = 'tip';

    counts.forEach((c, i) => {
        const h = (c / max) * ph;
        const cx = pad.l + band * i + band / 2;
        const x0 = cx - BAR / 2;
        const y0 = pad.t + ph - h;

        if (h > 0) {
            // 데이터 끝은 4px 둥글게, 기준선 쪽은 각지게
            const rr = Math.min(R, h);
            const path = `M${x0},${pad.t + ph} V${y0 + rr} A${rr},${rr} 0 0 1 ${x0 + rr},${y0} H${x0 + BAR - rr} A${rr},${rr} 0 0 1 ${x0 + BAR},${y0 + rr} V${pad.t + ph} Z`;
            const bar = svg('path', { d: path });
            bar.style.fill = cssVar(`--ord-${i + 1}`);
            s.appendChild(bar);
        }

        // 값은 캡 위에
        const v = svg('text', { x: cx, y: Math.max(pad.t - 6, y0 - 8), 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600 });
        v.style.fill = cssVar('--ink');
        v.textContent = fmt(c);
        s.appendChild(v);

        const lb = svg('text', { x: cx, y: H - 12, 'text-anchor': 'middle', 'font-size': 12 });
        lb.style.fill = cssVar('--muted');
        lb.textContent = '★'.repeat(i + 1);
        s.appendChild(lb);

        // 히트 영역은 마크보다 넉넉하게
        const hit = svg('rect', { x: pad.l + band * i, y: pad.t, width: band, height: ph, fill: 'transparent' });
        hit.style.cursor = 'pointer';
        hit.addEventListener('pointerenter', () => {
            clear(tip);
            const head = document.createElement('div');
            head.className = 'tip-head';
            head.textContent = `${i + 1}점`;
            const row = document.createElement('div');
            row.className = 'tip-row';
            const key = document.createElement('span');
            key.className = 'tip-key';
            key.style.background = cssVar(`--ord-${i + 1}`);
            const val = document.createElement('span');
            val.className = 'tip-val';
            val.textContent = fmt(c) + '건';
            row.append(key, val);
            tip.append(head, row);
            tip.classList.add('on');
            tip.style.left = Math.min(cx, W - 130) + 'px';
            tip.style.top = '0px';
        });
        hit.addEventListener('pointerleave', () => tip.classList.remove('on'));
        s.appendChild(hit);
    });

    wrap.appendChild(s);
    wrap.appendChild(tip);
}

/* ────────────────────────── chart: top beans ────────────────────────── */

function renderBeans(wrap, beans) {
    clear(wrap);
    if (!beans.length) {
        const p = document.createElement('p');
        p.className = 'card-sub';
        p.textContent = '원두 이름이 입력된 기록이 아직 없습니다.';
        wrap.appendChild(p);
        return;
    }

    const W = Math.max(320, wrap.clientWidth || 640);
    const labelW = Math.min(210, Math.max(120, W * 0.3));
    const valueW = 52;
    const BAR = 18;
    const ROW = 32;
    const H = beans.length * ROW + 10;
    const pw = W - labelW - valueW - 12;
    const max = Math.max(1, ...beans.map((b) => b.count));
    const R = 4;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    s.setAttribute('aria-label', '많이 기록된 원두');

    const tip = document.createElement('div');
    tip.className = 'tip';

    beans.forEach((b, i) => {
        const cy = i * ROW + ROW / 2;
        const w = Math.max(2, (b.count / max) * pw);
        const y0 = cy - BAR / 2;

        const name = svg('text', { x: labelW - 12, y: cy + 4, 'text-anchor': 'end', 'font-size': 12.5 });
        name.style.fill = cssVar('--ink-2');
        // 사용자 입력이므로 textContent로만 넣는다
        name.textContent = b.name.length > 22 ? b.name.slice(0, 21) + '…' : b.name;
        const title = svg('title');
        title.textContent = b.name;
        name.appendChild(title);
        s.appendChild(name);

        // 명목형이라 전부 같은 색 — 길이가 이미 크기를 말한다
        const rr = Math.min(R, w);
        const path = `M${labelW},${y0} H${labelW + w - rr} A${rr},${rr} 0 0 1 ${labelW + w},${y0 + rr} V${y0 + BAR - rr} A${rr},${rr} 0 0 1 ${labelW + w - rr},${y0 + BAR} H${labelW} Z`;
        const bar = svg('path', { d: path });
        bar.style.fill = cssVar('--series-1');
        s.appendChild(bar);

        // 값은 막대 끝 바깥에 — 안에 넣으면 짧은 막대에서 잘린다
        const v = svg('text', { x: labelW + w + 10, y: cy + 4, 'font-size': 12, 'font-weight': 600 });
        v.style.fill = cssVar('--ink');
        v.style.fontVariantNumeric = 'tabular-nums';
        v.textContent = fmt(b.count);
        s.appendChild(v);

        const hit = svg('rect', { x: labelW, y: cy - ROW / 2, width: pw + valueW, height: ROW, fill: 'transparent' });
        hit.style.cursor = 'pointer';
        hit.addEventListener('pointerenter', () => {
            clear(tip);
            const head = document.createElement('div');
            head.className = 'tip-head';
            head.textContent = b.name;
            const row = document.createElement('div');
            row.className = 'tip-row';
            const key = document.createElement('span');
            key.className = 'tip-key';
            key.style.background = cssVar('--series-1');
            const val = document.createElement('span');
            val.className = 'tip-val';
            val.textContent = fmt(b.count) + '건';
            row.append(key, val);
            tip.append(head, row);
            tip.classList.add('on');
            tip.style.left = Math.min(labelW + 10, W - 160) + 'px';
            tip.style.top = Math.max(0, cy - 44) + 'px';
        });
        hit.addEventListener('pointerleave', () => tip.classList.remove('on'));
        s.appendChild(hit);
    });

    wrap.appendChild(s);
    wrap.appendChild(tip);
}

/* ──────────────────── chart: 활성화·유지 퍼널 ──────────────────── */

function renderFunnel(wrap, funnel) {
    clear(wrap);
    const top = funnel[0] ? funnel[0].users : 0;
    if (!top) {
        const p = document.createElement('p');
        p.className = 'card-sub';
        p.textContent = '기록을 남긴 사용자가 아직 없습니다.';
        wrap.appendChild(p);
        return;
    }

    const W = Math.max(320, wrap.clientWidth || 640);
    const labelW = Math.min(150, Math.max(96, W * 0.24));
    const valueW = 96;
    const BAR = 26;
    const ROW = 52;
    const H = funnel.length * ROW + 8;
    const pw = W - labelW - valueW - 12;
    const R = 5;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    s.setAttribute('aria-label', '활성화·유지 퍼널 — 사용자별 기록 깊이');

    const tip = document.createElement('div');
    tip.className = 'tip';

    funnel.forEach((stage, i) => {
        const cy = i * ROW + ROW / 2;
        // 막대 길이는 최상단(기록 사용자) 대비 비율 — 100%에서 좁아지는 퍼널
        const share = stage.users / top;
        const w = Math.max(2, share * pw);
        const y0 = cy - BAR / 2;
        const pctTop = Math.round(share * 100);
        // 직전 단계 대비 전환율 — 어디서 사람이 빠지는지
        const prev = i > 0 ? funnel[i - 1].users : stage.users;
        const stepPct = prev ? Math.round((stage.users / prev) * 100) : 100;

        const name = svg('text', { x: labelW - 12, y: cy - 1, 'text-anchor': 'end', 'font-size': 12.5 });
        name.style.fill = cssVar('--ink-2');
        name.textContent = stage.label;
        s.appendChild(name);

        const sub = svg('text', { x: labelW - 12, y: cy + 14, 'text-anchor': 'end', 'font-size': 10.5 });
        sub.style.fill = cssVar('--muted');
        sub.textContent = stage.hint;
        s.appendChild(sub);

        const rr = Math.min(R, w);
        const path = `M${labelW},${y0} H${labelW + w - rr} A${rr},${rr} 0 0 1 ${labelW + w},${y0 + rr} V${y0 + BAR - rr} A${rr},${rr} 0 0 1 ${labelW + w - rr},${y0 + BAR} H${labelW} Z`;
        const bar = svg('path', { d: path });
        bar.style.fill = cssVar('--series-1');
        // 단계가 깊어질수록 옅게 — 좁아지는 퍼널의 시각적 신호
        bar.style.opacity = (1 - i * 0.16).toFixed(2);
        s.appendChild(bar);

        // 값: 사용자 수 + 최상단 대비 %
        const v = svg('text', { x: labelW + w + 10, y: cy - 1, 'font-size': 12.5, 'font-weight': 600 });
        v.style.fill = cssVar('--ink');
        v.style.fontVariantNumeric = 'tabular-nums';
        v.textContent = `${fmt(stage.users)}명 · ${pctTop}%`;
        s.appendChild(v);

        // 직전 단계 대비 전환(첫 단계 제외) — 이탈 지점 판독
        if (i > 0) {
            const step = svg('text', { x: labelW + w + 10, y: cy + 14, 'font-size': 10.5 });
            step.style.fill = cssVar('--muted');
            step.style.fontVariantNumeric = 'tabular-nums';
            step.textContent = `직전 대비 ${stepPct}%`;
            s.appendChild(step);
        }

        const hit = svg('rect', { x: 0, y: cy - ROW / 2, width: W, height: ROW, fill: 'transparent' });
        hit.style.cursor = 'pointer';
        hit.addEventListener('pointerenter', () => {
            clear(tip);
            const head = document.createElement('div');
            head.className = 'tip-head';
            head.textContent = stage.label;
            const row = document.createElement('div');
            row.className = 'tip-row';
            const key = document.createElement('span');
            key.className = 'tip-key';
            key.style.background = cssVar('--series-1');
            const val = document.createElement('span');
            val.className = 'tip-val';
            val.textContent = `${fmt(stage.users)}명 (전체의 ${pctTop}%${i > 0 ? `, 직전 대비 ${stepPct}%` : ''})`;
            row.append(key, val);
            tip.append(head, row);
            tip.classList.add('on');
            tip.style.left = Math.min(labelW + 10, W - 200) + 'px';
            tip.style.top = Math.max(0, cy - 46) + 'px';
        });
        hit.addEventListener('pointerleave', () => tip.classList.remove('on'));
        s.appendChild(hit);
    });

    wrap.appendChild(s);
    wrap.appendChild(tip);
}

/* ──────────────────── chart: 주간 리텐션 코호트 ──────────────────── */

function renderRetention(wrap, cohorts, horizon) {
    clear(wrap);
    const withMembers = cohorts.filter((c) => c.size > 0);
    if (!withMembers.length) {
        const p = document.createElement('p');
        p.className = 'card-sub';
        p.textContent = '아직 코호트를 만들 만큼 데이터가 쌓이지 않았습니다.';
        wrap.appendChild(p);
        return;
    }

    const scroll = document.createElement('div');
    scroll.className = 'scroll-x';
    const t = document.createElement('table');
    t.className = 'cohort';

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    ['시작 주', '유입'].concat(
        Array.from({ length: horizon + 1 }, (_, i) => `W${i}`)
    ).forEach((label) => {
        const th = document.createElement('th');
        th.textContent = label;
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);

    const tbody = document.createElement('tbody');
    withMembers.forEach((c) => {
        const tr = document.createElement('tr');

        const tdWeek = document.createElement('td');
        tdWeek.textContent = c.label;
        tr.appendChild(tdWeek);

        const tdSize = document.createElement('td');
        tdSize.className = 'num';
        tdSize.textContent = fmt(c.size) + '명';
        tr.appendChild(tdSize);

        c.cells.forEach((cell) => {
            const td = document.createElement('td');
            td.className = 'num cohort-cell';
            if (!cell) {                      // 아직 오지 않은 주 — 0%가 아니라 빈칸
                td.textContent = '';
                td.classList.add('cohort-future');
            } else {
                const pct = Math.round(cell.pct * 100);
                td.textContent = pct + '%';
                // 순차 램프: 잔존율이 높을수록 진하게. 값이 이미 크기를 말하므로 채도만 쓴다.
                td.style.background = `color-mix(in srgb, var(--series-1) ${Math.round(cell.pct * 62)}%, transparent)`;
                td.title = `${fmt(cell.n)}명 / ${fmt(c.size)}명`;
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    scroll.appendChild(t);
    wrap.appendChild(scroll);
}

/* ─────────── chart: 범용 수평 막대 (Phase 2 카드 3장 공용) ───────────
 * renderBeans의 규약(labelW · BAR · ROW · tip)을 그대로 따르되, 라벨 아래 보조
 * 설명과 막대별 색을 받을 수 있게 일반화했다. 카드마다 차트 함수를 새로 만들면
 * 규약이 조금씩 어긋나므로 하나로 묶는다.
 *
 * items: { label, sub, value, valueText, color, tip }
 */
function renderHBars(wrap, items, opts) {
    const o = opts || {};
    clear(wrap);
    if (!items.length) {
        const p = document.createElement('p');
        p.className = 'card-sub';
        p.textContent = o.emptyText || '표시할 데이터가 없습니다.';
        wrap.appendChild(p);
        return;
    }

    const W = Math.max(320, wrap.clientWidth || 640);
    const labelW = Math.min(200, Math.max(112, W * 0.28));
    const valueW = o.valueW || 96;
    const BAR = 18, ROW = o.sub ? 42 : 32, R = 4;
    const H = items.length * ROW + 10;
    const pw = W - labelW - valueW - 12;
    const max = Math.max(1, ...items.map((d) => d.value));

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    s.setAttribute('aria-label', o.ariaLabel || '');

    const tip = document.createElement('div');
    tip.className = 'tip';

    items.forEach((d, i) => {
        const cy = i * ROW + ROW / 2;
        const w = Math.max(2, (d.value / max) * pw);
        const y0 = cy - BAR / 2;
        const color = d.color || cssVar('--series-1');

        const name = svg('text', {
            x: labelW - 12, y: d.sub ? cy - 1 : cy + 4,
            'text-anchor': 'end', 'font-size': 12.5,
        });
        name.style.fill = cssVar('--ink-2');
        name.textContent = d.label.length > 22 ? d.label.slice(0, 21) + '…' : d.label;
        const title = svg('title');
        title.textContent = d.label;
        name.appendChild(title);
        s.appendChild(name);

        if (d.sub) {
            const sub = svg('text', { x: labelW - 12, y: cy + 13, 'text-anchor': 'end', 'font-size': 10.5 });
            sub.style.fill = cssVar('--muted');
            sub.textContent = d.sub;
            s.appendChild(sub);
        }

        const rr = Math.min(R, w);
        const path = `M${labelW},${y0} H${labelW + w - rr} A${rr},${rr} 0 0 1 ${labelW + w},${y0 + rr} V${y0 + BAR - rr} A${rr},${rr} 0 0 1 ${labelW + w - rr},${y0 + BAR} H${labelW} Z`;
        const bar = svg('path', { d: path });
        bar.style.fill = color;
        s.appendChild(bar);

        const v = svg('text', { x: labelW + w + 10, y: cy + 4, 'font-size': 12, 'font-weight': 600 });
        v.style.fill = cssVar('--ink');
        v.style.fontVariantNumeric = 'tabular-nums';
        v.textContent = d.valueText;
        s.appendChild(v);

        const hit = svg('rect', { x: 0, y: cy - ROW / 2, width: W, height: ROW, fill: 'transparent' });
        hit.style.cursor = 'pointer';
        hit.addEventListener('pointerenter', () => {
            clear(tip);
            const head = document.createElement('div');
            head.className = 'tip-head';
            head.textContent = d.label;
            const row = document.createElement('div');
            row.className = 'tip-row';
            const k = document.createElement('span');
            k.className = 'tip-key';
            k.style.background = color;
            const val = document.createElement('span');
            val.className = 'tip-val';
            val.textContent = d.tip || d.valueText;
            row.append(k, val);
            tip.append(head, row);
            tip.classList.add('on');
            tip.style.left = Math.min(labelW + 10, W - 190) + 'px';
            tip.style.top = Math.max(0, cy - 44) + 'px';
        });
        hit.addEventListener('pointerleave', () => tip.classList.remove('on'));
        s.appendChild(hit);
    });

    wrap.appendChild(s);
    wrap.appendChild(tip);
}

/* ──────────────── chart: 요일 × 시간대 활동 히트맵 ──────────────── */

const DOW_KO = ['월', '화', '수', '목', '금', '토', '일'];

function renderHeatmap(wrap, matrix) {
    clear(wrap);
    const max = Math.max(0, ...matrix.flat());
    if (!max) {
        const p = document.createElement('p');
        p.className = 'card-sub';
        p.textContent = '표시할 기록이 없습니다.';
        wrap.appendChild(p);
        return;
    }

    const CELL = 22, GAP = 2, LABEL_W = 26, TOP_H = 16;
    const W = LABEL_W + 24 * (CELL + GAP);
    const H = TOP_H + 7 * (CELL + GAP) + 4;

    const scroll = document.createElement('div');
    scroll.className = 'scroll-x';
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    s.setAttribute('aria-label', '요일과 시간대별 기록 분포');

    // 시간 눈금 — 3시간 간격만 적어 라벨이 뭉개지지 않게
    for (let h = 0; h < 24; h += 3) {
        const tx = svg('text', {
            x: LABEL_W + h * (CELL + GAP) + CELL / 2, y: TOP_H - 5,
            'text-anchor': 'middle', 'font-size': 9.5,
        });
        tx.style.fill = cssVar('--muted');
        tx.style.fontVariantNumeric = 'tabular-nums';
        tx.textContent = h;
        s.appendChild(tx);
    }

    const tip = document.createElement('div');
    tip.className = 'tip';

    matrix.forEach((row, dow) => {
        const ty = svg('text', {
            x: LABEL_W - 8, y: TOP_H + dow * (CELL + GAP) + CELL / 2 + 3.5,
            'text-anchor': 'end', 'font-size': 10.5,
        });
        ty.style.fill = cssVar('--ink-2');
        ty.textContent = DOW_KO[dow];
        s.appendChild(ty);

        row.forEach((n, h) => {
            const x = LABEL_W + h * (CELL + GAP);
            const y = TOP_H + dow * (CELL + GAP);
            const rect = svg('rect', { x, y, width: CELL, height: CELL, rx: 3 });
            // 0은 격자만 남겨 '데이터 없음'과 '적음'을 구분한다
            rect.style.fill = n === 0
                ? cssVar('--grid')
                : `color-mix(in srgb, var(--series-1) ${Math.round((n / max) * 88) + 12}%, transparent)`;
            rect.style.cursor = 'pointer';
            rect.addEventListener('pointerenter', () => {
                clear(tip);
                const head = document.createElement('div');
                head.className = 'tip-head';
                head.textContent = `${DOW_KO[dow]} ${String(h).padStart(2, '0')}시`;
                const r2 = document.createElement('div');
                r2.className = 'tip-row';
                const k = document.createElement('span');
                k.className = 'tip-key';
                k.style.background = cssVar('--series-1');
                const v = document.createElement('span');
                v.className = 'tip-val';
                v.textContent = fmt(n) + '건';
                r2.append(k, v);
                tip.append(head, r2);
                tip.classList.add('on');
                tip.style.left = Math.min(x, W - 150) + 'px';
                tip.style.top = Math.max(0, y - 44) + 'px';
            });
            rect.addEventListener('pointerleave', () => tip.classList.remove('on'));
            s.appendChild(rect);
        });
    });

    scroll.appendChild(s);
    wrap.appendChild(scroll);
    wrap.appendChild(tip);
}

/* ────────────────────────── table views ────────────────────────── */

function buildTable(cols, rows) {
    const scroll = document.createElement('div');
    scroll.className = 'scroll-x';
    const t = document.createElement('table');

    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    cols.forEach((c) => {
        const th = document.createElement('th');
        if (c.num) th.className = 'num';
        th.textContent = c.label;
        htr.appendChild(th);
    });
    thead.appendChild(htr);
    t.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((r) => {
        const tr = document.createElement('tr');
        cols.forEach((c) => {
            const td = document.createElement('td');
            if (c.num) td.className = 'num';
            if (c.render) td.appendChild(c.render(r[c.key]));
            else td.textContent = r[c.key] == null ? '—' : String(r[c.key]);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    t.appendChild(tbody);

    scroll.appendChild(t);
    return scroll;
}

/* ─────────────────── 사용자 목록 · 드릴다운 ───────────────────
 *
 * 목록은 기간 필터와 무관한 '누적 로스터'다(휴면 카드와 같은 현재 시점 관점).
 * 집계 경로면 users 컬렉션에서, 폴백/데모면 recipes를 사용자별로 묶어 만든다.
 * 행을 누르면 그 사용자의 개인 지표 + 레시피 이력을 모달로 연다.
 */

const shortUid = (u) => (u && u.length > 12 ? u.slice(0, 10) + '…' : (u || '—'));
const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : dayKey(d).replace(/-/g, '.');
};
const agoText = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const days = Math.floor((Date.now() - d.getTime()) / 864e5);
    return days <= 0 ? '오늘' : `${fmt(days)}일 전`;
};
const numTd = (txt) => { const td = document.createElement('td'); td.className = 'num'; td.textContent = txt; return td; };
const txtTd = (txt) => { const td = document.createElement('td'); td.textContent = txt; return td; };

function userRows() {
    if (dataMode === 'aggregate' && agg) {
        return agg.users.map((u) => ({
            uid: u.id,
            name: u.displayName || '',
            email: u.email || '',
            count: Number(u.recipeCount) || 0,
            first: u.firstSeenAt || null,
            last: u.lastSeenAt || null,
        }));
    }
    // 스캔/데모: recipes를 사용자별로 묶는다 (이름/이메일은 없다 — uid로 표시)
    const m = new Map();
    for (const r of allRecipes) {
        if (!r.userId) continue;
        const e = m.get(r.userId) || { uid: r.userId, name: '', email: '', count: 0, first: r.date, last: r.date };
        e.count += 1;
        if (r.date) {
            if (!e.first || new Date(r.date) < new Date(e.first)) e.first = r.date;
            if (!e.last || new Date(r.date) > new Date(e.last)) e.last = r.date;
        }
        m.set(r.userId, e);
    }
    return [...m.values()];
}

function sortedUserRows() {
    const rows = userRows();
    const lastT = (r) => (r.last ? new Date(r.last).getTime() : 0);
    if (userSort === 'recent') rows.sort((a, b) => lastT(b) - lastT(a) || b.count - a.count);
    else rows.sort((a, b) => b.count - a.count || lastT(b) - lastT(a));
    return rows;
}

function renderUsers(wrap, rows) {
    clear(wrap);
    el('users-sub').textContent = rows.length
        ? `전체 ${fmt(rows.length)}명 · 누적 기준(기간 필터와 무관) · 행을 눌러 상세 보기`
        : '아직 기록을 남긴 사용자가 없습니다.';
    if (!rows.length) return;

    const scroll = document.createElement('div');
    scroll.className = 'scroll-x';
    const t = document.createElement('table');

    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    [['사용자', ''], ['기록', 'num'], ['첫 기록', ''], ['마지막', ''], ['경과', 'num'], ['', 'num']]
        .forEach(([label, cls]) => {
            const th = document.createElement('th');
            if (cls) th.className = cls;
            th.textContent = label;
            htr.appendChild(th);
        });
    thead.appendChild(htr);
    t.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = 'user-row';
        tr.tabIndex = 0;
        tr.setAttribute('role', 'button');
        const open = () => openUserDetail(row);
        tr.addEventListener('click', open);
        tr.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });

        const tdU = document.createElement('td');
        const nameEl = document.createElement('div');
        nameEl.className = 'user-name';
        nameEl.textContent = row.name || row.email || '익명 사용자';
        const subEl = document.createElement('div');
        subEl.className = 'user-uid';
        // 이름이 있으면 아래에 이메일을, 없으면 uid를 병기해 서로 구분되게 한다
        subEl.textContent = (row.email && row.name) ? row.email : shortUid(row.uid);
        tdU.appendChild(nameEl);
        tdU.appendChild(subEl);
        tr.appendChild(tdU);

        tr.appendChild(numTd(fmt(row.count)));
        tr.appendChild(txtTd(fmtDate(row.first)));
        tr.appendChild(txtTd(fmtDate(row.last)));
        tr.appendChild(numTd(agoText(row.last)));
        const cta = numTd('›');
        cta.classList.add('user-cta');
        tr.appendChild(cta);

        tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    scroll.appendChild(t);
    wrap.appendChild(scroll);
}

// 스캔/데모엔 이미 전체 레시피가 있으니 거기서 거른다(추가 조회 없음).
// 집계 경로에서만 그 사용자 것만 라이브로 읽는다 — 단일 필드 조건이라 인덱스 불필요.
async function loadUserRecipes(uid) {
    if (allRecipes.length) {
        return allRecipes.filter((r) => r.userId === uid)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    if (!fbRef) return [];
    const snap = await fbRef.getDocs(fbRef.query(
        fbRef.collection(fbRef.db, 'recipes'),
        fbRef.where('userId', '==', uid)
    ));
    const out = [];
    snap.forEach((d) => {
        const data = d.data();
        delete data.imageUrl;   // 받은 뒤 버린다 — 상세엔 사진을 쓰지 않는다
        out.push({ id: d.id, ...data });
    });
    return out.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function openUserDetail(row) {
    const modal = el('user-modal');
    el('um-title').textContent = row.name || row.email || '익명 사용자';
    el('um-sub').textContent = [
        (row.email && row.name) ? row.email : null,
        'UID ' + row.uid,
    ].filter(Boolean).join(' · ');

    const body = el('um-body');
    clear(body);
    const loading = document.createElement('p');
    loading.className = 'modal-empty';
    loading.textContent = '기록을 불러오는 중…';
    body.appendChild(loading);
    modal.classList.remove('hidden');
    el('um-close').focus();

    let recipes;
    try {
        recipes = await loadUserRecipes(row.uid);
    } catch (e) {
        clear(body);
        const p = document.createElement('p');
        p.className = 'modal-empty';
        p.textContent = `기록을 불러오지 못했습니다 (${e.code || e.message}).`;
        body.appendChild(p);
        return;
    }
    renderUserDetail(body, recipes);
}

function renderUserDetail(body, recipes) {
    clear(body);
    const total = recipes.length;
    const rated = recipes.filter((r) => {
        const n = Number(r.overallRating);
        return Number.isFinite(n) && n >= 1 && n <= 5;
    });
    const avg = rated.length ? rated.reduce((s, r) => s + Number(r.overallRating), 0) / rated.length : 0;
    const successCount = recipes.filter((r) => r.success === true).length;
    const espresso = recipes.filter((r) => r.mode === 'espresso').length;
    const drip = total - espresso;
    const beanCount = new Map();
    recipes.forEach((r) => {
        const b = (r.beanName || '').trim();
        if (b) beanCount.set(b, (beanCount.get(b) || 0) + 1);
    });
    const topBean = [...beanCount.entries()].sort((a, b) => b[1] - a[1])[0];

    const stats = document.createElement('div');
    stats.className = 'modal-stats';
    const tile = (label, value, sub) => {
        const d = document.createElement('div');
        d.className = 'tile';
        const l = document.createElement('div'); l.className = 'tile-label'; l.textContent = label;
        const v = document.createElement('div'); v.className = 'tile-value'; v.textContent = value;
        d.appendChild(l); d.appendChild(v);
        if (sub) { const s = document.createElement('div'); s.className = 'tile-sub'; s.textContent = sub; d.appendChild(s); }
        return d;
    };
    stats.appendChild(tile('총 기록', fmt(total)));
    stats.appendChild(tile('평균 평점', rated.length ? avg.toFixed(2) : '—', rated.length ? `${fmt(rated.length)}건 평가` : '평가 없음'));
    stats.appendChild(tile('성공률', total ? Math.round((successCount / total) * 100) + '%' : '—', `${fmt(successCount)}/${fmt(total)}건`));
    stats.appendChild(tile('에스프레소 비중', total ? Math.round((espresso / total) * 100) + '%' : '—', `ES ${fmt(espresso)} · 드립 ${fmt(drip)}`));
    body.appendChild(stats);

    if (total) {
        const meta = document.createElement('p');
        meta.className = 'card-sub';
        meta.textContent = `${fmtDate(recipes[recipes.length - 1].date)} ~ ${fmtDate(recipes[0].date)}`
            + (topBean ? ` · 자주 쓴 원두 ${topBean[0]} (${fmt(topBean[1])}건)` : '');
        body.appendChild(meta);
    }

    const title = document.createElement('div');
    title.className = 'modal-section-title';
    title.textContent = `레시피 이력 (${fmt(total)}건)`;
    body.appendChild(title);

    if (!total) {
        const p = document.createElement('p');
        p.className = 'modal-empty';
        p.textContent = '이 사용자의 클라우드 레시피가 없습니다.';
        body.appendChild(p);
        return;
    }

    body.appendChild(buildTable(
        [
            { key: 'd', label: '날짜' }, { key: 'b', label: '원두' }, { key: 'm', label: '모드' },
            { key: 'do', label: '도징', num: true }, { key: 'tp', label: '온도', num: true },
            { key: 'ti', label: '시간', num: true }, { key: 'y', label: '수율', num: true },
            { key: 'r', label: '평점', num: true },
            {
                key: 's', label: '결과',
                render: (ok) => {
                    const chip = document.createElement('span');
                    chip.className = 'chip ' + (ok ? 'chip-good' : 'chip-bad');
                    chip.textContent = ok ? '성공' : '실패';
                    return chip;
                },
            },
        ],
        recipes.map((r) => {
            const d = new Date(r.date);
            return {
                d: isNaN(d) ? '—' : `${dayKey(d).slice(5)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                b: r.beanName || '—',
                m: r.mode === 'espresso' ? '에스프레소' : '핸드드립',
                do: r.dosing != null ? r.dosing + 'g' : '—',
                tp: r.temp != null ? r.temp + '°C' : '—',
                ti: r.time != null ? r.time + 's' : '—',
                y: r.yield != null ? r.yield + 'g' : '—',
                r: r.overallRating != null ? r.overallRating : '—',
                s: r.success === true,
            };
        })
    ));
}

function closeUserModal() {
    el('user-modal').classList.add('hidden');
    clear(el('um-body'));
}

/* ─────────────────── 리드 (이메일 수집) ───────────────────
 *
 * 취향 검사 결과의 옵트인이 leads 컬렉션에 쌓는다(landing.js). 여기선 관리자만
 * 읽어 목록으로 보여주고 CSV로 내보낸다. 발송 백엔드는 없다 — 리스트만 모은다.
 */

const SOURCE_KO = { quiz: '취향 검사' };

async function loadLeads(fb) {
    try {
        const snap = await fb.getDocs(fb.collection(fb.db, 'leads'));
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } catch (e) {
        // 규칙에 leads가 없거나 권한이 없다 → 카드만 비운다(대시보드는 정상).
        console.warn('[Leads] 리드를 읽지 못했습니다 (규칙에 leads가 있는지 확인).', e);
        return [];
    }
}

function renderLeads(wrap, rows) {
    clear(wrap);
    el('leads-sub').textContent = rows.length
        ? `총 ${fmt(rows.length)}명 · 취향 검사 결과에서 이메일을 남긴 방문자`
        : '아직 수집된 이메일이 없습니다. (취향 검사 결과 화면의 옵트인으로 쌓입니다)';
    el('leads-export').disabled = !rows.length;
    if (!rows.length) return;

    wrap.appendChild(buildTable(
        [
            { key: 'email', label: '이메일' },
            { key: 'src', label: '출처' },
            { key: 'when', label: '수집일' },
        ],
        rows.map((r) => ({
            email: r.email || '—',
            src: (SOURCE_KO[r.source] || r.source || '—') + (r.profileTitle ? ` · ${r.profileTitle}` : ''),
            when: fmtDate(r.createdAt),
        }))
    ));
}

function exportLeadsCsv(rows) {
    if (!rows.length) return;
    const cols = ['email', 'source', 'profile', 'profileTitle', 'createdAt'];
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [cols.join(',')]
        .concat(rows.map((r) => cols.map((k) => esc(r[k])).join(',')))
        .join('\r\n');
    // 앞의 BOM은 엑셀이 UTF-8 한글을 깨지 않게 한다.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${dayKey(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// 데모용 가짜 리드 — 시드 고정이라 새로고침해도 같은 화면.
function makeDemoLeads() {
    const rnd = mulberry32(20260728);
    const titles = ['화사한 향미 탐험가', '밸런스의 클래식', '고소한 위로 한 잔', '묵직한 바디 애호가'];
    const profs = ['A', 'B', 'C', 'D'];
    const out = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
        const p = Math.floor(rnd() * 4);
        out.push({
            id: 'demo-lead-' + i,
            email: `taster${String(i + 1).padStart(2, '0')}@example.com`,
            source: 'quiz',
            profile: profs[p],
            profileTitle: titles[p],
            createdAt: new Date(Date.now() - Math.floor(rnd() * 60) * 864e5).toISOString(),
        });
    }
    return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/* ─────────────────── 사이트 방문 (stats_visits) ───────────────────
 *
 * 기록을 남기지 않고 떠난 방문자까지 잡는 유일한 카드다. 개인은 식별하지 않는다 —
 * 익명 카운터일 뿐이고, 누가 왔는지는 애초에 저장하지 않는다(firebase-config.js).
 *
 * visitors는 '브라우저·하루당 1회'라 순 방문자의 근사치다. 시크릿 모드·캐시 삭제·
 * 다른 기기는 새로 센다. sessions는 세션당 1회다.
 */

const PAGE_KO = { landing: '랜딩', app: '기록 화면', logbook: '로그북' };

async function loadVisits(fb) {
    try {
        const snap = await fb.getDocs(fb.collection(fb.db, 'stats_visits'));
        const m = new Map();
        snap.forEach((d) => m.set(d.id, d.data()));
        return m;
    } catch (e) {
        // 규칙에 stats_visits가 없거나 권한이 없다 → 카드만 비운다.
        console.warn('[Visits] 방문 집계를 읽지 못했습니다 (규칙 확인).', e);
        return new Map();
    }
}

function visitView(map, days) {
    const keys = rangeDayKeys(map, days);
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const series = keys.map((k) => ({ key: k, count: num((map.get(k) || {}).visitors) }));
    let visitors = 0, sessions = 0;
    const pages = new Map();
    for (const k of keys) {
        const d = map.get(k) || {};
        visitors += num(d.visitors);
        sessions += num(d.sessions);
        for (const [field, v] of Object.entries(d)) {
            if (field.startsWith('p_')) {
                const p = field.slice(2);
                pages.set(p, (pages.get(p) || 0) + num(v));
            }
        }
    }
    return {
        series,
        visitors,
        sessions,
        rows: keys.map((k) => {
            const d = map.get(k) || {};
            return { k, visitors: num(d.visitors), sessions: num(d.sessions) };
        }),
        pages: [...pages.entries()].sort((a, b) => b[1] - a[1]),
    };
}

// 데모용 방문 — 시드 고정. 기록 수보다 훨씬 많아야 '대부분은 그냥 떠난다'가 보인다.
function makeDemoVisits() {
    const rnd = mulberry32(20260729);
    const m = new Map();
    for (let i = 89; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const weekend = [0, 6].includes(d.getDay()) ? 1.4 : 1;
        const visitors = Math.round((14 + rnd() * 26) * weekend * (1 + (89 - i) / 160));
        const sessions = visitors + Math.round(rnd() * visitors * 0.5);
        const landing = Math.round(sessions * (0.62 + rnd() * 0.1));
        const app = Math.round((sessions - landing) * (0.7 + rnd() * 0.2));
        m.set(dayKey(d), {
            visitors, sessions,
            p_landing: landing,
            p_app: app,
            p_logbook: Math.max(0, sessions - landing - app),
        });
    }
    return m;
}

/* ────────────────────────── render ────────────────────────── */

function render() {
    // 집계 경로가 살아 있으면 그걸 쓰고, 아니면 예전 전체 스캔 경로로 떨어진다.
    // 두 경로가 같은 모양을 돌려주므로 아래 렌더 코드는 출처를 몰라도 된다.
    const useAgg = dataMode === 'aggregate' && agg;
    const scoped = useAgg ? null : sliceByRange(allRecipes, rangeDays);
    const a = useAgg ? buildViewFromAggregates(agg, rangeDays) : aggregate(scoped, rangeDays);
    const label = rangeDays ? `최근 ${rangeDays}일` : '전체 기간';

    el('hero-label').textContent = `${label} 기록된 레시피`;
    el('hero-value').textContent = compact(a.total);
    el('hero-note').textContent = a.users
        ? `${fmt(a.users)}명이 기록 · 1인당 평균 ${(a.total / a.users).toFixed(1)}건`
        : '아직 기록이 없습니다.';
    renderSpark(el('hero-spark'), a.series);

    el('kpi-users').textContent = fmt(a.users);
    el('kpi-users-sub').textContent = `${label} 내 기록을 남긴 계정`;

    el('kpi-today').textContent = fmt(a.today);
    el('kpi-today-sub').textContent = '오늘 저장된 레시피';

    el('kpi-rating').textContent = a.ratedTotal ? a.avgRating.toFixed(2) : '—';
    el('kpi-rating-sub').textContent = a.ratedTotal ? `${fmt(a.ratedTotal)}건 기준 (5점 만점)` : '평점 데이터 없음';

    el('kpi-success').textContent = a.total ? Math.round(a.successRate * 100) + '%' : '—';
    el('kpi-success-sub').textContent = a.total ? `${fmt(a.successCount)}건 성공 / ${fmt(a.total)}건` : '데이터 없음';

    // 성공률 미터 — 채움은 시리즈 색, 트랙은 같은 램프의 옅은 단계
    const successTile = el('kpi-success').parentElement;
    let meter = successTile.querySelector('.meter-track');
    if (!meter) {
        meter = document.createElement('div');
        meter.className = 'meter-track';
        const fill = document.createElement('div');
        fill.className = 'meter-fill';
        meter.appendChild(fill);
        successTile.insertBefore(meter, el('kpi-success-sub'));
    }
    meter.firstChild.style.width = Math.round(a.successRate * 100) + '%';

    // 사이트 방문 — 기록을 남기지 않고 떠난 사람까지 포함하는 유일한 카드다.
    const v = visitView(visits, rangeDays);
    // 방문 → 기록 전환. 분모(브라우저)와 분자(계정)의 모집단이 달라 정확한 비율은
    // 아니지만, 방향을 보는 데는 이게 유일한 단서다. 그래서 '약'이라고 못박는다.
    const convText = v.visitors && a.users
        ? ` · 이 중 약 ${Math.round((a.users / v.visitors) * 100)}%가 기록으로 이어짐`
        : '';
    el('visits-sub').textContent = v.visitors || v.sessions
        ? `${label} · 방문자 ${fmt(v.visitors)}명 · 세션 ${fmt(v.sessions)}회`
            + (v.pages.length ? ` · ${v.pages.map(([p, n]) => `${PAGE_KO[p] || p} ${fmt(n)}`).join(' · ')}` : '')
            + convText
        : '아직 방문 집계가 없습니다. (배포 후 방문이 쌓이면 표시됩니다)';
    renderTrend(el('visits-wrap'), v.series, '일별 방문자 추이');

    el('trend-sub').textContent = `${label} · 하루에 저장된 레시피 수`;
    renderTrend(el('trend-wrap'), a.series);
    renderModeSplit(el('mode-wrap'), el('mode-legend'), a.espresso, a.drip);
    renderRatings(el('rating-wrap'), a.ratingCounts);
    renderBeans(el('beans-wrap'), a.beans);

    el('funnel-sub').textContent = `${label} · 기록을 남긴 사용자가 얼마나 정착하는가`;
    renderFunnel(el('funnel-wrap'), a.funnel);

    // 사용자 목록 — 누적 로스터라 기간과 무관하지만, 렌더 흐름상 여기서 함께 그린다.
    renderUsers(el('users-wrap'), sortedUserRows());
    // 리드 — 누적. 부팅 때 한 번 읽어둔 leads를 그린다.
    renderLeads(el('leads-wrap'), leads);

    // ── 마케팅 지표 ──
    // 신규 유입·리텐션은 **allRecipes**(전체)로 계산한다. scoped를 넘기면 기간 밖에서
    // 시작한 사용자가 신규로 잡혀 유입이 부풀려진다.
    const nu = useAgg
        ? newUserSeriesFromUsers(agg.users, rangeDays)
        : newUserSeries(allRecipes, rangeDays);
    el('newusers-sub').textContent = `${label} · 처음 기록을 남긴 사용자 ${fmt(nu.total)}명`;
    renderTrend(el('newusers-wrap'), nu.series, '일별 신규 사용자 추이');

    const RETENTION_HORIZON = 4;
    const cohorts = useAgg
        ? retentionFromAggregates(agg, 6, RETENTION_HORIZON)
        : retentionCohorts(allRecipes, 6, RETENTION_HORIZON);
    renderRetention(el('retention-wrap'), cohorts, RETENTION_HORIZON);

    const heat = useAgg ? a.hourDow : hourDowMatrix(scoped);
    el('heatmap-sub').textContent = `${label} · 기록이 저장된 요일과 시각`;
    renderHeatmap(el('heatmap-wrap'), heat);

    // ── Phase 2 — 행동으로 이어지는 카드들 ──

    // 휴면: 기간 필터와 무관한 '현재 시점' 상태다. 마지막 활동 시각만 있으면 된다.
    const lastSeen = useAgg
        ? agg.users.map((u) => u.lastSeenAt).filter(Boolean)
        : [...allRecipes.reduce((m, r) => {
            if (!r.userId || !r.date) return m;
            const prev = m.get(r.userId);
            if (!prev || new Date(r.date) > new Date(prev)) m.set(r.userId, r.date);
            return m;
        }, new Map()).values()];
    const dormancy = dormancyFromLastSeen(lastSeen);
    const dormancyTotal = dormancy.reduce((s, b) => s + b.users, 0);
    el('dormancy-sub').textContent = dormancyTotal
        ? `현재 시점 · 전체 ${fmt(dormancyTotal)}명 기준 (기간 필터와 무관)`
        : '아직 사용자가 없습니다.';
    // 좋음 → 나쁨 순서. 상태색은 액센트(--series-1)와 별개 체계다.
    const DORMANCY_COLORS = ['--good', '--series-1', '--warn', '--danger'];
    renderHBars(el('dormancy-wrap'), dormancy.map((b, i) => ({
        label: b.label,
        sub: b.hint,
        value: b.users,
        valueText: `${fmt(b.users)}명 · ${dormancyTotal ? Math.round((b.users / dormancyTotal) * 100) : 0}%`,
        color: cssVar(DORMANCY_COLORS[i]),
        tip: `${fmt(b.users)}명 (마지막 기록 ${b.hint})`,
    })), { ariaLabel: '마지막 활동 이후 경과일 분포', sub: true, valueW: 108 });

    // 원두 인사이트 — 급상승과 실패율은 같은 통계에서 나온다.
    const beanStats = useAgg
        ? beanStatsFromAggregates(agg, rangeDays)
        : beanStatsFromScan(allRecipes, rangeDays);

    const rising = rangeDays ? risingBeans(beanStats, 8) : [];
    el('rising-sub').textContent = rangeDays
        ? `${label} vs 직전 ${rangeDays}일 · 증가폭이 큰 순서`
        : '전체 기간에는 비교할 직전 구간이 없습니다. 7·30·90일을 선택하세요.';
    renderHBars(el('rising-wrap'), rising.map((b) => ({
        label: b.name,
        sub: b.prev ? `직전 ${fmt(b.prev)}건 → ${fmt(b.count)}건` : '직전 기간에 없던 원두',
        value: b.delta,
        valueText: b.pct === null ? `+${fmt(b.delta)} · 신규` : `+${fmt(b.delta)} · ${Math.round(b.pct * 100)}%`,
        tip: `${fmt(b.prev)}건 → ${fmt(b.count)}건 (증가 ${fmt(b.delta)})`,
    })), {
        ariaLabel: '급상승 원두',
        sub: true,
        valueW: 116,
        emptyText: rangeDays ? '직전 기간보다 늘어난 원두가 없습니다.' : '기간을 선택하면 비교합니다.',
    });

    const failing = failingBeans(beanStats, 8);
    el('failing-sub').textContent =
        `${label} · 표본 ${FAILURE_MIN_SAMPLE}건 이상인 원두만 (표본이 적으면 비율이 요동칩니다)`;
    renderHBars(el('failing-wrap'), failing.map((b) => ({
        label: b.name,
        sub: `실패 ${fmt(b.failed)} / 총 ${fmt(b.count)}건`,
        value: b.rate,
        valueText: Math.round(b.rate * 100) + '%',
        color: cssVar('--danger'),
        tip: `실패율 ${Math.round(b.rate * 100)}% (${fmt(b.failed)}/${fmt(b.count)}건)`,
    })), {
        ariaLabel: '실패율이 높은 원두',
        sub: true,
        emptyText: `표본 ${FAILURE_MIN_SAMPLE}건 이상이면서 실패가 있는 원두가 없습니다.`,
    });

    // 표 뷰 — 모든 차트는 표로도 읽을 수 있어야 한다
    clear(el('tv-visits'));
    el('tv-visits').appendChild(buildTable(
        [
            { key: 'd', label: '날짜' },
            { key: 'v', label: '방문자', num: true },
            { key: 's', label: '세션', num: true },
        ],
        v.rows.map((r) => ({ d: r.k, v: fmt(r.visitors), s: fmt(r.sessions) }))
    ));

    clear(el('tv-trend'));
    el('tv-trend').appendChild(buildTable(
        [{ key: 'd', label: '날짜' }, { key: 'c', label: '기록 수', num: true }],
        a.series.map((s) => ({ d: s.key, c: fmt(s.count) }))
    ));

    clear(el('tv-mode'));
    const modeTotal = a.espresso + a.drip;
    el('tv-mode').appendChild(buildTable(
        [{ key: 'm', label: '모드' }, { key: 'c', label: '기록 수', num: true }, { key: 'p', label: '비중', num: true }],
        [
            { m: '에스프레소', c: fmt(a.espresso), p: (modeTotal ? Math.round((a.espresso / modeTotal) * 100) : 0) + '%' },
            { m: '핸드드립', c: fmt(a.drip), p: (modeTotal ? Math.round((a.drip / modeTotal) * 100) : 0) + '%' },
        ]
    ));

    clear(el('tv-rating'));
    el('tv-rating').appendChild(buildTable(
        [{ key: 'r', label: '평점' }, { key: 'c', label: '기록 수', num: true }],
        a.ratingCounts.map((c, i) => ({ r: `${i + 1}점`, c: fmt(c) }))
    ));

    clear(el('tv-beans'));
    el('tv-beans').appendChild(buildTable(
        [{ key: 'n', label: '원두' }, { key: 'c', label: '기록 수', num: true }],
        a.beans.map((b) => ({ n: b.name, c: fmt(b.count) }))
    ));

    clear(el('tv-newusers'));
    el('tv-newusers').appendChild(buildTable(
        [{ key: 'd', label: '날짜' }, { key: 'c', label: '신규 사용자', num: true }],
        nu.series.map((s) => ({ d: s.key, c: fmt(s.count) }))
    ));

    clear(el('tv-retention'));
    el('tv-retention').appendChild(buildTable(
        [{ key: 'w', label: '시작 주' }, { key: 'n', label: '유입', num: true }].concat(
            Array.from({ length: RETENTION_HORIZON + 1 }, (_, i) => ({ key: 'w' + i, label: `W${i}`, num: true }))
        ),
        cohorts.filter((c) => c.size > 0).map((c) => {
            const row = { w: c.label, n: fmt(c.size) };
            c.cells.forEach((cell, i) => {
                row['w' + i] = cell ? Math.round(cell.pct * 100) + '%' : '—';
            });
            return row;
        })
    ));

    clear(el('tv-heatmap'));
    el('tv-heatmap').appendChild(buildTable(
        [{ key: 'd', label: '요일' }].concat(
            Array.from({ length: 24 }, (_, h) => ({ key: 'h' + h, label: String(h), num: true }))
        ),
        heat.map((row, dow) => {
            const o = { d: DOW_KO[dow] };
            row.forEach((n, h) => { o['h' + h] = fmt(n); });
            return o;
        })
    ));

    clear(el('tv-dormancy'));
    el('tv-dormancy').appendChild(buildTable(
        [{ key: 's', label: '상태' }, { key: 'u', label: '사용자', num: true }, { key: 'p', label: '비중', num: true }],
        dormancy.map((b) => ({
            s: `${b.label} (${b.hint})`,
            u: fmt(b.users),
            p: (dormancyTotal ? Math.round((b.users / dormancyTotal) * 100) : 0) + '%',
        }))
    ));

    clear(el('tv-rising'));
    el('tv-rising').appendChild(buildTable(
        [
            { key: 'n', label: '원두' }, { key: 'p', label: '직전', num: true },
            { key: 'c', label: '현재', num: true }, { key: 'd', label: '증가', num: true },
            { key: 'r', label: '증가율', num: true },
        ],
        rising.map((b) => ({
            n: b.name, p: fmt(b.prev), c: fmt(b.count),
            d: '+' + fmt(b.delta), r: b.pct === null ? '신규' : Math.round(b.pct * 100) + '%',
        }))
    ));

    clear(el('tv-failing'));
    el('tv-failing').appendChild(buildTable(
        [
            { key: 'n', label: '원두' }, { key: 'f', label: '실패', num: true },
            { key: 't', label: '총 기록', num: true }, { key: 'r', label: '실패율', num: true },
        ],
        failing.map((b) => ({
            n: b.name, f: fmt(b.failed), t: fmt(b.count), r: Math.round(b.rate * 100) + '%',
        }))
    ));

    clear(el('tv-funnel'));
    const funnelTop = a.funnel[0] ? a.funnel[0].users : 0;
    el('tv-funnel').appendChild(buildTable(
        [
            { key: 's', label: '단계' }, { key: 'u', label: '사용자', num: true },
            { key: 'pt', label: '전체 대비', num: true }, { key: 'sp', label: '직전 대비', num: true },
        ],
        a.funnel.map((stage, i) => ({
            s: `${stage.label} (${stage.hint})`,
            u: fmt(stage.users),
            pt: (funnelTop ? Math.round((stage.users / funnelTop) * 100) : 0) + '%',
            sp: i === 0
                ? '—'
                : (a.funnel[i - 1].users ? Math.round((stage.users / a.funnel[i - 1].users) * 100) : 0) + '%',
        }))
    ));

    // 최근 기록
    clear(el('recent-wrap'));
    el('recent-wrap').appendChild(buildTable(
        [
            { key: 'd', label: '날짜' }, { key: 'b', label: '원두' }, { key: 'm', label: '모드' },
            { key: 'do', label: '도징', num: true }, { key: 'tp', label: '온도', num: true },
            { key: 'ti', label: '시간', num: true }, { key: 'y', label: '수율', num: true },
            { key: 'r', label: '평점', num: true },
            {
                key: 's', label: '결과',
                // 상태는 색만으로 말하지 않는다 — 칩 안에 항상 글자가 같이 있다
                render: (ok) => {
                    const chip = document.createElement('span');
                    chip.className = 'chip ' + (ok ? 'chip-good' : 'chip-bad');
                    chip.textContent = ok ? '성공' : '실패';
                    return chip;
                },
            },
        ],
        a.recent.map((r) => {
            const d = new Date(r.date);
            return {
                d: `${dayKey(d).slice(5)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                b: (r.beanName || '—'),
                m: r.mode === 'espresso' ? '에스프레소' : '핸드드립',
                do: r.dosing != null ? r.dosing + 'g' : '—',
                tp: r.temp != null ? r.temp + '°C' : '—',
                ti: r.time != null ? r.time + 's' : '—',
                y: r.yield != null ? r.yield + 'g' : '—',
                r: r.overallRating != null ? r.overallRating : '—',
                s: r.success === true,
            };
        })
    ));

    // 어떤 경로로 읽었는지는 숫자를 해석할 때 중요하다 — 반드시 표기한다.
    el('foot').textContent = isDemo
        ? '데모 데이터 · 실제 Firestore를 조회하지 않았습니다.'
        : useAgg
            ? `집계 문서(stats_daily ${fmt(agg.daily.size)}일 · users ${fmt(agg.users.length)}명)를 읽었습니다. recipes 전체는 내려받지 않습니다.`
            : `Firestore recipes 컬렉션 전체 ${fmt(allRecipes.length)}건을 불러와 브라우저에서 집계했습니다. 집계 문서가 준비되면 이 전체 조회는 사라집니다.`;
}

/* ──────────────────── 데이터 로딩 (Phase 1) ────────────────────
 *
 * 집계 문서를 먼저 시도하고, 없거나 권한이 없으면 예전 전체 스캔으로 떨어진다.
 * 이 폴백 덕분에 보안 규칙 게시나 백필 전에도 대시보드가 그대로 뜬다.
 */

// 예전 경로. recipes를 통째로 받는다 — 사진(base64)까지 딸려와 무겁다.
async function loadAllRecipes(fb) {
    const snap = await fb.getDocs(fb.collection(fb.db, 'recipes'));
    const out = [];
    snap.forEach((d) => {
        const data = d.data();
        // 받은 뒤 버릴 뿐 전송은 이미 끝났다 — 클라이언트 SDK엔 필드 선택이 없다.
        delete data.imageUrl;
        out.push({ id: d.id, ...data });
    });
    return out;
}

// 집계 경로. 셋 다 작은 문서라 합쳐도 수십 KB 수준이다.
// 집계가 비어 있으면(=아직 백필 전) null을 돌려 폴백을 유도한다.
async function loadAggregates(fb) {
    try {
        const [dailySnap, usersSnap, beansSnap, recentSnap] = await Promise.all([
            fb.getDocs(fb.collection(fb.db, 'stats_daily')),
            fb.getDocs(fb.collection(fb.db, 'users')),
            fb.getDocs(fb.collection(fb.db, 'stats_beans')),
            fb.getDocs(fb.query(
                fb.collection(fb.db, 'recipes'), fb.orderBy('date', 'desc'), fb.limit(20)
            )),
        ]);

        if (dailySnap.empty || usersSnap.empty) return null;   // 아직 집계가 없다

        const daily = new Map();
        dailySnap.forEach((d) => daily.set(d.id, d.data()));

        const users = [];
        usersSnap.forEach((d) => users.push({ id: d.id, ...d.data() }));

        const beanNames = new Map();
        beansSnap.forEach((d) => beanNames.set(d.id, (d.data() || {}).name || ''));

        const recent = [];
        recentSnap.forEach((d) => {
            const data = d.data();
            delete data.imageUrl;
            recent.push({ id: d.id, ...data });
        });

        return { daily, users, beanNames, recent };
    } catch (e) {
        // 권한이 없거나 컬렉션이 없다 → 폴백. 대시보드를 막지는 않는다.
        console.warn('[Stats] 집계를 읽지 못해 전체 스캔으로 대체합니다.', e);
        return null;
    }
}

/**
 * 집계 재생성(백필). recipes를 한 번 전부 읽어 stats_daily·users·stats_beans를
 * 처음부터 다시 만든다. 과거 데이터 이관과 정합성 복구를 겸한다 —
 * 삭제 중 집계 갱신이 실패해 원본과 어긋났을 때 되돌리는 수단이기도 하다.
 *
 * 평소 경로에서는 절대 부르지 않는다. 이 버튼을 누를 때만 전체를 읽는다.
 */
async function rebuildAggregates(fb, onProgress) {
    const recipes = await loadAllRecipes(fb);
    onProgress(`기록 ${fmt(recipes.length)}건을 읽었습니다. 집계를 계산합니다…`);

    const daily = new Map();
    const users = new Map();
    const beans = new Map();

    const beanId = (name) => {
        let h = 0x811c9dc5;
        for (let i = 0; i < name.length; i++) {
            h ^= name.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return 'b' + h.toString(36);
    };

    for (const r of recipes) {
        const d = new Date(r.date);
        if (isNaN(d) || !r.userId) continue;
        const k = dayKey(d);
        if (!daily.has(k)) daily.set(k, {
            count: 0, espresso: 0, drip: 0, successCount: 0, es: 0, ds: 0,
            ratedCount: 0, uc: {}, bn: {}, bs: {},
        });
        const day = daily.get(k);

        const isEspresso = r.mode === 'espresso';
        day.count += 1;
        if (isEspresso) day.espresso += 1; else day.drip += 1;
        day['h' + d.getHours()] = (day['h' + d.getHours()] || 0) + 1;
        // 필드 구성은 storage.js의 bumpAggregates와 반드시 같아야 한다 —
        // 어긋나면 실시간 집계와 백필 결과가 달라진다.
        if (r.success === true) {
            day.successCount += 1;
            if (isEspresso) day.es += 1; else day.ds += 1;
        }
        const rating = Number(r.overallRating);
        if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
            day.ratedCount += 1;
            day['rating' + rating] = (day['rating' + rating] || 0) + 1;
        }
        day.uc[r.userId] = (day.uc[r.userId] || 0) + 1;

        const bean = (r.beanName || '').trim();
        if (bean) {
            const id = beanId(bean);
            day.bn[id] = (day.bn[id] || 0) + 1;
            if (r.success === true) day.bs[id] = (day.bs[id] || 0) + 1;
            beans.set(id, bean);
        }

        const u = users.get(r.userId) || { firstSeenAt: r.date, lastSeenAt: r.date, recipeCount: 0 };
        u.recipeCount += 1;
        if (new Date(r.date) < new Date(u.firstSeenAt)) u.firstSeenAt = r.date;
        if (new Date(r.date) > new Date(u.lastSeenAt)) u.lastSeenAt = r.date;
        users.set(r.userId, u);
    }

    // merge:false로 덮어써야 이전 잘못된 값이 남지 않는다(정합성 복구가 목적이므로).
    let written = 0;
    const total = daily.size + users.size + beans.size;
    for (const [k, v] of daily) {
        await fb.setDoc(fb.doc(fb.db, 'stats_daily', k), v);
        onProgress(`집계 기록 중… ${fmt(++written)}/${fmt(total)}`);
    }
    for (const [uid, v] of users) {
        await fb.setDoc(fb.doc(fb.db, 'users', uid), v, { merge: true });
        onProgress(`집계 기록 중… ${fmt(++written)}/${fmt(total)}`);
    }
    for (const [id, name] of beans) {
        await fb.setDoc(fb.doc(fb.db, 'stats_beans', id), { name });
        onProgress(`집계 기록 중… ${fmt(++written)}/${fmt(total)}`);
    }
    return { recipes: recipes.length, days: daily.size, users: users.size, beans: beans.size };
}

/* ────────────────────────── wiring ────────────────────────── */

function wireUI() {
    el('range-seg').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-days]');
        if (!btn) return;
        [...el('range-seg').querySelectorAll('button')].forEach((b) =>
            b.setAttribute('aria-pressed', String(b === btn))
        );
        rangeDays = Number(btn.dataset.days);
        render();
    });

    document.querySelectorAll('.card-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
            // 같은 스타일을 쓰지만 표 토글이 아닌 버튼(집계 재생성)이 섞여 있다.
            if (!btn.dataset.tv) return;
            const tv = el(btn.dataset.tv);
            const chart = tv.previousElementSibling;
            const showTable = !tv.classList.contains('on');
            tv.classList.toggle('on', showTable);
            chart.classList.toggle('off', showTable);
            btn.textContent = showTable ? '차트로 보기' : '표로 보기';
        });
    });

    // ── 사용자 목록 정렬 토글 + 상세 모달 닫기 ──
    const sortBtn = el('users-sort');
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            userSort = userSort === 'count' ? 'recent' : 'count';
            sortBtn.textContent = userSort === 'count' ? '기록순' : '최근순';
            renderUsers(el('users-wrap'), sortedUserRows());
        });
    }
    const modal = el('user-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-close]')) closeUserModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeUserModal();
        });
    }

    // 리드 CSV 내보내기
    const leadsExport = el('leads-export');
    if (leadsExport) leadsExport.addEventListener('click', () => exportLeadsCsv(leads));

    // ── 집계 재생성 ──
    // 평소 경로에서 사라진 '전체 읽기'를 여기서만 의도적으로 한 번 수행한다.
    const btnRebuild = el('btn-rebuild');
    if (btnRebuild) {
        btnRebuild.addEventListener('click', async () => {
            const status = el('rebuild-status');
            if (isDemo || !fbRef) {
                status.textContent = '데모 모드에서는 집계를 재생성할 수 없습니다.';
                return;
            }
            btnRebuild.disabled = true;
            const original = btnRebuild.textContent;
            btnRebuild.textContent = '재생성 중…';
            try {
                const r = await rebuildAggregates(fbRef, (msg) => { status.textContent = msg; });
                status.textContent =
                    `완료 — 기록 ${fmt(r.recipes)}건에서 일별 ${fmt(r.days)}일 · 사용자 ${fmt(r.users)}명 · 원두 ${fmt(r.beans)}종을 만들었습니다. 새로고침하면 집계 경로로 열립니다.`;
                // 방금 만든 집계로 즉시 갈아탄다 — 새로고침을 기다릴 필요가 없다.
                agg = await loadAggregates(fbRef);
                if (agg) { dataMode = 'aggregate'; allRecipes = []; render(); }
            } catch (e) {
                console.error('집계 재생성 실패', e);
                status.textContent =
                    `재생성에 실패했습니다 (${e.code || e.message}). 보안 규칙에서 stats_daily·users·stats_beans 쓰기를 관리자에게 허용해야 합니다.`;
            } finally {
                btnRebuild.disabled = false;
                btnRebuild.textContent = original;
            }
        });
    }

    let t;
    window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(render, 160);
    });
}

function showDash() {
    el('gate').classList.add('hidden');
    el('dash').classList.remove('hidden');
    wireUI();
    render();
}

function showGate(title, msg, node) {
    el('dash').classList.add('hidden');
    el('gate').classList.remove('hidden');
    el('gate-title').textContent = title;
    el('gate-msg').textContent = msg;
    if (node) el('gate-msg').appendChild(node);
}

/* ────────────────────────── boot ────────────────────────── */

if (isDemo) {
    allRecipes = makeDemoRecipes();
    leads = makeDemoLeads();
    visits = makeDemoVisits();
    el('demo-banner').classList.remove('hidden');
    el('who').textContent = '데모 모드';
    el('btn-logout').classList.add('hidden');
    showDash();
} else {
    el('gate').classList.remove('hidden');

    import('./firebase-config.js')
        .then((fb) => {
            fbRef = fb;
            el('btn-login').addEventListener('click', async () => {
                try {
                    await fb.signInWithPopup(fb.auth, fb.googleProvider);
                } catch (err) {
                    if (err.code !== 'auth/popup-closed-by-user') {
                        el('gate-err').textContent = '로그인 실패: ' + err.message;
                        el('gate-err').classList.remove('hidden');
                    }
                }
            });

            const signOut = async () => {
                await fb.signOut(fb.auth);
                location.reload();
            };
            el('btn-logout').addEventListener('click', signOut);
            el('btn-signout-gate').addEventListener('click', signOut);

            fb.onAuthStateChanged(fb.auth, async (user) => {
                if (!user) {
                    el('btn-login').classList.remove('hidden');
                    el('btn-signout-gate').classList.add('hidden');
                    showGate('관리자 로그인', '이 페이지는 서비스 운영 지표를 봅니다. 관리자 계정으로 로그인해주세요.');
                    return;
                }

                // 화면 가리기용 확인. 진짜 차단은 Firestore 규칙이 한다.
                if (!isAdminUser(user)) {
                    showGate('접근 권한이 없습니다', '관리자로 등록된 계정이 아닙니다. 현재 로그인한 계정은 ');
                    const code = document.createElement('code');
                    code.textContent = user.email || user.uid;
                    el('gate-msg').appendChild(code);
                    el('gate-msg').appendChild(document.createTextNode(' 입니다.'));
                    // 로그인은 됐지만 권한이 없는 상태 — 계정을 바꿀 길을 열어둔다
                    el('btn-signout-gate').classList.remove('hidden');
                    el('btn-login').classList.add('hidden');
                    return;
                }

                el('who').textContent = user.email || user.uid;

                try {
                    // ① 가벼운 경로 먼저 — 집계 문서가 있으면 recipes 전체를 안 받는다.
                    agg = await loadAggregates(fb);
                    if (agg) {
                        dataMode = 'aggregate';
                        allRecipes = [];
                    } else {
                        // ② 집계가 아직 없거나 권한이 없다 → 예전 전체 스캔으로 떨어진다.
                        //    규칙 게시·백필 전에도 대시보드가 멀쩡히 뜨게 하려는 안전망이다.
                        dataMode = 'scan';
                        allRecipes = await loadAllRecipes(fb);
                    }

                    // 리드·방문은 데이터 경로와 무관하게 항상 시도한다(관리자만 읽음).
                    // 규칙에 없으면 조용히 비어서 떨어진다.
                    leads = await loadLeads(fb);
                    visits = await loadVisits(fb);

                    // 랜딩의 사회적 증거용 공개 집계. recipes 자체는 비공개라
                    // 익명 방문자가 셀 수 없으므로 여기서 숫자만 공개 문서에 남긴다.
                    // 집계 모드에서는 allRecipes가 비어 있으므로 일별 합계를 쓴다 —
                    // 그냥 length를 쓰면 랜딩 숫자가 0으로 덮인다.
                    const totalCount = dataMode === 'aggregate'
                        ? [...agg.daily.values()].reduce((s, d) => s + (Number(d.count) || 0), 0)
                        : allRecipes.length;
                    // 실패해도 대시보드는 그대로 동작해야 한다.
                    try {
                        await fb.setDoc(fb.doc(fb.db, 'public_stats', 'landing'), {
                            recipeCount: totalCount,
                            updatedAt: new Date().toISOString()
                        });
                    } catch (statErr) {
                        console.warn('public_stats 갱신 실패 (대시보드에는 영향 없음)', statErr);
                    }

                    showDash();
                } catch (err) {
                    const hint = document.createElement('code');
                    hint.textContent = user.uid;
                    showGate(
                        '데이터를 불러오지 못했습니다',
                        `Firestore 조회가 거부됐습니다 (${err.code || err.message}). 보안 규칙에서 관리자에게 recipes 전체 읽기를 허용해야 합니다. 현재 UID는 `
                    );
                    el('gate-msg').appendChild(hint);
                    el('gate-msg').appendChild(document.createTextNode(' 입니다. ADMIN.md를 참고하세요.'));
                }
            });
        })
        .catch(() => {
            showGate('Firebase를 불러오지 못했습니다', '네트워크를 확인하거나 데모 모드로 확인해보세요.');
        });
}
