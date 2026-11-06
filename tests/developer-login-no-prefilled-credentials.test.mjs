import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('developer login never pre-fills account name or password in public HTML',async()=>{
 const html=await read('developer/index.html');
 const identifier=html.match(/<input\b[^>]*\bid="identifier"[^>]*>/)?.[0];
 const password=html.match(/<input\b[^>]*\bid="password"[^>]*>/)?.[0];
 assert.ok(identifier,'login identifier input exists');
 assert.ok(password,'password input exists');
 assert.doesNotMatch(identifier,/\bvalue\s*=/i);
 assert.doesNotMatch(password,/\bvalue\s*=/i);
 assert.match(identifier,/autocomplete="username"/);
 assert.match(password,/autocomplete="current-password"/);
 assert.match(password,/type="password"/);
});
test('public developer setup page does not expose administrative account identifier',async()=>{
 const setup=await read('developer-setup.html');
 assert.doesNotMatch(setup,/shinomino_app/);
 assert.match(setup,/autocomplete="new-password"/);
 assert.match(setup,/noindex,nofollow/);
});
test('developer browser login still uses server authentication and MFA',async()=>{
 const [client,api]=await Promise.all([read('developer/app.js'),read('developer/api.js')]);
 assert.match(client,/send\(dev\+'\/login','POST',\{identifier,password\}/);
 assert.match(client,/requireMfaChallenge/);
 assert.match(api,/credentials: 'same-origin'/);
});
