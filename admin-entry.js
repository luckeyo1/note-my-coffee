// admin-entry.js — 관리자 계정으로 로그인했을 때만 설정 시트의 '관리자 페이지' 링크를 보인다.
//
// 링크([data-admin-link])는 각 페이지 마크업에 hidden으로 들어 있고, 여기서 로그인 상태가
// 바뀔 때마다 다시 판정한다. 판정 기준은 관리자 페이지와 같은 admin-access.js다.
// 링크를 보이는 건 화면 편의일 뿐이고, 관리자 페이지의 데이터 접근은 Firestore 규칙이 막는다.
// firebase-config.js는 페이지 본 스크립트가 이미 불러온 모듈이라 추가 초기화가 없다.
import { auth, onAuthStateChanged } from './firebase-config.js';
import { isAdminUser } from './admin-access.js';

function syncAdminLinks(user) {
    const show = isAdminUser(user);
    document.querySelectorAll('[data-admin-link]').forEach((link) => {
        link.hidden = !show;
    });
}

syncAdminLinks(auth.currentUser);
onAuthStateChanged(auth, syncAdminLinks);
