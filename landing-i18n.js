// landing-i18n.js — 랜딩(index.html) 전용 i18n 엔진 + 사전(ko/en/ja/zh).
//
// 랜딩은 로그인 전 마케팅 페이지라 자체 토글이 없었다. 저장된 언어(nmcLang)가 있으면
// 그걸 쓰고, 없으면 브라우저 언어로 한 번 정해 nmcLang에 저장한다 — 그래야 랜딩에서
// 고른 언어가 앱까지 그대로 이어진다(모든 부분 동기화).
//
// Firebase에 의존하지 않는 classic 스크립트다. landing.js(모듈)는 Firebase CDN을
// 먼저 import하므로 네트워크가 느리면 통째로 늦는데, 언어 적용이 거기 묶이면 안 된다.
// 인라인 퀴즈 스크립트와 landing.js가 번역 문자열을 읽도록 window.NMC로 노출한다.
(function () {
    'use strict';

    var LANGS = ['en', 'ko', 'ja', 'zh'];
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 못 해도 이번 세션은 동작 */ } }

    function detect() {
        var s = lsGet('nmcLang');
        if (LANGS.indexOf(s) !== -1) return s;
        var n = (navigator.language || 'en').toLowerCase();
        if (n.indexOf('ko') === 0) return 'ko';
        if (n.indexOf('ja') === 0) return 'ja';
        if (n.indexOf('zh') === 0) return 'zh';
        return 'en';
    }

    // ── 프로즈 사전: data-i18n(=innerHTML) / data-i18n-text(=textContent) /
    //    data-i18n-ph(=placeholder) / data-i18n-aria(=aria-label) 키 → 언어별 문자열 ──
    var P = {
        // NAV
        'nav.howto': { ko: '사용 방법', en: 'How it works', ja: '使い方', zh: '使用方式' },
        'nav.quiz': { ko: '취향 검사', en: 'Taste quiz', ja: '好み診断', zh: '口味測驗' },
        'nav.faq': { ko: 'FAQ', en: 'FAQ', ja: 'FAQ', zh: 'FAQ' },
        // CTA (landing.js가 로그인 상태에 따라 cta.signed_in/out으로 덮어쓴다)
        'cta.signed_out': { ko: '첫 커피 기록하기', en: 'Log your first coffee', ja: '最初の一杯を記録', zh: '記錄第一杯咖啡' },
        'cta.signed_in': { ko: '콘솔로 이동하기', en: 'Go to the console', ja: 'コンソールへ', zh: '前往主控台' },
        'cta.free_start': { ko: '무료로 시작하기', en: 'Start free', ja: '無料で始める', zh: '免費開始' },

        // HERO
        'hero.eyebrow': { ko: '바리스타가 만든 커피 기록', en: 'Coffee logging, built by a barista', ja: 'バリスタがつくったコーヒー記録', zh: '咖啡師打造的咖啡記錄' },
        'hero.title': {
            ko: '어제의 좋은 한 잔,<br>\n<em>오늘의 기준으로.</em>',
            en: 'Yesterday’s great cup,<br>\n<em>as today’s baseline.</em>',
            ja: '昨日のおいしい一杯を、<br>\n<em>今日の基準に。</em>',
            zh: '昨天那杯好咖啡，<br>\n<em>成為今天的基準。</em>'
        },
        'hero.body': {
            ko: '도징·온도·시간·추출량을 남기고, 다음 추출을 준비하세요.',
            en: 'Record dose, temperature, time and yield — then set up your next brew.',
            ja: '分量・温度・時間・抽出量を残して、次の抽出に備えましょう。',
            zh: '記下粉量、溫度、時間與萃取量，為下一杯做準備。'
        },
        'hero.cta2': { ko: '취향부터 알아보기', en: 'Find your taste first', ja: 'まず好みを知る', zh: '先了解你的口味' },
        'hero.caption': {
            ko: '설치 없이 웹에서 바로 · 첫 기록은 로그인 없이',
            en: 'Right in your browser, no install · first log needs no sign-in',
            ja: 'インストール不要・ブラウザですぐ · 最初の記録はログイン不要',
            zh: '免安裝、瀏覽器直接用 · 第一筆記錄免登入'
        },
        'hero.play_small': { ko: 'ANDROID 앱 출시', en: 'ANDROID APP', ja: 'Androidアプリ', zh: 'Android App' },
        'hero.play_main': { ko: 'Google Play에서 받기', en: 'Get it on Google Play', ja: 'Google Playで入手', zh: '在 Google Play 下載' },
        'hero.scroll': { ko: '스크롤', en: 'Scroll', ja: 'スクロール', zh: '向下捲動' },
        'mockup.env': { ko: '서울 · 24°C 맑음', en: 'Seoul · 24°C Clear', ja: 'ソウル · 24°C 晴れ', zh: '首爾 · 24°C 晴' },
        'mockup.sw_hint': { ko: '추출과 동시에 시간 측정', en: 'Time it as you brew', ja: '抽出と同時に計測', zh: '萃取同時計時' },
        'mockup.applied_hint': { ko: '스톱워치 값 자동 입력', en: 'Stopwatch value auto-filled', ja: 'ストップウォッチ値を自動入力', zh: '碼錶數值自動填入' },
        'mockup.card_actions': { ko: '공유 · 삭제', en: 'Share · Delete', ja: 'シェア · 削除', zh: '分享 · 刪除' },
        'mockup.share_title': { ko: '레시피 공유', en: 'Share recipe', ja: 'レシピをシェア', zh: '分享食譜' },
        'mockup.share_tab_card': { ko: '🗂️ 카드', en: '🗂️ Card', ja: '🗂️ カード', zh: '🗂️ 卡片' },
        'mockup.share_tab_photo': { ko: '🖼️ 사진 배경', en: '🖼️ Photo bg', ja: '🖼️ 写真背景', zh: '🖼️ 照片背景' },
        'mockup.share_save': { ko: '↓ 이미지 저장', en: '↓ Save image', ja: '↓ 画像保存', zh: '↓ 儲存圖片' },
        'mockup.share_share': { ko: '↗ 공유', en: '↗ Share', ja: '↗ シェア', zh: '↗ 分享' },
        'mockup.share_link': { ko: '🔗 링크 복사', en: '🔗 Copy link', ja: '🔗 リンクをコピー', zh: '🔗 複製連結' },
        'mockup.share_recv_hint': { ko: '받는 사람이 링크를 열면 ↓', en: 'When they open the link ↓', ja: '相手がリンクを開くと ↓', zh: '對方開啟連結後 ↓' },
        'mockup.recv_head': { ko: '📨 받은 레시피', en: '📨 Recipe received', ja: '📨 受け取ったレシピ', zh: '📨 收到的食譜' },
        'mockup.recv_btn': { ko: '내 로그북에 저장하기', en: 'Save to my logbook', ja: '自分のログブックに保存', zh: '存到我的筆記本' },

        // STORY (01)
        'story.tag': { ko: '01 — 기억은 흐려진다', en: '01 — Memory fades', ja: '01 — 記憶は薄れる', zh: '01 — 記憶會模糊' },
        'story.title': {
            ko: '다이얼링은 반복이다.<br>\n하지만 <em>기억</em>은 흐려진다.',
            en: 'Dialing in is repetition.<br>\nBut <em>memory</em> fades.',
            ja: 'ダイヤルインは繰り返し。<br>\nでも<em>記憶</em>は薄れる。',
            zh: '調校是不斷重複。<br>\n但<em>記憶</em>會模糊。'
        },
        'story.p1': {
            ko: '커피 한 잔에는 최소 네 개의 변수가 있다. 도징·온도·시간·수율. 여기에 원두와 분쇄도까지 더하면 조합은 수백 가지가 된다. 사람의 기억은 그걸 버티지 못한다 — 사흘이면 흐려지고, 원두가 바뀌면 처음으로 돌아간다. <strong>맛이 들쭉날쭉한 건 실력이 부족해서가 아니라, 기억에 맡겼기 때문이다.</strong>',
            en: 'A single cup has at least four variables — dose, temperature, time, yield. Add the bean and grind size and the combinations run into the hundreds. Memory can’t hold that: it blurs within three days, and resets the moment the bean changes. <strong>Inconsistent taste isn’t a lack of skill — it’s what happens when you leave it to memory.</strong>',
            ja: '一杯のコーヒーには少なくとも4つの変数がある。分量・温度・時間・収率。さらに豆と挽き目を加えれば組み合わせは数百通り。人の記憶はそれを支えきれない — 三日で薄れ、豆が変われば最初に戻る。<strong>味がばらつくのは腕が足りないからではなく、記憶任せにしているからだ。</strong>',
            zh: '一杯咖啡至少有四個變數：粉量、溫度、時間、萃取率。再加上豆子與研磨度，組合就有數百種。人的記憶撐不住——三天就模糊，換了豆子又從頭來過。<strong>味道時好時壞，不是技術不夠，而是把一切交給了記憶。</strong>'
        },
        'story.p2': {
            ko: '바리스타로 일하면서 매일 추출을 반복했다. 어떤 원두는 17.5g에서 완벽했고, 어떤 건 19g이어야 했다. 온도가 1도만 달라져도 맛이 달라졌다.',
            en: 'Working as a barista, I pulled shots every day. Some beans were perfect at 17.5g, others needed 19g. A single degree of temperature changed the taste.',
            ja: 'バリスタとして毎日抽出を繰り返した。ある豆は17.5gで完璧、別の豆は19gでないとだめ。温度が1度違うだけで味が変わった。',
            zh: '當咖啡師時我每天反覆萃取。有些豆子 17.5g 最完美，有些非得 19g。溫度只差一度，味道就不同。'
        },
        'story.quote': {
            ko: '"그 조합이 완벽했다. 그런데 이틀 뒤에,<br>\n기억이 안 났다."',
            en: '"That combination was perfect. Two days later,<br>\nI couldn’t remember it."',
            ja: '「その組み合わせは完璧だった。なのに二日後、<br>\n思い出せなかった。」',
            zh: '「那個組合很完美。可是兩天後，<br>\n我卻想不起來了。」'
        },
        'story.p3': {
            ko: '원두가 바뀌던 날, 오픈이 20분 늦었다. 전날 세팅이 기억나지 않아 손님이 기다리는 동안 처음부터 다시 추출했다. 완벽한 세팅을 찾아도 기록하지 않으면 매번 처음이 된다.',
            en: 'The day the beans changed, we opened 20 minutes late. I couldn’t recall the day-before settings, so I dialed in from scratch while customers waited. Find the perfect setting and don’t log it, and every time is square one.',
            ja: '豆が変わった日、開店が20分遅れた。前日のセッティングを思い出せず、客を待たせながら一から抽出し直した。完璧な設定を見つけても記録しなければ、毎回が最初からになる。',
            zh: '換豆的那天，我們晚了 20 分鐘開門。想不起前一天的設定，只能讓客人等著從頭調起。就算找到完美設定，不記下來，每次都是從零開始。'
        },
        'story.p4': {
            ko: '카페를 그만둔 지금도 마찬가지다. 핸드드립 한 잔으로 하루를 시작하는데, 어제는 맛있었고 오늘은 아니다. 도징이 달랐던 걸까, 물 온도였을까, 추출 시간이 문제였을까 — 알 수가 없다. 기록을 안 해뒀으니까.',
            en: 'It’s the same now that I’ve left the café. I start the day with a pour-over — yesterday it was great, today it isn’t. Was the dose off, the water temp, the time? No way to know. I never wrote it down.',
            ja: 'カフェを辞めた今も同じだ。ハンドドリップ一杯で一日を始めるが、昨日はおいしくて今日はそうでない。分量だったのか、湯温か、抽出時間か — わからない。記録していなかったから。',
            zh: '現在離開咖啡館也一樣。每天用一杯手沖開場，昨天好喝、今天卻不行。是粉量不同、水溫、還是萃取時間？無從得知——因為我沒記下來。'
        },
        'param.dose_key': { ko: '도징', en: 'Dose', ja: '分量', zh: '粉量' },
        'param.dose_desc': { ko: '어떤 원두를, 얼마나 담을지', en: 'Which bean, how much', ja: 'どの豆を、どれだけ', zh: '用哪支豆、放多少' },
        'param.temp_key': { ko: '물 온도', en: 'Water temp', ja: '湯温', zh: '水溫' },
        'param.temp_desc': { ko: '최적의 온도로 추출을 시작', en: 'Start at the right temperature', ja: '最適な温度で抽出を開始', zh: '以最佳溫度開始萃取' },
        'param.time_key': { ko: '추출 시간', en: 'Brew time', ja: '抽出時間', zh: '萃取時間' },
        'param.time_unit': { ko: '초', en: 'sec', ja: '秒', zh: '秒' },
        'param.time_desc': { ko: '흐르는 시간을 정확하게', en: 'Time it precisely', ja: '流れる時間を正確に', zh: '精準掌握時間' },
        'param.yield_key': { ko: '추출량', en: 'Yield', ja: '抽出量', zh: '萃取量' },
        'param.yield_desc': { ko: '원하는 만큼, 안정적으로', en: 'As much as you want, consistently', ja: '欲しい量を安定して', zh: '穩定做出想要的量' },
        'story.p5': {
            ko: '<strong>완벽한 커피를 한 번 내렸다면, 다시 내릴 수 있어야 한다.</strong> 이 숫자들을 저장해두면 다음 번에 재현할 수 있다. 원두가 바뀌어도, 날씨가 달라져도, 어제 어떤 세팅이 성공했는지 바로 꺼낼 수 있다.',
            en: '<strong>If you’ve made a perfect cup once, you should be able to make it again.</strong> Save these numbers and you can reproduce it next time. Even when the bean changes or the weather shifts, yesterday’s winning setting is one tap away.',
            ja: '<strong>完璧な一杯を一度淹れたなら、もう一度淹れられるべきだ。</strong>この数字を保存しておけば次も再現できる。豆が変わっても、天気が変わっても、昨日成功した設定をすぐ取り出せる。',
            zh: '<strong>既然做出過一杯完美的咖啡，就該能再做一次。</strong>把這些數字存下來，下次就能重現。就算換了豆子、天氣變了，昨天成功的設定也能馬上叫出來。'
        },

        // ACT 2 (02)
        'act2.tag': { ko: '02 — 해결', en: '02 — The fix', ja: '02 — 解決', zh: '02 — 解法' },
        'act2.title': { ko: '<em>그래서</em> 만들었다.', en: 'So I <em>built</em> it.', ja: '<em>だから</em>つくった。', zh: '<em>所以</em>我做了它。' },
        'act2.p1': { ko: '추출할 때마다 <strong>30초</strong>면 기록이 완료된다.', en: 'Each brew takes just <strong>30 seconds</strong> to log.', ja: '抽出するたび<strong>30秒</strong>で記録が完了。', zh: '每次萃取只要 <strong>30 秒</strong>就能記錄完成。' },
        'act2.pill_dose': { ko: '도징', en: 'Dose', ja: '分量', zh: '粉量' },
        'act2.pill_temp': { ko: '온도', en: 'Temp', ja: '温度', zh: '溫度' },
        'act2.pill_time': { ko: '시간', en: 'Time', ja: '時間', zh: '時間' },
        'act2.pill_yield': { ko: '수율', en: 'Yield', ja: '収率', zh: '萃取率' },
        'act2.p2': { ko: '네 가지 변수를 슬라이더로 맞추고 저장하면 끝이다.', en: 'Set the four variables with sliders, save, and you’re done.', ja: '4つの変数をスライダーで合わせて保存するだけ。', zh: '用滑桿調好四個變數，儲存就完成。' },
        'act2.p3': {
            ko: '원두 이름, 산지, 테이스팅 노트도 함께 남길 수 있다. 원두가 바뀌는 날, 지난 기록을 꺼내면 다이얼링 출발점이 생긴다. 매일 아침 커피가 조금씩 나아진다.',
            en: 'You can also note the bean, origin and tasting notes. When the bean changes, pull up past logs for a dialing-in starting point. Every morning your coffee gets a little better.',
            ja: '豆の名前、産地、テイスティングノートも一緒に残せる。豆が変わる日、過去の記録を開けばダイヤルインの出発点ができる。毎朝コーヒーが少しずつ良くなる。',
            zh: '也能一起記下豆名、產區與風味筆記。換豆的那天，叫出過去的記錄就有了調校起點。每天早上的咖啡都會好一點。'
        },
        'act2.p4': {
            ko: '첫 기록은 로그인 없이 바로 남길 수 있다. 이어서 쌓아가려면 카카오나 구글로 로그인 한 번 — 그때 체험으로 남긴 기록도 계정으로 함께 옮겨가고, 기기가 달라져도 그대로 유지된다.',
            en: 'Your first log needs no sign-in. To keep building, sign in once with Kakao or Google — the trial log moves into your account too, and stays with you across devices.',
            ja: '最初の記録はログイン不要。続けて貯めるにはKakaoかGoogleで一度ログイン — その時お試しの記録もアカウントに移り、端末が変わってもそのまま残る。',
            zh: '第一筆記錄免登入。想繼續累積，用 Kakao 或 Google 登入一次——體驗時留下的記錄也會一併移進帳號，換裝置也保留。'
        },

        // PERSONA
        'persona.tag': { ko: '누구에게', en: 'Who it’s for', ja: 'こんな人に', zh: '給這樣的你' },
        'persona.title': { ko: '혹시 이 중<br><em>하나</em>인가요?', en: 'Is one of these<br><em>you</em>?', ja: 'このうちの<br><em>どれか</em>では？', zh: '你是<br>其中<em>之一</em>嗎？' },
        'persona.when1': { ko: '홈카페를 막 시작했다면', en: 'Just started a home café', ja: 'ホームカフェを始めたばかり', zh: '剛開始玩居家咖啡' },
        'persona.title1': { ko: '장비는 갖췄는데 맛이 안 잡히는 사람', en: 'Got the gear, can’t nail the taste', ja: '機材は揃えたのに味が決まらない人', zh: '設備齊了，味道卻抓不準' },
        'persona.desc1': { ko: '그라인더도 머신도 샀는데 어제와 오늘이 다릅니다. 장비를 더 사도 해결되지 않습니다 — 무엇을 바꿨는지 남기는 것부터입니다.', en: 'You bought the grinder and the machine, but today tastes different from yesterday. More gear won’t fix it — it starts with recording what you changed.', ja: 'グラインダーもマシンも買ったのに、昨日と今日が違う。機材を増やしても解決しない — 何を変えたかを残すことから。', zh: '磨豆機、機器都買了，昨天和今天卻不一樣。再買設備也解決不了——先從記下你改了什麼開始。' },
        'persona.when2': { ko: '원두를 자주 바꾼다면', en: 'If you switch beans often', ja: '豆をよく変えるなら', zh: '常換豆子的話' },
        'persona.title2': { ko: '새 봉투마다 처음부터 헤매는 사람', en: 'Starting over with every new bag', ja: '新しい袋ごとに一からさまよう人', zh: '每開一包就從頭摸索' },
        'persona.desc2': { ko: '원두별로 기록이 쌓이면 다음 봉투의 첫 잔도 감이 아니라 지난 성공 세팅 근처에서 시작합니다.', en: 'With logs stacked up per bean, the first cup from the next bag starts near your last winning setting — not from a guess.', ja: '豆ごとに記録が貯まれば、次の袋の最初の一杯も勘ではなく、前回の成功設定の近くから始められます。', zh: '按豆子累積記錄後，下一包的第一杯也能從上次的成功設定附近開始，而不是憑感覺。' },
        'persona.when3': { ko: '카페에서 일한다면', en: 'If you work in a café', ja: 'カフェで働いているなら', zh: '在咖啡館工作的話' },
        'persona.title3': { ko: '오픈 전 다이얼링을 기억에 맡기던 사람', en: 'Dialing in from memory before opening', ja: '開店前のダイヤルインを記憶任せにしていた人', zh: '開店前靠記憶調校' },
        'persona.desc3': { ko: '어제 맞춰둔 값을 그대로 꺼내 씁니다. 로그인하면 카페 PC에서도 같은 기록이 열립니다.', en: 'Pull up yesterday’s values as-is. Sign in and the same logs open on the café PC too.', ja: '昨日合わせた値をそのまま取り出す。ログインすればカフェのPCでも同じ記録が開きます。', zh: '直接叫出昨天調好的數值。登入後，咖啡館電腦也能開同一份記錄。' },

        // DEMO (03)
        'demo.tag': { ko: '03 — 실제 화면', en: '03 — Real screens', ja: '03 — 実際の画面', zh: '03 — 實際畫面' },
        'demo.title': { ko: '말보다, <em>15초</em> 데모.', en: 'Less talk — a <em>15-second</em> demo.', ja: '説明より、<em>15秒</em>デモ。', zh: '少說話，<em>15 秒</em>示範。' },
        'demo.num1': { ko: '01 · 기록', en: '01 · Log', ja: '01 · 記録', zh: '01 · 記錄' },
        'demo.t1': { ko: '슬라이더 네 번이면 끝', en: 'Four sliders, done', ja: 'スライダー4回で完了', zh: '四個滑桿就搞定' },
        'demo.d1': { ko: '도징·온도·시간·수율을 맞추는 동안 SCA 기준 품질 배지와 추출 비율이 실시간으로 계산됩니다.', en: 'As you set dose, temperature, time and yield, the SCA quality badge and brew ratio update in real time.', ja: '分量・温度・時間・収率を合わせる間、SCA基準の品質バッジと抽出比率がリアルタイムで計算されます。', zh: '調整粉量、溫度、時間、萃取率時，SCA 品質徽章與萃取比例會即時計算。' },
        'demo.num2': { ko: '02 · 추출', en: '02 · Brew', ja: '02 · 抽出', zh: '02 · 萃取' },
        'demo.t2': { ko: '내장 스톱워치', en: 'Built-in stopwatch', ja: '内蔵ストップウォッチ', zh: '內建碼錶' },
        'demo.d2': { ko: '추출과 동시에 시간을 재고, APPLY 한 번이면 측정값이 레시피에 그대로 들어갑니다.', en: 'Time the brew as it runs, and one APPLY drops the measured value straight into the recipe.', ja: '抽出と同時に計測し、APPLY一回で測定値がそのままレシピに入ります。', zh: '萃取同時計時，按一次 APPLY 就把測得的數值直接填進食譜。' },
        'demo.num3': { ko: '03 · 로그북', en: '03 · Logbook', ja: '03 · ログブック', zh: '03 · 筆記本' },
        'demo.t3': { ko: '레시피 카드로 쌓인다', en: 'Stacks up as recipe cards', ja: 'レシピカードで貯まる', zh: '累積成食譜卡' },
        'demo.d3': { ko: '저장한 레시피는 카드로 모입니다. 원두가 바뀌는 날, 지난 성공 세팅이 다이얼링의 출발점이 됩니다.', en: 'Saved recipes collect as cards. When the bean changes, a past winning setting becomes your dialing-in starting point.', ja: '保存したレシピはカードで集まります。豆が変わる日、過去の成功設定がダイヤルインの出発点になります。', zh: '儲存的食譜會集結成卡片。換豆的那天，過去的成功設定就是調校起點。' },
        'demo.num4': { ko: '04 · 공유', en: '04 · Share', ja: '04 · シェア', zh: '04 · 分享' },
        'demo.t4': { ko: '링크 하나면 그대로 재현된다', en: 'One link reproduces it exactly', ja: 'リンク一つでそのまま再現', zh: '一個連結完整重現' },
        'demo.d4': { ko: '저장한 레시피가 카드 이미지로 만들어집니다. 사진을 올렸다면 그 사진을 배경으로도 뽑을 수 있고, 링크를 함께 보내면 받는 사람은 숫자를 옮겨 적을 필요 없이 그 레시피를 자기 로그북에 그대로 담습니다.', en: 'Your saved recipe becomes a card image — with your own photo as the background if you added one. Send the link and the recipient drops it straight into their logbook, no retyping of numbers.', ja: '保存したレシピがカード画像になります。写真を載せていればそれを背景にもでき、リンクを一緒に送れば相手は数字を書き写さずそのレシピを自分のログブックに取り込めます。', zh: '儲存的食譜會做成卡片圖；若你上傳了照片，也能用照片當背景。把連結一起送出，對方不必抄數字，就能把食譜直接存進自己的筆記本。' },
        'demo.open': { ko: '설치 없이 브라우저에서 바로 — 앱 열어보기 →', en: 'Right in your browser, no install — open the app →', ja: 'インストール不要・ブラウザですぐ — アプリを開く →', zh: '免安裝、瀏覽器直接用 — 開啟 App →' },
        'demo.caption': { ko: '실제 서비스 화면 · 자동 재생', en: 'Real product screens · auto-play', ja: '実際の画面 · 自動再生', zh: '實際服務畫面 · 自動播放' },

        // QUIZ section header
        'quiz.tag': { ko: '취향 검사', en: 'Taste quiz', ja: '好み診断', zh: '口味測驗' },
        'quiz.title': { ko: '30초 취향 검사,<br>당신의 <em>원두</em>를 찾아드립니다.', en: 'A 30-second taste quiz<br>to find <em>your</em> beans.', ja: '30秒の好み診断で<br>あなたの<em>豆</em>を見つけます。', zh: '30 秒口味測驗，<br>找出<em>你的</em>豆子。' },
        'quiz.intro': { ko: '질문 네 개, 30초. 답하는 즉시 커피 취향 프로필과 함께 지금 바로 구매할 수 있는 원두를 <strong>무료로</strong> 추천해드립니다.', en: 'Four questions, 30 seconds. As soon as you answer, get your coffee taste profile and <strong>free</strong> bean picks you can buy right now.', ja: '質問4つ、30秒。答えた瞬間、コーヒーの好みプロフィールと、今すぐ買える豆を<strong>無料で</strong>おすすめします。', zh: '四個問題，30 秒。答完立刻給你咖啡口味側寫，並<strong>免費</strong>推薦現在就能買到的豆子。' },
        'te.title': { ko: '눈 감고, 운명의 원두를 만나볼까요?', en: 'Close your eyes — meet your destined bean?', ja: '目を閉じて、運命の豆に出会う？', zh: '閉上眼，遇見命中注定的豆子？' },
        'te.sub': { ko: '지금 마시고 싶은 그 맛을 커피가 먼저 알아맞혀요. 30초 교신, 결과는 친구와 공유.', en: 'The coffee guesses the taste you’re craving right now. A 30-second link-up, share the result with friends.', ja: '今飲みたいその味を、コーヒーが先に当てます。30秒の交信、結果は友だちとシェア。', zh: '你此刻想喝的味道，咖啡先猜中。30 秒心電感應，結果能分享給朋友。' },
        'te.go': { ko: '원두 텔레파시 해보기 →', en: 'Try Bean Telepathy →', ja: '豆テレパシーを試す →', zh: '玩玩看豆子心電感應 →' },
        'te.aria': { ko: '원두 텔레파시 해보기', en: 'Try Bean Telepathy', ja: '豆テレパシーを試す', zh: '玩玩看豆子心電感應' },

        // MID CTA
        'mid.text': { ko: '오늘 내린 한 잔부터 남겨보세요.<br>\n<span>첫 기록은 로그인 없이, 30초면 끝납니다.</span>', en: 'Start with the cup you made today.<br>\n<span>First log needs no sign-in — 30 seconds.</span>', ja: '今日淹れた一杯から残してみませんか。<br>\n<span>最初の記録はログイン不要、30秒で完了。</span>', zh: '就從今天這杯開始記吧。<br>\n<span>第一筆免登入，30 秒搞定。</span>' },

        // FEATURES
        'feat.tag': { ko: '기능', en: 'Features', ja: '機能', zh: '功能' },
        'feat.title': { ko: '기록에 필요한 것만.<br>복잡하지 않다.', en: 'Only what logging needs.<br>Nothing complicated.', ja: '記録に必要なものだけ。<br>複雑じゃない。', zh: '只保留記錄所需。<br>不複雜。' },
        'feat.t1': { ko: '에스프레소 / 핸드드립', en: 'Espresso / Hand drip', ja: 'エスプレッソ / ハンドドリップ', zh: '義式濃縮 / 手沖' },
        'feat.d1': { ko: '감이 아니라 숫자로. SCA 기준 실시간 피드백이 다이얼링을 도와줍니다.', en: 'Numbers, not guesswork. Real-time SCA feedback helps you dial in.', ja: '勘ではなく数字で。SCA基準のリアルタイムフィードバックがダイヤルインを助けます。', zh: '用數字，不靠感覺。依 SCA 的即時回饋幫你調校。' },
        'feat.t2': { ko: '내장 스톱워치', en: 'Built-in stopwatch', ja: '内蔵ストップウォッチ', zh: '內建碼錶' },
        'feat.d2': { ko: '폰 스톱워치를 따로 켤 필요 없이, 추출과 동시에 시간이 기록됩니다.', en: 'No need for a separate phone timer — time is logged as you brew.', ja: 'スマホのタイマーを別に開かず、抽出と同時に時間が記録されます。', zh: '不必另外開手機碼錶，萃取同時就記下時間。' },
        'feat.t3': { ko: '레시피 로그북', en: 'Recipe logbook', ja: 'レシピログブック', zh: '食譜筆記本' },
        'feat.d3': { ko: '원두별·날짜별로 쌓이는 히스토리가 다음 다이얼링의 출발점이 됩니다.', en: 'History stacked by bean and date becomes the starting point for your next dial-in.', ja: '豆別・日付別に貯まる履歴が、次のダイヤルインの出発点になります。', zh: '按豆子與日期累積的歷史，成為下次調校的起點。' },
        'feat.t4': { ko: '어디서든 접속', en: 'Access anywhere', ja: 'どこからでも', zh: '隨處存取' },
        'feat.d4': { ko: '설치 없이 모든 기기에서. 로그인하면 카페 PC에서도 그대로 이어집니다.', en: 'Every device, no install. Sign in and it carries over to the café PC too.', ja: 'インストール不要、どの端末でも。ログインすればカフェのPCでもそのまま続きます。', zh: '免安裝、任何裝置都行。登入後，咖啡館電腦也能接著用。' },

        // COMPARE
        'cmp.tag': { ko: '비교', en: 'Comparison', ja: '比較', zh: '比較' },
        'cmp.title': { ko: '메모장에 적어도<br>되지 <em>않나요</em>.', en: 'Can’t I just<br>use <em>notes</em>?', ja: 'メモ帳でも<br><em>いいのでは</em>？', zh: '用記事本<br><em>不行嗎</em>？' },
        'cmp.p1': { ko: '됩니다. 저도 그렇게 시작했고, <span class="nm">Beanconqueror</span>·<span class="nm">Filtru</span> 같은 전문 기록 앱도 다 써봤습니다. 다들 훌륭하지만 공통의 벽이 하나 있었어요 — 매일 아침 빠르게 남기기엔 손이 많이 간다는 것.', en: 'Sure. I started that way too, and tried pro logging apps like <span class="nm">Beanconqueror</span> and <span class="nm">Filtru</span>. They’re all great, but they share one wall — logging quickly every morning takes too many taps.', ja: 'できます。私もそう始め、<span class="nm">Beanconqueror</span>・<span class="nm">Filtru</span>のような専門アプリも全部使いました。どれも素晴らしいが共通の壁が一つ — 毎朝さっと残すには手間が多い。', zh: '可以。我也是這樣開始的，還用過 <span class="nm">Beanconqueror</span>、<span class="nm">Filtru</span> 這類專業記錄 App。它們都很棒，但有個共同的牆——每天早上要快速記下來，步驟太多。' },
        'cmp.tile1_k': { ko: '채우는 숫자', en: 'Fields to fill', ja: '入力する数字', zh: '要填的數字' },
        'cmp.tile1_u': { ko: '개', en: '', ja: '項目', zh: '項' },
        'cmp.tile1_sub': { ko: '도징·온도·시간·수율', en: 'Dose · temp · time · yield', ja: '分量・温度・時間・収率', zh: '粉量·溫度·時間·萃取率' },
        'cmp.tile2_k': { ko: '추출당 기록', en: 'Per brew', ja: '1杯あたり', zh: '每杯記錄' },
        'cmp.tile2_u': { ko: '초', en: 'sec', ja: '秒', zh: '秒' },
        'cmp.tile2_sub': { ko: '슬라이더 네 번이면 끝', en: 'Four sliders, done', ja: 'スライダー4回で完了', zh: '四個滑桿搞定' },
        'cmp.tile3_k': { ko: '설치·앱스토어', en: 'Install · app store', ja: 'インストール・ストア', zh: '安裝·商店' },
        'cmp.tile3_u': { ko: '단계', en: 'steps', ja: '手順', zh: '步驟' },
        'cmp.tile3_sub': { ko: '웹에서 바로 · 안드로이드·iOS·PC', en: 'Right on the web · Android·iOS·PC', ja: 'ウェブですぐ · Android·iOS·PC', zh: '網頁直接用 · Android·iOS·PC' },
        'cmp.note': { ko: '전문 앱이 10가지 넘는 항목으로 <b>깊이</b>를 준다면, Note My Coffee는 <b>네 개로 매일</b>을 지킵니다. 설치도 로그인 장벽도 없이, 어느 기기에서나 같은 기록으로.', en: 'Where pro apps give <b>depth</b> with 10+ fields, Note My Coffee keeps <b>four, every day</b> — no install, no sign-in wall, the same log on any device.', ja: '専門アプリが10以上の項目で<b>深さ</b>を与えるなら、Note My Coffeeは<b>4つで毎日</b>を守ります。インストールもログインの壁もなく、どの端末でも同じ記録で。', zh: '專業 App 用十幾個欄位給你<b>深度</b>，Note My Coffee 則用<b>四個守住每一天</b>——免安裝、沒有登入門檻，任何裝置都是同一份記錄。' },
        'cmp.p2': { ko: '매일 반복하면 이런 차이가 남습니다.', en: 'Repeat it daily and the difference adds up.', ja: '毎日繰り返すと、こんな差が残ります。', zh: '每天反覆下來，差別就出來了。' },
        'cmp.th_memo': { ko: '메모앱 · 엑셀', en: 'Notes · Excel', ja: 'メモ・Excel', zh: '記事本·Excel' },
        'cmp.r1_h': { ko: '기록 한 건', en: 'One entry', ja: '1件の記録', zh: '一筆記錄' },
        'cmp.r1_m': { ko: '항목 이름까지 매번 타이핑', en: 'Type every field name each time', ja: '毎回項目名まで入力', zh: '每次連欄位名都要打' },
        'cmp.r1_o': { ko: '슬라이더 네 번 — 추출당 30초', en: 'Four sliders — 30s per brew', ja: 'スライダー4回 — 1杯30秒', zh: '四個滑桿 — 每杯 30 秒' },
        'cmp.r2_h': { ko: '값이 적절한지', en: 'Is the value right?', ja: '値が適切か', zh: '數值是否恰當' },
        'cmp.r2_m': { ko: '알 수 없다', en: 'No idea', ja: 'わからない', zh: '無從得知' },
        'cmp.r2_o': { ko: 'SCA 기준 IDEAL 배지가 실시간으로', en: 'Live IDEAL badge by SCA', ja: 'SCA基準でIDEALバッジがリアルタイム', zh: '依 SCA 即時顯示 IDEAL 徽章' },
        'cmp.r3_h': { ko: '추출 비율', en: 'Brew ratio', ja: '抽出比率', zh: '萃取比例' },
        'cmp.r3_m': { ko: '직접 계산', en: 'Compute it yourself', ja: '自分で計算', zh: '自己算' },
        'cmp.r3_o': { ko: '도징·수율에서 자동 계산', en: 'Auto from dose & yield', ja: '分量・収率から自動計算', zh: '由粉量與萃取量自動計算' },
        'cmp.r4_h': { ko: '추출 시간', en: 'Brew time', ja: '抽出時間', zh: '萃取時間' },
        'cmp.r4_m': { ko: '폰 스톱워치를 따로 켠다', en: 'Open your phone’s stopwatch', ja: 'スマホのストップウォッチを別途', zh: '另開手機碼錶' },
        'cmp.r4_o': { ko: '내장 스톱워치 → APPLY 한 번', en: 'Built-in stopwatch → one APPLY', ja: '内蔵ストップウォッチ → APPLY一回', zh: '內建碼錶 → 按一次 APPLY' },
        'cmp.r5_h': { ko: '원두가 바뀐 날', en: 'When beans change', ja: '豆が変わった日', zh: '換豆的那天' },
        'cmp.r5_m': { ko: '지난 파일을 뒤진다', en: 'Dig through old files', ja: '過去のファイルを探す', zh: '翻舊檔案' },
        'cmp.r5_o': { ko: '원두별 로그북에서 성공 세팅 바로', en: 'Winning setting straight from the bean’s logbook', ja: '豆別ログブックから成功設定をすぐ', zh: '從該豆的筆記本直接叫出成功設定' },
        'cmp.r6_h': { ko: '기기가 바뀌면', en: 'On a new device', ja: '端末が変わると', zh: '換裝置時' },
        'cmp.r6_m': { ko: '파일을 옮겨야 한다', en: 'Move the files', ja: 'ファイルを移す', zh: '要搬檔案' },
        'cmp.r6_o': { ko: '같은 계정으로 열면 그대로', en: 'Same account, same data', ja: '同じアカウントで開けばそのまま', zh: '用同一帳號開啟即可' },

        // FAQ
        'faq.tag': { ko: '자주 묻는 질문', en: 'FAQ', ja: 'よくある質問', zh: '常見問題' },
        'faq.title': { ko: '궁금한 것만<br>짧게 <em>답변</em>합니다.', en: 'Quick <em>answers</em><br>to common questions.', ja: '気になる点だけ<br>短く<em>お答え</em>します。', zh: '只針對疑問<br>簡短<em>回答</em>。' },
        'faq.q1': { ko: '정말 무료인가요?', en: 'Is it really free?', ja: '本当に無料ですか？', zh: '真的免費嗎？' },
        'faq.a1_main': { ko: '네. 기록, 로그북, 취향 검사 전부 무료이고 결제 단계가 없습니다.', en: 'Yes. Logging, the logbook and the taste quiz are all free, with no payment step.', ja: 'はい。記録、ログブック、好み診断すべて無料で、決済ステップはありません。', zh: '是的。記錄、筆記本、口味測驗全部免費，沒有付款步驟。' },
        'faq.a1_support': { ko: ' 아래 후원 섹션은 순수한 선택이며, 지금은 토스페이먼츠 테스트 모드라 결제창이 떠도 돈이 빠져나가지 않습니다.', en: ' The support section below is purely optional, and it’s currently in TossPayments test mode — the payment window opens but no money is charged.', ja: ' 下の応援セクションは完全に任意で、今はTossPaymentsのテストモードなので決済画面が出てもお金は引き落とされません。', zh: ' 下面的贊助區塊純屬選用，目前是 TossPayments 測試模式，付款視窗會出現但不會實際扣款。' },
        'faq.q2': { ko: '로그인은 꼭 해야 하나요?', en: 'Do I have to sign in?', ja: 'ログインは必須ですか？', zh: '一定要登入嗎？' },
        'faq.a2': { ko: '첫 레시피 한 개는 로그인 없이 바로 저장됩니다. 두 번째부터 카카오나 구글 로그인이 필요한데, 로그인하는 순간 체험으로 남긴 기록도 계정으로 자동으로 옮겨갑니다. 다시 입력할 필요는 없습니다.', en: 'Your first recipe saves without signing in. From the second, you’ll sign in with Kakao or Google — and the moment you do, the trial log moves into your account automatically. No re-entering.', ja: '最初のレシピ1件はログインなしで保存されます。2件目からKakaoかGoogleのログインが必要ですが、ログインした瞬間お試しの記録も自動でアカウントに移ります。入力し直す必要はありません。', zh: '第一筆食譜免登入就能存。第二筆起需用 Kakao 或 Google 登入，而登入的當下，體驗時的記錄也會自動移進帳號，不必重新輸入。' },
        'faq.q3': { ko: '기록한 데이터는 어디에 저장되나요?', en: 'Where is my data stored?', ja: '記録したデータはどこに保存されますか？', zh: '記錄的資料存在哪裡？' },
        'faq.a3': { ko: '로그인 전에는 지금 쓰는 브라우저 안에만 저장됩니다. 카카오나 구글로 로그인하면 계정에 묶여 저장되고, 휴대폰이든 카페 PC든 같은 계정으로 열면 같은 기록이 그대로 보입니다.', en: 'Before signing in, it’s stored only in the browser you’re using. Sign in with Kakao or Google and it’s tied to your account — open the same account on your phone or a café PC and the same logs are there.', ja: 'ログイン前は今使っているブラウザの中だけに保存されます。KakaoかGoogleでログインするとアカウントに紐づき、スマホでもカフェのPCでも同じアカウントで開けば同じ記録が見えます。', zh: '登入前只存在你正在用的瀏覽器裡。用 Kakao 或 Google 登入後就綁定帳號，不論手機或咖啡館電腦，用同一帳號開啟都看得到同樣的記錄。' },
        'faq.q4': { ko: '앱을 설치해야 하나요?', en: 'Do I need to install an app?', ja: 'アプリのインストールは必要ですか？', zh: '需要安裝 App 嗎？' },
        'faq.a4': { ko: '아니요. 브라우저에서 주소만 열면 바로 씁니다. 원하시면 홈 화면에 추가해 앱처럼 쓸 수 있고, 그렇게 두면 오프라인에서도 열립니다.', en: 'No. Just open the address in your browser and go. If you like, add it to your home screen to use it like an app — then it even opens offline.', ja: 'いいえ。ブラウザで住所を開くだけで使えます。お好みでホーム画面に追加すればアプリのように使え、そうすればオフラインでも開きます。', zh: '不用。在瀏覽器開啟網址就能用。想要的話可加到主畫面像 App 一樣用，這樣連離線也能開。' },

        // FINAL CTA
        'final.title': { ko: '내일은 처음이<br><em>아니게</em>.', en: 'So tomorrow<br>isn’t <em>square one</em>.', ja: '明日は<br><em>最初から</em>じゃなく。', zh: '讓明天<br><em>不再從零</em>。' },
        'final.sub': { ko: '오늘 한 잔만 남겨두면 내일은 어제에서 출발합니다. 30초 · 로그인 없이 · 설치도 결제도 없이.', en: 'Log one cup today and tomorrow starts from yesterday. 30 seconds · no sign-in · no install or payment.', ja: '今日一杯だけ残せば、明日は昨日から始まります。30秒 · ログイン不要 · インストールも決済もなし。', zh: '今天只要記一杯，明天就從昨天出發。30 秒 · 免登入 · 免安裝免付款。' },

        // SUPPORT
        'support.tag': { ko: '후원', en: 'Support', ja: '応援', zh: '贊助' },
        'support.title': { ko: '개발자에게 <em>커피 한 잔</em>.', en: 'Buy the developer <em>a coffee</em>.', ja: '開発者に<em>コーヒー一杯</em>。', zh: '請開發者<em>喝杯咖啡</em>。' },
        'support.p1': { ko: 'Note My Coffee는 지금까지 무료였고, 앞으로도 무료입니다. 그래도 마음이 생기셨다면, 커피 한 잔 값으로 응원해주세요.', en: 'Note My Coffee has been free, and it stays free. If you feel like it, support it with the price of a coffee.', ja: 'Note My Coffeeはこれまで無料で、これからも無料です。それでも気持ちが湧いたら、コーヒー一杯分で応援してください。', zh: 'Note My Coffee 一直免費，往後也免費。若你有這份心意，就用一杯咖啡的價格支持一下吧。' },
        'support.p2': { ko: '아래 결제창은 토스페이먼츠 <strong>샌드박스(테스트 모드)</strong> 데모라 실제 결제창은 뜨지만 <strong>돈은 한 푼도 빠져나가지 않습니다</strong>.', en: 'The checkout below is a TossPayments <strong>sandbox (test mode)</strong> demo — the real payment window opens, but <strong>not a cent is charged</strong>.', ja: '下の決済画面はTossPaymentsの<strong>サンドボックス(テストモード)</strong>デモで、実際の決済画面は出ますが<strong>一円も引き落とされません</strong>。', zh: '下方結帳是 TossPayments <strong>沙盒（測試模式）</strong>示範，真的付款視窗會出現，但<strong>不會扣任何一分錢</strong>。' },
        'support.open': { ko: '테스트 결제 열어보기', en: 'Open the test payment', ja: 'テスト決済を開く', zh: '開啟測試付款' },
        'support.pay_label': { ko: '5,000원 테스트 결제하기', en: 'Test-pay ₩5,000', ja: '5,000ウォンでテスト決済', zh: '測試付款 5,000 韓元' },
        'support.pay_note': { ko: '테스트 모드 · 실제 결제가 발생하지 않습니다', en: 'Test mode · no real payment is charged', ja: 'テストモード · 実際の決済は発生しません', zh: '測試模式 · 不會實際扣款' },

        // FOOTER + STICKY
        'footer.brand': { ko: 'Note My Coffee · 바리스타가 만든 커피 기록 앱', en: 'Note My Coffee · a coffee-logging app built by a barista', ja: 'Note My Coffee · バリスタがつくったコーヒー記録アプリ', zh: 'Note My Coffee · 咖啡師打造的咖啡記錄 App' },
        'footer.cheatsheet': { ko: '다이얼링 치트시트', en: 'Dialing cheat sheet', ja: 'ダイヤルイン チートシート', zh: '調校速查表' },
        'footer.privacy': { ko: '개인정보처리방침', en: 'Privacy policy', ja: 'プライバシーポリシー', zh: '隱私權政策' },
        'footer.contact': { ko: '문의', en: 'Contact', ja: 'お問い合わせ', zh: '聯絡' },
        'sticky.text': { ko: '첫 기록은 로그인 없이<br>30초면 끝납니다.', en: 'First log needs no sign-in —<br>done in 30 seconds.', ja: '最初の記録はログイン不要<br>30秒で完了。', zh: '第一筆記錄免登入<br>30 秒就完成。' },
        'hero.stat_tpl': { ko: '지금까지 기록된 추출 {n}회', en: '{n} brews logged so far', ja: 'これまで記録された抽出 {n}回', zh: '目前已記錄 {n} 次萃取' }
    };

    // ── 취향 검사: 언어 독립 데이터(BASE) + 언어별 텍스트(QT) ──
    // 추천 원두는 한국 로스터리라 이름·검색어·제휴 URL은 고정(고유명사). 설명문만 번역한다.
    var QUIZ_BASE = {
        flavor: { A: [0.95, 0.60, 0.35, 0.20], B: [0.60, 0.75, 0.60, 0.50], C: [0.30, 0.85, 0.70, 0.65], D: [0.15, 0.50, 0.95, 0.95] },
        tags: { A: ['#Floral', '#Fruity', '#Acidic'], B: ['#Sweet', '#Caramel', '#Balanced'], C: ['#Nutty', '#Chocolaty', '#Sweet'], D: ['#Bitter', '#DarkChoco', '#Heavy'] },
        answerKeys: [['A', 'B', 'C', 'D'], ['A', 'B', 'C', 'D'], ['A', 'B', 'C', 'D'], ['A', 'B', 'C', 'D']],
        beans: {
            A: [{ name: '센터커피 싱글 오리진 (에티오피아 아리차)', roaster: '센터커피', query: '센터커피 싱글오리진 원두' },
                { name: '나무사이로 원두', roaster: '나무사이로', query: '나무사이로 원두' },
                { name: '프릳츠 싱글오리진 원두', roaster: '프릳츠커피컴퍼니', query: '프릳츠 싱글오리진 원두' }],
            B: [{ name: '프릳츠 블렌딩 원두', roaster: '프릳츠커피컴퍼니', query: '프릳츠 블렌딩 원두' },
                { name: '필그림 커피로스터스 원두', roaster: '필그림 커피로스터스', query: '필그림 커피 원두' },
                { name: '테라로사 강릉블렌드 원두', roaster: '테라로사', query: '테라로사 강릉블렌드 원두' }],
            C: [{ name: '모모스커피 블렌드 원두', roaster: '모모스커피', query: '모모스커피 블렌드 원두' },
                { name: '폴바셋 시그니처 블렌드', roaster: '폴바셋', query: '폴바셋 원두' },
                { name: '커피리브레 배드블러드 블렌드', roaster: '커피리브레', query: '커피리브레 배드블러드 원두' }],
            D: [{ name: '앤트러사이트 다크 블렌딩 원두', roaster: '앤트러사이트', query: '앤트러사이트 원두' },
                { name: '리사르커피 원두', roaster: '리사르커피', query: '리사르커피 원두' },
                { name: '빈브라더스 다크 블렌드 원두', roaster: '빈브라더스', query: '빈브라더스 원두' }]
        },
        coupangUrl: { A: 'https://link.coupang.com/a/hHbtkCxghU', B: 'https://link.coupang.com/a/hHbu6K1bLU', C: 'https://link.coupang.com/a/hHbwcjZSV2', D: 'https://link.coupang.com/a/hHbw5sLiqO' },
        kurly: function (q) { return 'https://www.kurly.com/search?sword=' + encodeURIComponent(q); },
        naver: function (q) { return 'https://search.naver.com/search.naver?query=' + encodeURIComponent(q); }
    };

    // 언어별 퀴즈 텍스트. 원두 desc는 beans 순서(0,1,2)와 1:1.
    var QT = {
        ko: {
            questions: [
                { q: '평소 가장 당기는 커피는 어떤 쪽인가요?', opts: ['홍차처럼 가볍고 산뜻한 커피', '부드럽고 균형 잡힌 데일리 커피', '고소하고 달큰한, 라떼와 어울리는 커피', '진하고 묵직한, 쓴맛이 살아있는 커피'] },
                { q: '산미(신맛)는 어느 정도가 좋으세요?', opts: ['좋아합니다 — 과일 같은 산미는 매력', '적당하면 좋아요', '거의 없는 편이 좋아요', '산미보다는 쓴맛이 낫습니다'] },
                { q: '끌리는 향미 계열을 골라보세요.', opts: ['꽃향 · 시트러스 · 베리', '캐러멜 · 꿀 · 은은한 과일', '견과 · 밀크초콜릿', '다크초콜릿 · 스모키 · 흙내음'] },
                { q: '주로 어떻게 마시나요?', opts: ['핸드드립 · 필터커피', '그때그때 다르게', '라떼 · 카푸치노 등 우유와 함께', '에스프레소 · 모카포트로 진하게'] }
            ],
            axes: ['산미', '단맛', '바디', '로스팅'],
            resultTag: 'Your Coffee Profile',
            titles: { A: '화사한 향미 탐험가', B: '밸런스의 클래식', C: '고소한 위로 한 잔', D: '묵직한 바디 애호가' },
            descs: {
                A: '꽃향과 과일 산미가 살아있는 라이트 로스팅이 잘 맞는 타입입니다. 핸드드립으로 내리면 향이 가장 잘 피어납니다.',
                B: '단맛·산미·바디가 고르게 잡힌 미디엄 로스팅 취향입니다. 어떤 추출 방식으로도 실패가 적어 데일리 원두로 제격입니다.',
                C: '견과와 초콜릿의 고소한 단맛을 즐기는 타입입니다. 우유와 만나면 더 빛나서 라떼 베이스로 특히 좋습니다.',
                D: '진한 바디와 긴 여운을 사랑하는 타입입니다. 에스프레소나 모카포트로 진하게 내려 그 힘을 그대로 즐겨보세요.'
            },
            beanDescs: {
                A: ['재스민과 복숭아, 홍차 같은 여운 — 서울숲 로스터리의 워시드 에티오피아', '산미 좋은 라이트 로스팅으로 정평난 로스터리의 상시 판매 원두', '서울 대표 로스터리의 화사한 싱글오리진 라인업'],
                B: ["'잘 되어가시나' 등 균형 좋기로 유명한 시그니처 블렌드", '밸런스로 사랑받는 로스터리의 데일리 라인업', '강릉 대표 로스터리의 대표 데일리 블렌드'],
                C: ['월드 바리스타 챔피언을 배출한 부산 로스터리의 블렌드 셀렉션', '우유와 만났을 때 가장 빛나는 고소한 라떼 베이스', '초콜릿과 견과의 단맛으로 유명한 리브레 대표 블렌드'],
                D: ['묵직한 다크 로스팅으로 이름난 로스터리의 다크 블렌드', '나폴리식 진한 에스프레소로 이름난 로스터리의 원두', '진하고 묵직한 바디의 블렌드로 사랑받는 브랜드']
            },
            coupangLabel: { A: '쿠팡에서 산미 좋은 원두 보기', B: '쿠팡에서 데일리 블렌드 보기', C: '쿠팡에서 고소한 원두 보기', D: '쿠팡에서 다크로스트 원두 보기' },
            coupangDisc: '쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.',
            storeKurly: '컬리', storeNaver: '네이버', searchSuffix: ' 검색 →',
            back: '← 이전 질문',
            leadHead: '☕ 취향에 맞는 원두, 계속 받아보시겠어요?',
            leadDesc: '새로 나온 추천 원두와 다이얼링 팁을 이메일로 보내드립니다. 스팸 없이, 언제든 해지할 수 있어요.',
            leadPh: '이메일 주소', leadBtn: '받아보기', leadSending: '보내는 중…',
            leadDone: '✓ 등록됐어요. 좋은 원두 소식이 생기면 보내드릴게요.',
            leadInvalid: '올바른 이메일 주소를 입력해주세요.', leadRetry: '잠시 후 다시 시도해주세요.',
            ctaText: '추천 원두를 받았다면, 첫 추출부터 기록해보세요.<br>이 프로필에 맞는 세팅이 쌓이면 다음 다이얼링이 쉬워집니다.',
            ctaBtn: '무료로 기록 시작하기',
            share: '결과 카드 공유', restart: '다시 검사하기 ↺', shareMaking: '카드 만드는 중…', shareRetry: '다시 시도해주세요',
            note: '각 스토어의 검색 결과로 연결됩니다. 판매처·가격·재고는 그때그때 다를 수 있고, 로스팅 날짜가 가까운 상품을 고르시면 좋습니다.'
        },
        en: {
            questions: [
                { q: 'Which coffee do you reach for most?', opts: ['Light and bright, like black tea', 'Smooth, balanced daily coffee', 'Nutty and sweet, great with milk', 'Bold and heavy, with real bitterness'] },
                { q: 'How much acidity do you like?', opts: ['Love it — fruity acidity is the charm', 'A moderate amount is nice', 'I prefer little to none', 'I’d take bitterness over acidity'] },
                { q: 'Pick the flavors that draw you in.', opts: ['Floral · citrus · berry', 'Caramel · honey · soft fruit', 'Nuts · milk chocolate', 'Dark chocolate · smoky · earthy'] },
                { q: 'How do you usually drink it?', opts: ['Pour-over · filter coffee', 'It varies by the day', 'Latte · cappuccino, with milk', 'Espresso · moka pot, strong'] }
            ],
            axes: ['Acidity', 'Sweetness', 'Body', 'Roast'],
            resultTag: 'Your Coffee Profile',
            titles: { A: 'Bright Flavor Explorer', B: 'The Balanced Classic', C: 'A Cup of Nutty Comfort', D: 'Full-Bodied Devotee' },
            descs: {
                A: 'A light roast with floral aromas and fruity acidity suits you best. Pour-over brings the aromatics out most.',
                B: 'You like a medium roast with sweetness, acidity and body in even balance. Forgiving in any brew method — perfect as a daily bean.',
                C: 'You enjoy the nutty sweetness of nuts and chocolate. It shines even brighter with milk, so it’s great as a latte base.',
                D: 'You love a heavy body and a long finish. Brew it strong with espresso or a moka pot and enjoy that power straight.'
            },
            beanDescs: {
                A: ['Jasmine, peach and a black-tea finish — a washed Ethiopia from the Seoul Forest roaster', 'An everyday bean from a roaster known for bright light roasts', 'A vivid single-origin lineup from a leading Seoul roaster'],
                B: ['A signature blend famous for its fine balance', 'The daily lineup of a roaster loved for balance', 'The flagship daily blend of Gangneung’s leading roaster'],
                C: ['A blend selection from a Busan roaster that produced a World Barista Champion', 'A nutty latte base that shines brightest with milk', 'A flagship blend famous for chocolate-and-nut sweetness'],
                D: ['A dark blend from a roaster known for heavy dark roasts', 'Beans from a roaster famed for Neapolitan-style strong espresso', 'A brand loved for its rich, heavy-bodied blends']
            },
            coupangLabel: { A: 'See bright, acidic beans on Coupang', B: 'See daily blends on Coupang', C: 'See nutty beans on Coupang', D: 'See dark-roast beans on Coupang' },
            coupangDisc: 'As a Coupang Partners affiliate, I may earn a commission from qualifying purchases.',
            storeKurly: 'Kurly', storeNaver: 'Naver', searchSuffix: ' search →',
            back: '← Previous',
            leadHead: '☕ Want bean picks for your taste, on the regular?',
            leadDesc: 'We’ll email new bean recommendations and dialing-in tips. No spam, unsubscribe anytime.',
            leadPh: 'Email address', leadBtn: 'Subscribe', leadSending: 'Sending…',
            leadDone: '✓ You’re in. We’ll send good bean news when it comes up.',
            leadInvalid: 'Please enter a valid email address.', leadRetry: 'Please try again in a moment.',
            ctaText: 'Got your bean picks? Log from the very first brew.<br>As settings for this profile stack up, the next dial-in gets easier.',
            ctaBtn: 'Start logging free',
            share: 'Share result card', restart: 'Retake ↺', shareMaking: 'Making card…', shareRetry: 'Please try again',
            note: 'Links go to each store’s search results. Sellers, prices and stock vary over time — pick items with a recent roast date.'
        },
        ja: {
            questions: [
                { q: '普段いちばん飲みたくなるコーヒーは？', opts: ['紅茶のように軽くて爽やかなコーヒー', 'まろやかでバランスの良いデイリーコーヒー', '香ばしく甘い、ラテに合うコーヒー', '濃く重厚で、苦味が効いたコーヒー'] },
                { q: '酸味はどのくらいが好き？', opts: ['好き — フルーツのような酸味が魅力', '適度ならうれしい', 'ほとんど無いほうがいい', '酸味より苦味がいい'] },
                { q: '惹かれる風味の系統を選んでください。', opts: ['花香 · シトラス · ベリー', 'キャラメル · はちみつ · ほのかな果実', 'ナッツ · ミルクチョコ', 'ダークチョコ · スモーキー · 土の香り'] },
                { q: '主にどうやって飲みますか？', opts: ['ハンドドリップ · フィルターコーヒー', 'その時々で違う', 'ラテ · カプチーノなど牛乳と一緒に', 'エスプレッソ · モカポットで濃く'] }
            ],
            axes: ['酸味', '甘み', 'ボディ', '焙煎'],
            resultTag: 'Your Coffee Profile',
            titles: { A: '華やかな風味の探求者', B: 'バランスのクラシック', C: '香ばしい癒やしの一杯', D: '重厚ボディの愛好家' },
            descs: {
                A: '花の香りと果実の酸味が生きるライトローストが合うタイプ。ハンドドリップで淹れると香りが最もよく開きます。',
                B: '甘み・酸味・ボディが均等に整ったミディアムロースト好み。どの抽出でも失敗が少なく、デイリー豆に最適です。',
                C: 'ナッツとチョコの香ばしい甘みを楽しむタイプ。牛乳と合わせるとさらに映え、ラテベースに特に向きます。',
                D: '濃いボディと長い余韻を愛するタイプ。エスプレッソやモカポットで濃く淹れて、その力をそのまま楽しんで。'
            },
            beanDescs: {
                A: ['ジャスミンと桃、紅茶のような余韻 — ソウルの森のロースターのウォッシュド・エチオピア', '明るいライトローストで定評あるロースターの定番豆', 'ソウルを代表するロースターの華やかなシングルオリジン'],
                B: ['バランスの良さで有名なシグネチャーブレンド', 'バランスで愛されるロースターのデイリー', '江陵を代表するロースターの看板デイリーブレンド'],
                C: ['ワールドバリスタチャンピオンを輩出した釜山ロースターのブレンド', '牛乳と合わせて最も映える香ばしいラテベース', 'チョコとナッツの甘みで有名な看板ブレンド'],
                D: ['重厚なダークローストで知られるロースターのダークブレンド', 'ナポリ式の濃いエスプレッソで知られるロースターの豆', '濃く重厚なボディのブレンドで愛されるブランド']
            },
            coupangLabel: { A: 'Coupangで酸味系の豆を見る', B: 'Coupangでデイリーブレンドを見る', C: 'Coupangで香ばしい豆を見る', D: 'Coupangでダークロースト豆を見る' },
            coupangDisc: 'Coupangパートナーズ活動の一環として、これに応じた一定額の手数料を受け取る場合があります。',
            storeKurly: 'Kurly', storeNaver: 'Naver', searchSuffix: ' 検索 →',
            back: '← 前の質問',
            leadHead: '☕ 好みに合う豆を、これからも受け取りますか？',
            leadDesc: '新しいおすすめ豆とダイヤルインのコツをメールでお届けします。スパムなし、いつでも解除できます。',
            leadPh: 'メールアドレス', leadBtn: '受け取る', leadSending: '送信中…',
            leadDone: '✓ 登録しました。良い豆の便りがあればお送りします。',
            leadInvalid: '正しいメールアドレスを入力してください。', leadRetry: 'しばらくして再度お試しください。',
            ctaText: 'おすすめ豆を受け取ったら、最初の抽出から記録してみましょう。<br>このプロフィールに合う設定が貯まれば、次のダイヤルインが楽になります。',
            ctaBtn: '無料で記録を始める',
            share: '結果カードをシェア', restart: 'もう一度 ↺', shareMaking: 'カード作成中…', shareRetry: 'もう一度お試しください',
            note: '各ストアの検索結果に移動します。販売元・価格・在庫は変わることがあり、焙煎日の新しい商品を選ぶのがおすすめです。'
        },
        zh: {
            questions: [
                { q: '平常最想喝哪一類咖啡？', opts: ['像紅茶般輕盈清爽', '順口均衡的日常咖啡', '香醇微甜、適合搭牛奶', '濃厚、帶明顯苦味'] },
                { q: '你喜歡多少酸度？', opts: ['喜歡 — 果酸很迷人', '適中就好', '幾乎不要', '比起酸，寧可苦'] },
                { q: '挑出吸引你的風味。', opts: ['花香 · 柑橘 · 莓果', '焦糖 · 蜂蜜 · 淡淡果香', '堅果 · 牛奶巧克力', '黑巧克力 · 煙燻 · 泥土氣息'] },
                { q: '你平常怎麼喝？', opts: ['手沖 · 濾泡咖啡', '隨當天心情', '拿鐵 · 卡布等加牛奶', '義式濃縮 · 摩卡壺，濃一點'] }
            ],
            axes: ['酸度', '甜感', '醇厚度', '烘焙'],
            resultTag: 'Your Coffee Profile',
            titles: { A: '明亮風味探險家', B: '均衡的經典派', C: '香醇療癒一杯', D: '厚實醇厚愛好者' },
            descs: {
                A: '適合花香與果酸鮮明的淺焙。用手沖沖煮，香氣最能綻放。',
                B: '偏好甜、酸、醇厚度均衡的中焙。任何沖煮方式都不易失手，很適合當日常豆。',
                C: '喜歡堅果與巧克力的香甜。遇上牛奶更出色，特別適合當拿鐵基底。',
                D: '鍾愛厚實醇厚與悠長餘韻。用義式濃縮或摩卡壺濃濃沖煮，直接享受那股力道吧。'
            },
            beanDescs: {
                A: ['茉莉、水蜜桃與紅茶般的餘韻 — 首爾林間烘豆商的水洗衣索比亞', '以明亮淺焙著稱烘豆商的常售豆', '首爾代表性烘豆商的明亮單品系列'],
                B: ['以均衡聞名的招牌配方豆', '以均衡受喜愛的烘豆商日常系列', '江陵代表烘豆商的招牌日常配方'],
                C: ['孕育世界咖啡師冠軍的釜山烘豆商配方精選', '遇上牛奶最出色的香醇拿鐵基底', '以巧克力與堅果甜感聞名的招牌配方'],
                D: ['以厚重深焙聞名烘豆商的深焙配方', '以拿坡里式濃縮聞名烘豆商的豆子', '以濃厚醇body配方受喜愛的品牌']
            },
            coupangLabel: { A: '在 Coupang 看明亮果酸豆', B: '在 Coupang 看日常配方', C: '在 Coupang 看香醇豆', D: '在 Coupang 看深焙豆' },
            coupangDisc: '作為 Coupang Partners 夥伴，我可能從符合條件的購買中賺取一定佣金。',
            storeKurly: 'Kurly', storeNaver: 'Naver', searchSuffix: ' 搜尋 →',
            back: '← 上一題',
            leadHead: '☕ 想持續收到適合你口味的豆子推薦嗎？',
            leadDesc: '我們會用 email 寄給你新的推薦豆與調校小技巧。沒有垃圾信，隨時可取消。',
            leadPh: '電子郵件', leadBtn: '訂閱', leadSending: '寄送中…',
            leadDone: '✓ 已訂閱。有好豆消息就寄給你。',
            leadInvalid: '請輸入正確的電子郵件。', leadRetry: '請稍後再試。',
            ctaText: '拿到推薦豆後，就從第一次萃取開始記錄吧。<br>符合這個側寫的設定累積起來，下次調校就更輕鬆。',
            ctaBtn: '免費開始記錄',
            share: '分享結果卡', restart: '重新測驗 ↺', shareMaking: '製作卡片中…', shareRetry: '請再試一次',
            note: '連結會前往各商店的搜尋結果。賣家、價格與庫存可能隨時不同，建議挑選烘焙日期較近的商品。'
        }
    };

    // BASE + 언어 텍스트를 합쳐 '현재 언어의 완성된 퀴즈 객체'를 만든다(인라인 퀴즈가 읽음).
    function buildQuiz(l) {
        var T = QT[l] || QT.en;
        var B = QUIZ_BASE;
        var questions = T.questions.map(function (qq, qi) {
            return { q: qq.q, opts: qq.opts.map(function (txt, oi) { return [txt, B.answerKeys[qi][oi]]; }) };
        });
        var results = {};
        ['A', 'B', 'C', 'D'].forEach(function (k) {
            results[k] = {
                title: T.titles[k], desc: T.descs[k], tags: B.tags[k], flavor: B.flavor[k],
                beans: B.beans[k].map(function (bn, i) {
                    return { name: bn.name, roaster: bn.roaster, query: bn.query, desc: T.beanDescs[k][i] };
                })
            };
        });
        var stores = [
            { store: T.storeKurly, url: B.kurly },
            { store: T.storeNaver, url: B.naver }
        ];
        var coupang = {};
        ['A', 'B', 'C', 'D'].forEach(function (k) { coupang[k] = { url: B.coupangUrl[k], label: T.coupangLabel[k] }; });
        return {
            questions: questions, axes: T.axes, resultTag: T.resultTag, results: results,
            stores: stores, searchSuffix: T.searchSuffix, coupang: coupang, coupangDisc: T.coupangDisc,
            back: T.back,
            lead: { head: T.leadHead, desc: T.leadDesc, ph: T.leadPh, btn: T.leadBtn, sending: T.leadSending, done: T.leadDone, invalid: T.leadInvalid, retry: T.leadRetry },
            cta: { text: T.ctaText, btn: T.ctaBtn },
            ui: { share: T.share, restart: T.restart, note: T.note, shareMaking: T.shareMaking, shareRetry: T.shareRetry }
        };
    }

    var lang = detect();
    lsSet('nmcLang', lang); // 랜딩에서 정한 언어를 앱까지 잇는다

    function t(key) { var m = P[key]; return m ? (m[lang] != null ? m[lang] : (m.en || m.ko)) : null; }

    // 전역 노출 — 인라인 퀴즈 스크립트 + landing.js가 읽는다.
    window.NMC = {
        get lang() { return lang; },
        t: t,
        quiz: function () { return buildQuiz(lang); }
    };

    function apply(l) {
        lang = l;
        try {
            document.documentElement.setAttribute('lang', l === 'ja' ? 'ja' : (l === 'zh' ? 'zh-Hant' : (l === 'ko' ? 'ko' : 'en')));
        } catch (e) { /* no-op */ }
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var v = P[el.getAttribute('data-i18n')]; if (v && v[l] != null) el.innerHTML = v[l];
        });
        document.querySelectorAll('[data-i18n-text]').forEach(function (el) {
            var v = P[el.getAttribute('data-i18n-text')]; if (v && v[l] != null) el.textContent = v[l];
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
            var v = P[el.getAttribute('data-i18n-ph')]; if (v && v[l] != null) el.setAttribute('placeholder', v[l]);
        });
        document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
            var v = P[el.getAttribute('data-i18n-aria')]; if (v && v[l] != null) el.setAttribute('aria-label', v[l]);
        });
        // 비교표는 좁은 화면에서 data-label을 열 머리글로 보여준다(CSS ::before).
        document.querySelectorAll('[data-i18n-dlabel]').forEach(function (el) {
            var v = P[el.getAttribute('data-i18n-dlabel')]; if (v && v[l] != null) el.setAttribute('data-label', v[l]);
        });
    }

    function setActive(l) {
        LANGS.forEach(function (x) {
            var b = document.getElementById('ll-' + x);
            if (b) b.classList.toggle('active', x === l);
        });
    }

    function wire() {
        apply(lang);
        setActive(lang);
        LANGS.forEach(function (x) {
            var b = document.getElementById('ll-' + x);
            if (!b) return;
            b.addEventListener('click', function () {
                if (x === lang) return;
                lsSet('nmcLang', x);
                apply(x);
                setActive(x);
                // 인라인 퀴즈 등 다른 부분도 같은 언어로 다시 그리게 알린다.
                try { window.dispatchEvent(new CustomEvent('nmc-lang-change', { detail: { lang: x } })); } catch (e) { /* no-op */ }
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
    else wire();
})();
