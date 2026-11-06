import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {createClient,requireMfaChallenge,clearLegacySessions,escapeHtml} from '../developer/api.js';
test('password authentication cannot create a full developer session',()=>{
 assert.throws(()=>requireMfaChallenge({token:'full'}));
 assert.throws(()=>requireMfaChallenge({preAuthToken:'pre',token:'full'}));
 assert.deepEqual(requireMfaChallenge({preAuthToken:'pre',mfa:{phone:true,fido:true}}),{token:'pre',phone:true,fido:true});
});
test('login sends no old developer or core app session',async()=>{
 let called=false;
 const api=createClient({token:()=> 'old-session',fetcher:async(path,opt)=>{
  called=true;assert.equal(path,'/api/developer/login');assert.equal(opt.headers.has('Authorization'),false);assert.equal(opt.credentials,'omit');assert.equal(opt.redirect,'error');
  return Response.json({ok:true,preAuthToken:'pre'});
 }});
 await api('/api/developer/login',{auth:false,method:'POST',body:JSON.stringify({identifier:'test',password:'test-only-value'})});assert.ok(called);
});
test('MFA request uses only its pre-auth credential',async()=>{
 const api=createClient({token:()=> 'full',fetcher:async(_,opt)=>{assert.equal(opt.headers.get('Authorization'),'Bearer pre');return Response.json({ok:true});}});
 await api('/api/developer-mfa/phone/challenge',{auth:'pre',method:'POST',body:'{}'});
});
test('core D1 authentication and lookalike API namespaces cannot receive developer credentials',async()=>{
 const api=createClient({token:()=> 'secret',fetcher:()=>{throw Error('must not fetch')}});
 for(const path of ['/api/auth/signup','/api/auth/signin','/api/developerish/users','https://other.example/api/developer/me'])await assert.rejects(api(path),/مسار خارج/);
});
test('401 expires a session but a permission denial does not erase it',async()=>{
 let count=0,status=403;
 const api=createClient({expired:()=>count++,fetcher:async()=>Response.json({message:'denied'},{status})});
 await assert.rejects(api('/api/developer/users'));assert.equal(count,0);
 status=401;await assert.rejects(api('/api/developer/users'));assert.equal(count,1);
 await assert.rejects(api('/api/developer/login',{auth:false}));assert.equal(count,1);
});
test('legacy cleanup preserves paired-phone and core app credentials',()=>{
 const removed=[];clearLegacySessions({removeItem:k=>removed.push(k)});assert.deepEqual(removed,['developerToken','developerUser']);
});
test('untrusted records cannot inject markup into tables or forms',()=>{
 const s=escapeHtml('\"><img src=x onerror=alert(1)>');assert.doesNotMatch(s,/[<>"']/);assert.match(s,/&lt;img/);
});
test('retired developer documents and scripts are absent',async()=>{
 for(const name of ['developer.html','developer-phone.html','developer-rooms.html','developer-services.html','developer-ads.html','developer-ticker.html','admin-approvals.html','admin-chat.html','developer-rooms.js','developer-services.js','developer-school-requests.js','functions/developer.html.js'])await assert.rejects(access(new URL('../'+name,import.meta.url)));
 const manifest=JSON.parse(await readFile(new URL('../app-pages.manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.shenooMenoo.developer,['developer/index.html','developer/confirm.html']);
});
test('D1 worker has no obsolete developer control plane and retains core signup',async()=>{
 const source=await readFile(new URL('../cloudflare/worker.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/developer\.profile\.update|developer\.user\.update|path==='\/api\/developer\/dashboard'/);
 assert.match(source,/\/api\/auth\/signup/);
});
