// 원두 카탈로그 — 취향 검사(#quiz)·AI 추천·레시피 가이드가 공유하는 단일 소스.
// 여기 상품 링크가 실제 구매처(컬리·홈바리스타클럽·네이버)로 살아있어야 "실제 구매 가능한
// 원두 추천"이 성립한다. .github/workflows/bean-link-check.yml + scripts/check-bean-links.mjs
// 가 이 파일의 컬리/홈바리스타클럽 URL을 매주 점검하고, 죽으면 Gemini가 교체 PR을 올린다.
//
// 클래식 스크립트로 로드되어 window.COFFEE_BEANS 전역을 노출한다(퀴즈는 index.html의
// 클래식 스크립트, 로그북/앱은 ES 모듈 — 양쪽 다 전역으로 읽어 로더 종류에 얽매이지 않는다).
//
// profile: 취향 프로필 A~D (A 라이트·플로럴 / B 미디엄·밸런스 / C 고소·초콜릿 / D 다크·묵직)
// roastLevel: 'light' | 'medium' | 'medium-dark' | 'dark'
// brewFit: 어울리는 추출 방식 ['drip' | 'espresso' | 'latte']
// 제휴 전환 시 각 url만 제휴 딥링크로 교체하면 된다.
(function () {
    const naverSearch = (q) => 'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent(q);

    const COFFEE_BEANS = [
        // ── A. 화사한 향미 탐험가 (라이트 · 플로럴 · 산미) ──
        {
            id: 'a1', profile: 'A',
            name: '센터커피 싱글 오리진 (에티오피아 아리차)', roaster: '센터커피 · 컬리',
            desc: '재스민과 복숭아, 홍차 같은 여운 — 서울숲 로스터리의 워시드 에티오피아',
            flavorTags: ['floral', 'fruity', 'acidic', 'tea-like'],
            roastLevel: 'light', brewFit: ['drip'],
            store: '컬리', url: 'https://www.kurly.com/goods/1000257734',
        },
        {
            id: 'a2', profile: 'A',
            name: '나무사이로 × 홈바리스타클럽 원두', roaster: '나무사이로 · 홈바리스타클럽',
            desc: '산미 좋은 라이트 로스팅으로 정평난 로스터리의 콜라보 원두',
            flavorTags: ['floral', 'fruity', 'acidic'],
            roastLevel: 'light', brewFit: ['drip'],
            store: '홈바리스타클럽', url: 'https://www.homebaristashop.com/goods/goods_view.php?goodsNo=1000000613',
        },
        {
            id: 'a3', profile: 'A',
            name: '프릳츠 싱글오리진 원두', roaster: '프릳츠커피컴퍼니 · 네이버 쇼핑',
            desc: '서울 대표 로스터리의 화사한 싱글오리진 라인업',
            flavorTags: ['floral', 'fruity', 'acidic'],
            roastLevel: 'light', brewFit: ['drip'],
            store: '네이버 쇼핑', url: naverSearch('프릳츠 싱글오리진 원두'),
        },

        // ── B. 밸런스의 클래식 (미디엄 · 밸런스 · 단맛) ──
        {
            id: 'b1', profile: 'B',
            name: '프릳츠 블렌딩 원두 3종 (택1)', roaster: '프릳츠커피컴퍼니 · 컬리',
            desc: "'잘 되어가시나' 등 균형 좋기로 유명한 시그니처 블렌드",
            flavorTags: ['sweet', 'caramel', 'balanced', 'honey'],
            roastLevel: 'medium', brewFit: ['drip', 'espresso'],
            store: '컬리', url: 'https://www.kurly.com/goods/1002076410',
        },
        {
            id: 'b2', profile: 'B',
            name: '필그림 × 홈바리스타클럽 원두', roaster: '필그림 커피로스터스 · 홈바리스타클럽',
            desc: '밸런스로 사랑받는 로스터리의 콜라보 원두',
            flavorTags: ['sweet', 'balanced', 'caramel'],
            roastLevel: 'medium', brewFit: ['drip', 'espresso'],
            store: '홈바리스타클럽', url: 'https://www.homebaristashop.com/goods/goods_view.php?goodsNo=1000000617',
        },
        {
            id: 'b3', profile: 'B',
            name: '테라로사 강릉블렌드 원두', roaster: '테라로사 · 네이버 쇼핑',
            desc: '강릉 대표 로스터리의 대표 데일리 블렌드',
            flavorTags: ['sweet', 'balanced', 'caramel'],
            roastLevel: 'medium', brewFit: ['drip', 'espresso'],
            store: '네이버 쇼핑', url: naverSearch('테라로사 강릉블렌드 원두'),
        },

        // ── C. 고소한 위로 한 잔 (미디엄다크 · 견과 · 초콜릿 · 라떼) ──
        {
            id: 'c1', profile: 'C',
            name: '모모스커피 블렌드 원두 8종 (택1)', roaster: '모모스커피 · 컬리',
            desc: '월드 바리스타 챔피언을 배출한 부산 로스터리의 블렌드 셀렉션',
            flavorTags: ['nutty', 'chocolate', 'sweet', 'milky'],
            roastLevel: 'medium-dark', brewFit: ['espresso', 'latte'],
            store: '컬리', url: 'https://www.kurly.com/goods/5052567',
        },
        {
            id: 'c2', profile: 'C',
            name: '커피리브레 × 홈바리스타클럽 원두', roaster: '커피리브레 · 홈바리스타클럽',
            desc: '국내 스페셜티 1세대 로스터리의 콜라보 원두',
            flavorTags: ['nutty', 'chocolate', 'sweet'],
            roastLevel: 'medium-dark', brewFit: ['espresso', 'latte'],
            store: '홈바리스타클럽', url: 'https://www.homebaristashop.com/goods/goods_view.php?goodsNo=1000000575',
        },
        {
            id: 'c3', profile: 'C',
            name: '커피리브레 배드블러드 블렌드', roaster: '커피리브레 · 네이버 쇼핑',
            desc: '초콜릿과 견과의 단맛으로 유명한 리브레 대표 블렌드',
            flavorTags: ['nutty', 'chocolate', 'sweet', 'milky'],
            roastLevel: 'medium-dark', brewFit: ['espresso', 'latte'],
            store: '네이버 쇼핑', url: naverSearch('커피리브레 배드블러드 원두'),
        },

        // ── D. 묵직한 바디 애호가 (다크 · 쓴맛 · 헤비 바디) ──
        {
            id: 'd1', profile: 'D',
            name: '앤트러사이트 다크 블렌딩 원두 3종 (택1)', roaster: '앤트러사이트 · 컬리',
            desc: '묵직한 다크 로스팅으로 이름난 로스터리의 다크 블렌드',
            flavorTags: ['bitter', 'dark-chocolate', 'heavy', 'smoky'],
            roastLevel: 'dark', brewFit: ['espresso'],
            store: '컬리', url: 'https://www.kurly.com/goods/5061872',
        },
        {
            id: 'd2', profile: 'D',
            name: '리사르 커피 × 홈바리스타클럽 원두', roaster: '리사르커피 · 홈바리스타클럽',
            desc: '나폴리식 진한 에스프레소로 이름난 로스터리의 콜라보',
            flavorTags: ['bitter', 'dark-chocolate', 'heavy'],
            roastLevel: 'dark', brewFit: ['espresso'],
            store: '홈바리스타클럽', url: 'https://www.homebaristashop.com/goods/goods_view.php?goodsNo=1000000597',
        },
        {
            id: 'd3', profile: 'D',
            name: '빈브라더스 다크 블렌드 원두', roaster: '빈브라더스 · 네이버 쇼핑',
            desc: '진하고 묵직한 바디의 블렌드로 사랑받는 브랜드',
            flavorTags: ['bitter', 'dark-chocolate', 'heavy'],
            roastLevel: 'dark', brewFit: ['espresso'],
            store: '네이버 쇼핑', url: naverSearch('빈브라더스 원두'),
        },
    ];

    const getBeansByProfile = (profile) => COFFEE_BEANS.filter((b) => b.profile === profile);
    const getBeanById = (id) => COFFEE_BEANS.find((b) => b.id === id) || null;

    window.COFFEE_BEANS = COFFEE_BEANS;
    window.getBeansByProfile = getBeansByProfile;
    window.getBeanById = getBeanById;
})();
