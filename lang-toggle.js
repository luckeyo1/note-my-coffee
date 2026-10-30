// lang-toggle.js — 커뮤니티/서브 페이지(discover/profile/post) 공용 언어 토글 배선.
//
// app.html·logbook.html은 자체 setLang으로 콘텐츠를 다시 그리지만, 커뮤니티 페이지는
// 렌더 함수만 있으면 되므로 토글 배선을 여기 모은다. 페이지는 콘텐츠를 현재 언어로
// 다시 그리는 onChange(lang)만 넘기면 된다. 이 모듈이:
//   · 헤더 토글 + 설정 시트 세그(둘 다 #l-ko/#l-en/#l-ja/#l-zh 버튼)를 배선하고
//   · 선택을 기기에 저장(storage.js)하고
//   · 공용 크롬(탭바·설정 시트)·푸시 버튼이 따라오도록 'nmc-lang-change'를 쏜다.
//
// onChange가 던지면(테스트 못 하는 렌더 경로의 안전망) 통째로 새로고침해서라도
// 선택한 언어가 반영되게 한다 — 저장은 이미 끝났으므로 새로고침이 올바른 언어로 뜬다.
import { loadLang, saveLang } from "./storage.js";

const LANGS = ['en', 'ko', 'ja', 'zh'];

export function initLangToggle(onChange) {
    function setActive(cur) {
        LANGS.forEach((l) => {
            const b = document.getElementById('l-' + l);
            if (b) b.classList.toggle('active', l === cur);
        });
    }

    setActive(loadLang());

    LANGS.forEach((l) => {
        const btn = document.getElementById('l-' + l);
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (l === loadLang()) return;
            saveLang(l);
            setActive(l);
            let ok = true;
            try {
                if (typeof onChange === 'function') onChange(l);
            } catch (e) {
                console.warn('[lang] 콘텐츠 재렌더 실패 — 새로고침으로 적용', e);
                ok = false;
                location.reload();
            }
            // 공용 크롬·푸시 버튼도 같은 언어로.
            if (ok) {
                try { window.dispatchEvent(new CustomEvent('nmc-lang-change', { detail: { lang: l } })); } catch (e) { /* no-op */ }
            }
        });
    });
}
