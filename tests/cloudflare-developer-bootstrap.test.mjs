import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('developer bootstrap never supplies a public password-only admin session',async()=>{
 const [handler,ddl,form]=await Promise.all([read('functions/api/developer/setup-password.js'),read('cloudflare/migrations/0005_developer_setup.sql'),read('developer-setup.html')]);
 assert.match(handler,/developer_setup_tokens/);
 assert.match(handler,/developer_grants/);
 assert.match(handler,/consumed_at IS NULL/);
 assert.match(handler,/expires_at>datetime\('now'\)/);
 assert.match(handler,/developerHelpers\.enforceAuthRateLimit/);
 assert.match(handler,/developerHelpers\.verifyOrigin/);
 assert.match(handler,/password\.length<16/);
 assert.match(handler,/UPDATE users SET password_salt/);
 assert.match(handler,/UPDATE auth_sessions SET revoked_at/);
 assert.match(handler,/UPDATE developer_sessions SET revoked_at/);
 assert.match(ddl,/token_hash TEXT NOT NULL UNIQUE/);
 assert.match(ddl,/user_id TEXT PRIMARY KEY REFERENCES users/);
 assert.doesNotMatch(handler,/role='developer'|UPDATE users SET role|password123/);
 assert.match(form,/history\.replaceState/);
 assert.match(form,/location\.hash/);
 assert.match(form,/credentials:'omit'/);
 assert.doesNotMatch(form,/localStorage|sessionStorage|console\.log/);
});
test('setup rejects unauthenticated methods, untrusted origins and missing bindings',async()=>{
 const {onRequest}=await import('../functions/api/developer/setup-password.js');
 const url='https://shenoo-main-cloudflare.pages.dev/api/developer/setup-password';
 assert.equal((await onRequest({request:new Request(url),env:{}})).status,405);
 assert.equal((await onRequest({request:new Request(url,{method:'POST',headers:{Origin:'https://attacker.example'}}),env:{}})).status,403);
 assert.equal((await onRequest({request:new Request(url,{method:'POST',headers:{Origin:'https://shenoo-main-cloudflare.pages.dev'}}),env:{}})).status,503);
});
