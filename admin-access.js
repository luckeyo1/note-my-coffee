// admin-access.js — 관리자 판정. 관리자 페이지(admin.js)와 앱의 진입 링크(admin-entry.js)가
// 같은 기준을 쓰도록 한곳에 둔다.
//
// ⚠️ 이 판정은 화면을 가리는 용도일 뿐 보안 장치가 아니다. 클라이언트 코드는 누구나
// 읽고 고칠 수 있다. 실제 차단은 Firestore 보안 규칙의 isAdmin()이 한다.
// 관리자를 추가하려면 이 배열과 firestore.rules의 isAdmin() **양쪽 모두**에 넣는다
// (ADMIN.md 참고).
export const ADMIN_EMAILS = [
    'qorlgh1994@gmail.com',
];

// 구글 로그인만 인정한다. 이메일/비밀번호 계정은 같은 주소를 스스로 지어낼 수 있고,
// 그 경우 emailVerified가 false로 남는다. 카카오는 이메일을 받지 않아 대조가 성립하지 않는다.
export function isAdminUser(user) {
    return !!user
        && !!user.emailVerified
        && Array.isArray(user.providerData)
        && user.providerData.some((p) => p && p.providerId === 'google.com')
        && ADMIN_EMAILS.includes((user.email || '').toLowerCase());
}
