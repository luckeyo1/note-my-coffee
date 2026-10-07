// Firestore 보안 규칙 검증 — firestore.rules를 에뮬레이터에 올려 §8/§9/§12 시나리오를 확인.
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where,
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

await env.cleanup();
console.log('\n' + results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
