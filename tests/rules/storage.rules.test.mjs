// Storage 보안 규칙 검증 — 공개 커버 사진(posts/{uid}/{postId}/{file}).
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { readFileSync } from 'node:fs';

const PROJECT = 'demo-nmc';
let pass = 0, fail = 0; const results = [];
async function check(name, p) {
  try { await p; results.push(`PASS  ${name}`); pass++; }
  catch (e) { results.push(`FAIL  ${name} — ${e.code || e.message || e}`); fail++; }
}

const env = await initializeTestEnvironment({
  projectId: PROJECT,
  storage: { rules: readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8') },
});

const owner = env.authenticatedContext('owner1').storage();
const other = env.authenticatedContext('other1').storage();
const anon  = env.unauthenticatedContext().storage();

const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]); // 작은 "이미지" 바이트
const imgMeta = { contentType: 'image/jpeg' };
const big = new Uint8Array(6 * 1024 * 1024);                       // 6MB > 5MB 상한
const ownPath = 'posts/owner1/post1/cover.jpg';

// 시드: 공개 읽기 테스트용 객체를 규칙 우회로 올린다.
await env.withSecurityRulesDisabled(async (ctx) => {
  await uploadBytes(ref(ctx.storage(), 'posts/owner1/seed/cover.jpg'), img, imgMeta);
});

await check('커버 사진: 누구나 읽기 가능(공개)',            assertSucceeds(getBytes(ref(anon, 'posts/owner1/seed/cover.jpg'))));
await check('업로드: 소유자(경로 uid 일치) 이미지 허용',    assertSucceeds(uploadBytes(ref(owner, ownPath), img, imgMeta)));
await check('업로드: 비소유자(다른 uid 경로) 거부',          assertFails(uploadBytes(ref(other, ownPath), img, imgMeta)));
await check('업로드: 비로그인 거부',                         assertFails(uploadBytes(ref(anon, ownPath), img, imgMeta)));
await check('업로드: 이미지 아닌 contentType 거부',          assertFails(uploadBytes(ref(owner, ownPath), img, { contentType: 'text/plain' })));
await check('업로드: 5MB 초과 거부',                         assertFails(uploadBytes(ref(owner, ownPath), big, imgMeta)));
await check('삭제: 비소유자 거부',                           assertFails(deleteObject(ref(other, ownPath))));
await check('삭제: 소유자 허용',                             assertSucceeds(deleteObject(ref(owner, ownPath))));

await env.cleanup();
console.log('\n' + results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
