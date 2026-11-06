import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=()=>readFile(new URL('../cloudflare/developer-api.js',import.meta.url),'utf8');
test('password login still requires a short-lived separate MFA challenge',async()=>{
 const code=await src();
 assert.match(code,/datetime\('now','\+15 minutes'\)/);
 assert.match(code,/preAuthToken:pre/);
 assert.match(code,/consumed_at IS NULL/);
 assert.match(code,/SELECT c\.\*,u\.username/);
 assert.doesNotMatch(code,/return j\(\{ok:true,token:/);
});
test('TOTP enrolled on phone survives password login retry without rotating setup key',async()=>{
 const code=await src();
 assert.match(code,/SELECT enrollment_secret FROM developer_challenges WHERE user_id=\?/);
 assert.match(code,/ORDER BY created_at ASC LIMIT 1/);
 assert.match(code,/created_at>datetime\('now','-24 hours'\)/);
 assert.match(code,/secret=pending\?\.enrollment_secret\|\|base32/);
 assert.match(code,/UPDATE developer_challenges SET enrollment_secret=\?/);
 assert.match(code,/existing\)return fail\('التحقق الثنائي مسجل مسبقاً'/);
});
test('MFA remains required, rate-limited, one-use and bearer-scoped',async()=>{
 const code=await src();
 assert.match(code,/h\.enforceAuthRateLimit\(req,env,'developer-mfa'/);
 assert.match(code,/matchedCounter\(secret,String\(b\.code\|\|''\)/);
 assert.match(code,/UPDATE developer_challenges SET consumed_at=CURRENT_TIMESTAMP/);
 assert.match(code,/developer_sessions/);
 assert.match(code,/JOIN developer_grants g ON g\.user_id=u\.id AND g\.revoked_at IS NULL/);
});
