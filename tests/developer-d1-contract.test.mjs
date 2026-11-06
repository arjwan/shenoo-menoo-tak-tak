import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('D1 developer APIs require a developer role and an independent MFA session',async()=>{
 const src=await read('cloudflare/developer-api.js');
 assert.match(src,/role='developer'/);
 assert.match(src,/developer_sessions/);
 assert.match(src,/developer_mfa/);
 assert.match(src,/developer_challenges/);
 assert.match(src,/preAuthToken:pre/);
 assert.match(src,/consumed_at IS NULL/);
 assert.match(src,/last_counter/);
 assert.match(src,/__Host-shenoo_developer/);
 assert.match(src,/HttpOnly; SameSite=Strict/);
 assert.doesNotMatch(src,/\bDEVELOPER_PASSWORD\b/);
});
test('developer login and MFA verify are rate limited and same-origin only',async()=>{
 const src=await read('cloudflare/developer-api.js');
 assert.match(src,/h\.enforceAuthRateLimit\(req,env,'developer-login'/);
 assert.match(src,/h\.enforceAuthRateLimit\(req,env,'developer-mfa'/);
 assert.match(src,/h\.verifyOrigin\(req\)/);
 assert.match(src,/if\(!actor\)return fail\(/);
});
test('Pages requests D1 binding rather than forwarding developer to legacy origin',async()=>{
 const src=await read('functions/api/[[path]].js');
 assert.match(src,/handleDeveloper\(context\.request, context\.env/);
 assert.match(src,/if \(!context\.env\.DB\)/);
 assert.match(src,/pathname\.startsWith\('\/api\/school\/'\)/);
 assert.match(src,/proxyLegacy\(context\)/);
});
test('Pages KDF matches D1 Worker PBKDF2 settings',async()=>{
 const worker=await read('cloudflare/worker.js');
 const helper=await read('cloudflare/pages/developer-helpers.js');
 assert.match(worker,/pbkdf2Sync\(password, unb64\(salt\), 100000, 32, 'sha256'\)/);
 assert.match(helper,/iterations:100000,hash:'SHA-256'/);
 assert.match(helper,/DEVELOPER_RATE_LIMIT_SECRET/);
 assert.match(helper,/HMAC/);
});
test('migration adds tables only and does not touch user passwords',async()=>{
 const sql=await read('cloudflare/migrations/0002_developer_d1.sql');
 for(const name of ['developer_mfa','developer_challenges','developer_sessions','developer_ticker']){
   assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+name+'\\b'));
 }
 assert.doesNotMatch(sql,/^\s*(?:DROP\s|DELETE\s+FROM|UPDATE\s|ALTER\s+TABLE\s+users\b)/im);
});
test('original developer sections are retained while school stays on existing origin',async()=>{
 const ui=await read('developer/app.js');
 for(const section of ['overview','users','admins','approvals','rooms','reports','school','services','ticker','audit','account']){
  assert.match(ui,new RegExp(section+':'));
 }
 assert.match(ui,/totp\/verify/);
});
