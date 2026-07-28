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
    const users = Array.from({ length: 34 }, (_, i) => 'demoUser' + String(i).padStart(3, '0'));
    const out = [];
    const now = Date.now();

    for (let day = 89; day >= 0; day--) {
        // 완만한 성장 + 주말 가중 + 노이즈
        const growth = 1.1 + (89 - day) / 42;
        const weekend = [0, 6].includes(new Date(now - day * 864e5).getDay()) ? 1.45 : 1;
        const count = Math.max(0, Math.round((growth * weekend) * (0.55 + rnd() * 1.5)));

        for (let i = 0; i < count; i++) {
            const d = new Date(now - day * 864e5);
            d.setHours(6 + Math.floor(rnd() * 15), Math.floor(rnd() * 60), 0, 0);
            const espresso = rnd() < 0.62;
            const r = rnd();
            const rating = r < 0.06 ? 1 : r < 0.16 ? 2 : r < 0.38 ? 3 : r < 0.74 ? 4 : 5;
            // 인기 원두가 실제로 쏠리도록 앞쪽 원두에 가중치
            const bi = Math.min(beans.length - 1, Math.floor(Math.pow(rnd(), 1.7) * beans.length));
            out.push({
                id: 'demo-' + day + '-' + i,
                userId: users[Math.floor(Math.pow(rnd(), 1.4) * users.length)],
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

/* ────────────────────────── chart: trend ────────────────────────── */

function renderTrend(wrap, series) {
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
    s.setAttribute('aria-label', '일별 기록 추이');

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

/* ────────────────────────── render ────────────────────────── */

function render() {
    const scoped = sliceByRange(allRecipes, rangeDays);
    const a = aggregate(scoped, rangeDays);
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

    el('trend-sub').textContent = `${label} · 하루에 저장된 레시피 수`;
    renderTrend(el('trend-wrap'), a.series);
    renderModeSplit(el('mode-wrap'), el('mode-legend'), a.espresso, a.drip);
    renderRatings(el('rating-wrap'), a.ratingCounts);
    renderBeans(el('beans-wrap'), a.beans);

    // 표 뷰 — 모든 차트는 표로도 읽을 수 있어야 한다
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

    el('foot').textContent = isDemo
        ? '데모 데이터 · 실제 Firestore를 조회하지 않았습니다.'
        : `Firestore recipes 컬렉션 전체 ${fmt(allRecipes.length)}건을 불러와 브라우저에서 집계했습니다.`;
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
            const tv = el(btn.dataset.tv);
            const chart = tv.previousElementSibling;
            const showTable = !tv.classList.contains('on');
            tv.classList.toggle('on', showTable);
            chart.classList.toggle('off', showTable);
            btn.textContent = showTable ? '차트로 보기' : '표로 보기';
        });
    });

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
    el('demo-banner').classList.remove('hidden');
    el('who').textContent = '데모 모드';
    el('btn-logout').classList.add('hidden');
    showDash();
} else {
    el('gate').classList.remove('hidden');

    import('./firebase-config.js')
        .then((fb) => {
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
                    const snap = await fb.getDocs(fb.collection(fb.db, 'recipes'));
                    allRecipes = [];
                    snap.forEach((d) => {
                        const data = d.data();
                        // 본문 이미지는 base64로 최대 1MB — 집계에 쓰지 않으니 들고 있지 않는다
                        delete data.imageUrl;
                        allRecipes.push({ id: d.id, ...data });
                    });

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
