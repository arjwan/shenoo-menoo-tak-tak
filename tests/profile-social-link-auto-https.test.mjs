import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('social URL normalization prepends https but preserves explicit http and https',async()=>{
 const script=await read('profile.js');
 const start=script.indexOf('function normalizeSocialUrl(');
 const end=script.indexOf('function action(',start);
 assert.ok(start>=0&&end>start,'normalizer exists');
 const context={URL};
 vm.createContext(context);
 vm.runInContext(script.slice(start,end),context);
 const normalize=context.normalizeSocialUrl;
 const safe=context.safeUrl;
 assert.equal(normalize(' example.com/me '),'https://example.com/me');
 assert.equal(normalize('https://example.com'),'https://example.com');
 assert.equal(normalize('http://example.com'),'http://example.com');
 assert.equal(safe('example.com/me'),'https://example.com/me');
 assert.equal(safe('http://example.com/me'),'http://example.com/me');
 for(const input of ['','https://','http://','javascript:alert(1)','ftp://example.com','data:text/html,x','https://user:pass@example.com','bad host name']){
  assert.equal(safe(input),'','must reject '+input);
 }
});
test('new link editor has HTTPS prefilling, normalized save, and cache-busted script',async()=>{
 const [script,html]=await Promise.all([read('profile.js'),read('profile.html')]);
 assert.match(script,/url\.value='https:\/\/'/);
 assert.match(script,/var n=document\.querySelector\('\[data-social-network\]'\)\.value,u=safeUrl/);
 assert.match(html,/data-social-url type="url" inputmode="url" autocomplete="url" dir="ltr"/);
 assert.match(html,/profile\.js\?v=20261106-auto-https-1/);
});
test('Pages build includes changed social links editor',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 assert.match(await read('dist/profile.html'),/profile\.js\?v=20261106-auto-https-1/);
 assert.match(await read('dist/profile.js'),/function normalizeSocialUrl/);
});
