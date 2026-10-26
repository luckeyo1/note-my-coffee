// Firestore 보안 규칙 검증 — firestore.rules를 에뮬레이터에 올려 §8/§9/§12 시나리오를 확인.
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where,
  writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const PROJECT = 'demo-nmc';
const ADMIN_EMAIL = 'qorlgh1994@gmail.com';

let pass = 0, fail = 0;
const results = [];
async function check(name, p) {
  try { await p; results.push(`PASS  ${name}`); pass++; }
  catch (e) { results.push(`FAIL  ${name} — ${e.message || e}`); fail++; }
}

const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
});

// 컨텍스트들
const owner = env.authenticatedContext('owner1').firestore();
const other = env.authenticatedContext('other1').firestore();
const anon = env.unauthenticatedContext().firestore();
const admin = env.authenticatedContext('adminuid', {
  email: ADMIN_EMAIL, email_verified: true, firebase: { sign_in_provider: 'google.com' },
}).firestore();

// 시드 데이터: 규칙을 우회해 문서를 심는다(withSecurityRulesDisabled).
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'posts/pub1'),  { ownerId: 'owner1', visibility: 'public',   status: 'active', hiddenByAdmin: false, title: 'pub',  method: 'espresso' });
  await setDoc(doc(db, 'posts/unl1'),  { ownerId: 'owner1', visibility: 'unlisted', status: 'active', hiddenByAdmin: false, title: 'unl',  method: 'espresso' });
  await setDoc(doc(db, 'posts/prv1'),  { ownerId: 'owner1', visibility: 'private',  status: 'active', hiddenByAdmin: false, title: 'prv',  method: 'espresso' });
  await setDoc(doc(db, 'posts/hid1'),  { ownerId: 'owner1', visibility: 'public',   status: 'hidden', hiddenByAdmin: true,  title: 'hid',  method: 'espresso' });
  await setDoc(doc(db, 'recipes/r1'),  { userId: 'owner1', beanName: 'x' });
  await setDoc(doc(db, 'profiles/owner1'), { displayName: '모닝브루', bio: 'hi' });
  await setDoc(doc(db, 'users/owner1'), { email: 'o@x.com' });
});

const P = (db, id) => doc(db, 'posts/' + id);
const validNew = (over = {}) => ({ ownerId: 'owner1', visibility: 'public', status: 'active', hiddenByAdmin: false, title: 't', method: 'espresso', ...over });

// ── posts get ──
await check('공개+활성 게시물: 비로그인도 읽기 가능(get)', assertSucceeds(getDoc(P(anon, 'pub1'))));
await check('unlisted+활성: id 알면 읽기 가능(get)',        assertSucceeds(getDoc(P(anon, 'unl1'))));
await check('비공개: 비소유자 읽기 거부(§8)',               assertFails(getDoc(P(other, 'prv1'))));
await check('비공개: 소유자 본인은 읽기 가능',               assertSucceeds(getDoc(P(owner, 'prv1'))));
await check('비공개: 관리자 읽기 가능',                      assertSucceeds(getDoc(P(admin, 'prv1'))));

// ── posts list (피드/열거) ──
const qPublic = query(collection(anon, 'posts'), where('visibility', '==', 'public'), where('status', '==', 'active'));
await check('피드: public+active 열거 허용',                assertSucceeds(getDocs(qPublic)));
const qUnlisted = query(collection(anon, 'posts'), where('visibility', '==', 'unlisted'));
await check('unlisted 열거 거부(피드로 못 긁음)',           assertFails(getDocs(qUnlisted)));
const qAll = query(collection(anon, 'posts'));
await check('전체 열거 거부(비공개 섞임)',                   assertFails(getDocs(qAll)));
const qMine = query(collection(owner, 'posts'), where('ownerId', '==', 'owner1'));
await check('내 게시물 열거(ownerId==uid) 허용',            assertSucceeds(getDocs(qMine)));

// ── posts create ──
await check('게시 생성: 로그인+본인 ownerId 허용',          assertSucceeds(setDoc(P(owner, 'new_ok'), validNew())));
await check('게시 생성: ownerId 위조 거부',                 assertFails(setDoc(P(owner, 'new_bad'), validNew({ ownerId: 'someoneelse' }))));
await check('게시 생성: hiddenByAdmin=true 거부',           assertFails(setDoc(P(owner, 'new_bad2'), validNew({ hiddenByAdmin: true }))));
await check('게시 생성: 비로그인 거부',                      assertFails(setDoc(P(anon, 'new_bad3'), validNew())));
await check('게시 생성: title 120자 초과 거부',             assertFails(setDoc(P(owner, 'new_bad4'), validNew({ title: 'a'.repeat(121) }))));

// ── posts update/delete ──
await check('수정: 소유자 제목 변경 허용',                  assertSucceeds(updateDoc(P(owner, 'pub1'), { title: 'new' })));
await check('수정: 비소유자 거부',                          assertFails(updateDoc(P(other, 'pub1'), { title: 'hack' })));
await check('수정: ownerId 변경 거부',                      assertFails(updateDoc(P(owner, 'pub1'), { ownerId: 'other1' })));
await check('수정: hiddenByAdmin 스스로 토글 거부(§9)',     assertFails(updateDoc(P(owner, 'pub1'), { hiddenByAdmin: true })));
await check('수정: 관리자숨김 상태를 active로 되돌리기 거부(§9)', assertFails(updateDoc(P(owner, 'hid1'), { status: 'active' })));
await check('관리자: 숨김 해제/상태 변경 허용',             assertSucceeds(updateDoc(P(admin, 'pub1'), { status: 'hidden' })));
await check('삭제: 비소유자 거부',                          assertFails(deleteDoc(P(other, 'pub1'))));
await check('삭제: 소유자 허용',                            assertSucceeds(deleteDoc(P(owner, 'unl1'))));

// ── reports ──
await check('신고: 로그인 사용자 생성 허용',                assertSucceeds(setDoc(doc(other, 'reports/rep1'), { reporterId: 'other1', targetPostId: 'pub1', reason: 'spam' })));
await check('신고: reporterId 위조 거부',                   assertFails(setDoc(doc(other, 'reports/rep2'), { reporterId: 'owner1', targetPostId: 'pub1', reason: 'x' })));
await check('신고: 비관리자 열람 거부',                     assertFails(getDoc(doc(other, 'reports/rep1'))));
await check('신고: 관리자 열람 허용',                       assertSucceeds(getDoc(doc(admin, 'reports/rep1'))));

// ── blocks ──
await check('차단목록: 본인 쓰기 허용',                     assertSucceeds(setDoc(doc(owner, 'blocks/owner1/blocked/x'), { at: 1 })));
await check('차단목록: 타인 읽기 거부',                     assertFails(getDoc(doc(other, 'blocks/owner1/blocked/x'))));

// ── profiles ──
await check('프로필: 누구나 읽기 가능(공개)',              assertSucceeds(getDoc(doc(anon, 'profiles/owner1'))));
await check('프로필: 본인 쓰기 허용',                       assertSucceeds(setDoc(doc(owner, 'profiles/owner1'), { displayName: '새닉', bio: 'b' })));
await check('프로필: 타인 쓰기 거부',                       assertFails(setDoc(doc(other, 'profiles/owner1'), { displayName: 'hack' })));
await check('프로필: displayName 40자 초과 거부',          assertFails(setDoc(doc(owner, 'profiles/owner1'), { displayName: 'x'.repeat(41) })));
await check('프로필: bio 200자 초과 거부',                 assertFails(setDoc(doc(owner, 'profiles/owner1'), { bio: 'x'.repeat(201) })));

// ── recipes (기존, 회귀) ──
await check('내 기록: 소유자 읽기 허용',                    assertSucceeds(getDoc(doc(owner, 'recipes/r1'))));
await check('내 기록: 타인 읽기 거부(기존 보안 유지)',      assertFails(getDoc(doc(other, 'recipes/r1'))));
await check('users(이메일): 타인 읽기 거부',               assertFails(getDoc(doc(other, 'users/owner1'))));

// ── 워치 연결 (docs/wearable.md) ──
// 워치는 익명 로그인, 웹 사용자는 실제 제공자(google)로 로그인한다.
const ANON = { firebase: { sign_in_provider: 'anonymous' } };
const GOOGLE = { firebase: { sign_in_provider: 'google.com' } };
const watch = env.authenticatedContext('watch1', ANON).firestore();
const watch2 = env.authenticatedContext('watch2', ANON).firestore();
const webOwner = env.authenticatedContext('owner1', GOOGLE).firestore();
const webOther = env.authenticatedContext('other1', GOOGLE).firestore();
const anonUser = env.authenticatedContext('anonweb', ANON).firestore();

await env.withSecurityRulesDisabled(async (ctx) => {
  // 만료된 코드(20분 전 생성)
  await setDoc(doc(ctx.firestore(), 'watchPairs/999999'),
    { watchUid: 'watch2', createdAt: Timestamp.fromMillis(Date.now() - 20 * 60 * 1000) });
});

const pairNew = (uid) => ({ watchUid: uid, createdAt: serverTimestamp() });
const linkBatch = (db, code, watchUid, ownerUid, ownerName = '모닝브루') => {
  const b = writeBatch(db);
  b.update(doc(db, 'watchPairs/' + code), { ownerUid, ownerName });
  b.set(doc(db, 'watchLinks/' + watchUid), { ownerUid, code, linkedAt: serverTimestamp() });
  return b.commit();
};
const watchRecipe = (over = {}) => ({
  userId: 'owner1', source: 'watch', mode: 'espresso', date: new Date().toISOString(),
  dosing: 18, temp: 93, time: 28, yield: 36, ...over,
});

await check('워치: 연결 전 기록 저장 거부',                 assertFails(setDoc(doc(watch, 'recipes/w0'), watchRecipe())));
await check('워치: 6자리 코드 생성 허용',                  assertSucceeds(setDoc(doc(watch, 'watchPairs/123456'), pairNew('watch1'))));
await check('워치: 남의 watchUid로 코드 생성 거부',        assertFails(setDoc(doc(watch, 'watchPairs/223456'), pairNew('watch9'))));
await check('워치: 6자리가 아닌 코드 거부',                assertFails(setDoc(doc(watch, 'watchPairs/12ab'), pairNew('watch1'))));
await check('워치: 주인 필드를 미리 채운 코드 거부',       assertFails(setDoc(doc(watch, 'watchPairs/323456'), { ...pairNew('watch1'), ownerUid: 'owner1' })));
await check('워치: 자기 코드 읽기 허용',                   assertSucceeds(getDoc(doc(watch, 'watchPairs/123456'))));
await check('코드: 타인 읽기 거부(코드 훔쳐보기 방지)',    assertFails(getDoc(doc(webOther, 'watchPairs/123456'))));
await check('연결: 익명 사용자는 연결 거부',               assertFails(linkBatch(anonUser, '123456', 'watch1', 'anonweb')));
await check('연결: 다른 워치 uid로 링크 위조 거부',        assertFails(linkBatch(webOwner, '123456', 'watch2', 'owner1')));
await check('연결: 만료 코드 거부',                        assertFails(linkBatch(webOwner, '999999', 'watch2', 'owner1')));
await check('연결: 로그인 사용자 코드 입력 허용',          assertSucceeds(linkBatch(webOwner, '123456', 'watch1', 'owner1')));
await check('연결: 이미 쓰인 코드 재사용 거부',            assertFails(linkBatch(webOther, '123456', 'watch1', 'other1')));
await check('워치: 연결 상태 읽기 허용',                   assertSucceeds(getDoc(doc(watch, 'watchLinks/watch1'))));
await check('주인: 내 워치 목록 열거 허용',
  assertSucceeds(getDocs(query(collection(webOwner, 'watchLinks'), where('ownerUid', '==', 'owner1')))));
await check('타인: 남의 워치 목록 열거 거부',
  assertFails(getDocs(query(collection(webOther, 'watchLinks'), where('ownerUid', '==', 'owner1')))));
await check('워치: 주인 계정으로 기록 저장 허용',          assertSucceeds(setDoc(doc(watch, 'recipes/w1'), watchRecipe())));
await check('워치: source 없이 저장 거부',                 assertFails(setDoc(doc(watch, 'recipes/w2'), watchRecipe({ source: 'web' }))));
await check('워치: 남의 계정으로 저장 거부',               assertFails(setDoc(doc(watch, 'recipes/w3'), watchRecipe({ userId: 'other1' }))));
await check('워치: 주인 기록 읽기 거부',                   assertFails(getDoc(doc(watch, 'recipes/w1'))));
await check('주인: 워치가 남긴 기록 읽기 허용',            assertSucceeds(getDoc(doc(webOwner, 'recipes/w1'))));
await check('워치: 만료된 코드 문서 덮어쓰기 허용',        assertSucceeds(setDoc(doc(watch2, 'watchPairs/999999'), pairNew('watch2'))));
await check('워치: 유효한 남의 코드 덮어쓰기 거부',        assertFails(setDoc(doc(watch2, 'watchPairs/123456'), pairNew('watch2'))));
await check('타인: 연결 해제 거부',                        assertFails(deleteDoc(doc(webOther, 'watchLinks/watch1'))));
await check('주인: 연결 해제 허용',                        assertSucceeds(deleteDoc(doc(webOwner, 'watchLinks/watch1'))));
await check('워치: 해제 후 기록 저장 거부',                assertFails(setDoc(doc(watch, 'recipes/w4'), watchRecipe())));

// 웹(watch-link.js)의 실제 순서: 확정 → 읽기 → 링크. 확정 전에는 읽을 수 없다.
await check('워치: 재연결용 새 코드 생성 허용',            assertSucceeds(setDoc(doc(watch, 'watchPairs/654321'), pairNew('watch1'))));
await check('웹 순서: 확정 전 코드 읽기 거부',             assertFails(getDoc(doc(webOther, 'watchPairs/654321'))));
await check('웹 순서: 코드 확정 허용',                     assertSucceeds(updateDoc(doc(webOther, 'watchPairs/654321'), { ownerUid: 'other1', ownerName: 'o' })));
await check('웹 순서: 확정 후 주인은 읽기 허용',           assertSucceeds(getDoc(doc(webOther, 'watchPairs/654321'))));
await check('웹 순서: 남의 uid로 확정 거부',               assertFails(setDoc(doc(watch, 'watchPairs/111111'), pairNew('watch1')).then(() =>
  updateDoc(doc(webOwner, 'watchPairs/111111'), { ownerUid: 'other1' }))));
await check('웹 순서: 링크 생성 허용(재연결)',
  assertSucceeds(setDoc(doc(webOther, 'watchLinks/watch1'), { ownerUid: 'other1', code: '654321', linkedAt: serverTimestamp() })));
await check('재연결 후: 새 주인으로 저장 허용',            assertSucceeds(setDoc(doc(watch, 'recipes/w5'), watchRecipe({ userId: 'other1' }))));
await check('재연결 후: 옛 주인으로 저장 거부',            assertFails(setDoc(doc(watch, 'recipes/w6'), watchRecipe())));

await env.cleanup();
console.log('\n' + results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
