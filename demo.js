// demo.js — 데모 모드.
// 규칙 게시·Firebase 없이 로컬에서 공유 기능 전체 UX를 클릭해보고 "판단"만 하기
// 위한 가짜 데이터층. ?demo=1 로 켜고 ?demo=0 으로 끈다(브라우저에 유지).
// 운영 데이터에 아무 영향 없다 — community.js가 데모일 때 이 데이터를 대신 돌려준다.

const KEY = 'nmcDemo';

try {
    const q = new URLSearchParams(location.search);
    if (q.get('demo') === '1') localStorage.setItem(KEY, '1');
    if (q.get('demo') === '0') localStorage.removeItem(KEY);
} catch (e) { /* 스토리지 차단 환경이면 URL 파라미터로만 판단(아래) */ }

export function isDemo() {
    try {
        if (localStorage.getItem(KEY) === '1') return true;
    } catch (e) { /* ignore */ }
    try {
        return new URLSearchParams(location.search).get('demo') === '1';
    } catch (e) { return false; }
}

// 상세/피드에서 쓸 createdAt은 Firestore Timestamp처럼 toDate()를 갖게 흉내낸다.
const now = Date.now();
const ago = (days) => ({ toDate: () => new Date(now - days * 86400000) });

// 사진 한 장은 인라인 SVG data URL로(외부 요청 없음). 나머지는 사진 없는 카드.
const DEMO_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="640">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#8a5a34"/><stop offset="1" stop-color="#2a1a12"/></linearGradient></defs>
       <rect width="800" height="640" fill="url(#g)"/>
       <circle cx="560" cy="180" r="90" fill="#fff" opacity="0.06"/>
       <circle cx="240" cy="420" r="140" fill="#fff" opacity="0.05"/>
     </svg>`);

export const DEMO_POSTS = [
    {
        id: 'demo-1', ownerId: 'demo-u1', ownerName: '모닝브루',
        title: '예가체프의 산뜻한 단맛', method: 'espresso',
        bean: '에티오피아 예가체프', roaster: '센터커피', gear: '가찌아 클래식',
        grinder: '니체 제로', grindSetting: '12클릭',
        description: '레몬 같은 산미와 달콤한 여운을 목표로 했어요. 온도를 1℃ 낮추니 더 부드러워졌습니다.',
        params: { dose: 18.0, waterTemp: 92, timeSec: 28, yield: 36.0 },
        photoUrl: DEMO_PHOTO, hasPhoto: true,
        visibility: 'public', status: 'active', hiddenByAdmin: false, version: 1, createdAt: ago(0.1),
    },
    {
        id: 'demo-2', ownerId: 'demo-u2', ownerName: '바람드는날',
        title: '콜롬비아 균형 잡힌 드립', method: 'drip',
        bean: '콜롬비아 수프리모', roaster: '프릳츠', gear: 'V60', grinder: '코만단테', grindSetting: '22클릭',
        description: '고소하고 균형 잡힌 맛. 3회 푸어로 안정적으로 뽑았어요.',
        params: { dose: 20.0, waterTemp: 93, timeSec: 150, yield: 320.0 },
        photoUrl: '', hasPhoto: false,
        visibility: 'public', status: 'active', hiddenByAdmin: false, version: 1, createdAt: ago(0.4),
    },
    {
        id: 'demo-3', ownerId: 'demo-u3', ownerName: '홈카페일지',
        title: '과테말라 안티구아, 초콜릿 피니시', method: 'espresso',
        bean: '과테말라 안티구아', roaster: '테라로사', gear: '브레빌 바리스타', grinder: '', grindSetting: '내장 15',
        description: '다크초콜릿과 견과류 느낌. 도징을 0.5g 늘려 바디를 키웠습니다.',
        params: { dose: 18.5, waterTemp: 94, timeSec: 30, yield: 38.0 },
        photoUrl: '', hasPhoto: false,
        visibility: 'public', status: 'active', hiddenByAdmin: false, version: 1, createdAt: ago(1.2),
    },
];

export function demoFeed(method) {
    const items = DEMO_POSTS.filter((p) => method === 'all' || p.method === method);
    return { items, cursor: null, done: true };
}

export function demoGetPost(id) {
    return DEMO_POSTS.find((p) => p.id === id) || DEMO_POSTS[0];
}
