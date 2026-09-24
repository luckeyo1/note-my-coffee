// 하단 탭바 + 설정 시트 — app.html / logbook.html 공용.
// ES 모듈이 아니라 일반 스크립트다(외부 의존 없음). 설정 시트의 버튼은 새 로직을
// 만들지 않고, 페이지에 이미 있는 헤더 컨트롤(#l-ko, #btn-login 등)을 대신 클릭한다.
(function () {
    'use strict';

    function init() {
        // 현재 페이지에 맞는 탭을 활성화
        var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        var page = path.indexOf('logbook') !== -1 ? 'log' : 'brew';
        document.querySelectorAll('.tab-item[data-tab]').forEach(function (el) {
            el.classList.toggle('is-active', el.getAttribute('data-tab') === page);
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
                if (proxy !== 'l-ko' && proxy !== 'l-en') close();
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
