import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('password rotation requires valid D1 account session and preserves developer restrictions',async()=>{
 const s=await read('functions/api/auth/change-password.js');
 assert.match(s,/await schoolUser\(context\)/);
 assert.match(s,/developerHelpers\.verifyOrigin/);
 assert.match(s,/developerHelpers\.enforceAuthRateLimit/);
 assert.match(s,/next\.length<14/);
 assert.match(s,/secureEqual/);
 assert.match(s,/env\.DB\.batch/);
 assert.match(s,/UPDATE auth_sessions SET revoked_at/);
 assert.match(s,/UPDATE developer_sessions SET revoked_at/);
 assert.match(s,/UPDATE developer_challenges SET consumed_at/);
 assert.doesNotMatch(s,/UPDATE users SET role|DEVELOPER_PASSWORD|localStorage/);
});

test('security page does not persist or echo passwords and requires same-origin session',async()=>{
 const html=await read('security-password.html');
 assert.match(html,/autocomplete="current-password"/);
 assert.match(html,/autocomplete="new-password"/);
 assert.match(html,/credentials:'same-origin'/);
 assert.match(html,/\/api\/auth\/change-password/);
 assert.doesNotMatch(html,/localStorage|sessionStorage|console\.log\(/);
});

test('change-password rejects GET, cross-origin POST, and unconfigured service',async()=>{
 const {onRequest}=await import('../functions/api/auth/change-password.js');
 const base='https://shenoo-main-cloudflare.pages.dev/api/auth/change-password';
 const get=await onRequest({request:new Request(base),env:{}});
 assert.equal(get.status,405);
 const external=await onRequest({request:new Request(base,{method:'POST',headers:{Origin:'https://attacker.example'}}),env:{}});
 assert.equal(external.status,403);
 const unavailable=await onRequest({request:new Request(base,{method:'POST',headers:{Origin:'https://shenoo-main-cloudflare.pages.dev'}}),env:{}});
 assert.equal(unavailable.status,503);
});
