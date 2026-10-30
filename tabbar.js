// 하단 탭바 + 설정 시트 — 모든 페이지 공용(app/discover/logbook/post/profile).
// ES 모듈이 아니라 일반 스크립트다(외부 의존 없음). 설정 시트의 버튼은 새 로직을
// 만들지 않고, 페이지에 이미 있는 헤더 컨트롤(#l-ko, #btn-login 등)을 대신 클릭한다.
//
// 언어: 탭바·설정 시트 라벨은 전 페이지 공용이라 번역을 여기 한곳에 두고, 저장된
// 언어(localStorage 'nmcLang')에 맞춰 그린다. 페이지가 언어를 바꾸면 window에
// 'nmc-lang-change'(detail.lang) 이벤트를 쏘고(main.js·logbook.js·커뮤니티 JS),
// 여기서 받아 즉시 다시 칠한다. 일반 스크립트라 storage.js를 import할 수 없어
// 키·폴백('en')을 loadLang과 똑같이 맞춰 직접 읽는다 — 갈라지면 콘텐츠와 크롬
// 언어가 어긋난다.
(function () {
    'use strict';

    var LANGS = ['en', 'ko', 'ja', 'zh'];

    // 공용 크롬 번역. 언어 세그 버튼(KO/EN/日本語/繁中)은 언어명 그 자체라 번역하지 않고,
    // 푸시 옵트인 버튼(data-push-optin)은 push.js가 자기 번역으로 관리하므로 건드리지 않는다.
    var I18N = {
        tab_brew:     { ko: '추출', en: 'Brew', ja: '抽出', zh: '萃取' },
        tab_discover: { ko: '둘러보기', en: 'Discover', ja: '発見', zh: '探索' },
        tab_log:      { ko: '기록', en: 'Log', ja: '記録', zh: '紀錄' },
        tab_settings: { ko: '설정', en: 'Settings', ja: '設定', zh: '設定' },
        set_title:    { ko: '설정', en: 'Settings', ja: '設定', zh: '設定' },
        set_lang:     { ko: '언어', en: 'Language', ja: '言語', zh: '語言' },
        set_help:     { ko: '서비스 가이드', en: 'Service guide', ja: 'サービスガイド', zh: '服務指南' },
        set_profile:  { ko: '내 프로필', en: 'My profile', ja: 'マイプロフィール', zh: '我的檔案' },
        set_login:    { ko: '로그인', en: 'Sign in', ja: 'ログイン', zh: '登入' },
        set_logout:   { ko: '로그아웃', en: 'Sign out', ja: 'ログアウト', zh: '登出' },
        set_delete:   { ko: '계정 · 데이터 삭제', en: 'Delete account & data', ja: 'アカウント・データ削除', zh: '刪除帳號・資料' },
        set_home:     { ko: '홈으로', en: 'Home', ja: 'ホームへ', zh: '回首頁' },
        set_close:    { ko: '닫기', en: 'Close', ja: '閉じる', zh: '關閉' }
    };

    function norm(lang) { return LANGS.indexOf(lang) !== -1 ? lang : 'en'; }

    function curLang() {
        try {
            var v = localStorage.getItem('nmcLang');
            return LANGS.indexOf(v) !== -1 ? v : 'en';
        } catch (e) { return 'en'; }
    }

    function T(key, lang) { var m = I18N[key]; return (m && (m[lang] || m.en)) || ''; }

    function put(root, sel, txt) {
        var e = root.querySelector(sel);
        if (e && txt) e.textContent = txt;
    }

    // 탭바 + 설정 시트 라벨을 주어진 언어로 다시 그린다.
    function applyLang(lang) {
        lang = norm(lang);
        put(document, '.tab-item[data-tab="brew"] span', T('tab_brew', lang));
        put(document, '.tab-item[data-tab="discover"] span', T('tab_discover', lang));
        put(document, '.tab-item[data-tab="log"] span', T('tab_log', lang));
        put(document, '.tab-item[data-tab="settings"] span', T('tab_settings', lang));

        var sheet = document.getElementById('settings-sheet');
        if (sheet) {
            put(sheet, '.settings-sheet-title', T('set_title', lang));
            var langRow = sheet.querySelector('.settings-row > span');
            if (langRow) langRow.textContent = T('set_lang', lang);
            put(sheet, '[data-proxy="btn-help"]', T('set_help', lang));
            put(sheet, 'a[href="profile.html"]', T('set_profile', lang));
            put(sheet, '[data-proxy="btn-login"]', T('set_login', lang));
            put(sheet, '[data-proxy="btn-logout"]', T('set_logout', lang));
            put(sheet, 'a[href="delete-account.html"]', T('set_delete', lang));
            put(sheet, 'a[href="index.html"]', T('set_home', lang));
            put(sheet, '.settings-sheet-close', T('set_close', lang));
        }
    }

    function init() {
        // 현재 페이지에 맞는 탭을 활성화
        var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        var page = 'brew';
        if (path.indexOf('logbook') !== -1) page = 'log';
        else if (path.indexOf('discover') !== -1 || path.indexOf('post') !== -1 || path.indexOf('profile') !== -1) page = 'discover';
        document.querySelectorAll('.tab-item[data-tab]').forEach(function (el) {
            el.classList.toggle('is-active', el.getAttribute('data-tab') === page);
        });

        // 저장된 언어로 공용 크롬을 먼저 칠하고, 이후 언어가 바뀌면 즉시 따라 칠한다.
        applyLang(curLang());
        window.addEventListener('nmc-lang-change', function (e) {
            applyLang((e && e.detail && e.detail.lang) || curLang());
        });

        var sheet = document.getElementById('settings-sheet');
        if (!sheet) return;
        var openBtn = document.getElementById('tab-settings-btn');
        var closeBtn = document.getElementById('settings-sheet-close');

        // 로그인/로그아웃 항목은 헤더의 실제 인증 상태를 그대로 비춘다.
        function syncAuth() {
            var prof = document.getElementById('user-profile');
            var loggedIn = !!(prof && prof.style.display !== 'none' && prof.offsetParent !== null);
            var login = sheet.querySelector('[data-proxy="btn-login"]');
            var logout = sheet.querySelector('[data-proxy="btn-logout"]');
            if (login) login.style.display = (document.getElementById('btn-login') && !loggedIn) ? '' : 'none';
            if (logout) logout.style.display = (document.getElementById('btn-logout') && loggedIn) ? '' : 'none';
        }
        function open() { syncAuth(); sheet.hidden = false; }
        function close() { sheet.hidden = true; }

        if (openBtn) openBtn.addEventListener('click', open);
        if (closeBtn) closeBtn.addEventListener('click', close);
        sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });

        // 위임 버튼: 이 페이지에 대상 컨트롤이 있으면 그 버튼을 대신 클릭한다.
        // 대상이 없으면(예: 로그북엔 로그인 버튼이 없다) 항목 자체를 숨긴다.
        sheet.querySelectorAll('[data-proxy]').forEach(function (el) {
            var proxy = el.getAttribute('data-proxy');
            var target = document.getElementById(proxy);
            if (!target) { el.style.display = 'none'; return; }
            el.addEventListener('click', function () {
                target.click();
                // 언어 토글은 시트를 열어둔 채로, 나머지 동작은 시트를 닫는다.
                if (proxy !== 'l-ko' && proxy !== 'l-en' && proxy !== 'l-ja' && proxy !== 'l-zh') close();
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
