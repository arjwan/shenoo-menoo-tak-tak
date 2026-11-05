import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { proxyLegacy } from '../cloudflare/pages/legacy-origin.js';
import { onRequest } from '../functions/api/[[path]].js';
const context = path => ({ request: new Request('https://preview.example'+path), env: {} });
test('protected routes preserve authentication, query and denial without D1 fallback', async () => {
 const original = globalThis.fetch;
 try {
  globalThis.fetch = async req => {
   assert.equal(req.url, 'https://api.shinomino.com/api/school/curriculum/files?q=1');
   assert.equal(req.headers.get('Authorization'),'Bearer legacy-session');
   assert.equal(req.headers.get('Cookie'),'session=original');
   assert.equal(req.redirect,'manual');
   return Response.json({ok:false},{status:401});
  };
  const c=context('/api/school/curriculum/files?q=1');
  c.request=new Request(c.request,{headers:{Authorization:'Bearer legacy-session',Cookie:'session=original'}});
  c.env.API={fetch(){throw Error('D1 must not handle protected school requests')}};
  assert.equal((await onRequest(c)).status,401);
 } finally {globalThis.fetch=original;}
});
test('D1 routes and lookalike namespaces stay on D1', async()=>{
 for(const path of ['/api/auth/signup','/api/auth/signin','/api/stores','/api/schoolish','/api/developer-other']){
  const c=context(path);c.env.API={fetch:async()=>new Response('D1')};
  assert.equal(await (await onRequest(c)).text(),'D1');
 }
});
test('PDF range and download headers stream unchanged',async()=>{
 const c=context('/uploads/school-curriculum/book.pdf');
 c.request=new Request(c.request,{headers:{Range:'bytes=0-4'}});
 const r=await proxyLegacy(c,async req=>{
  assert.equal(req.headers.get('range'),'bytes=0-4');
  return new Response('%PDF-',{status:206,headers:{'Content-Type':'application/pdf','Content-Range':'bytes 0-4/100','Content-Disposition':'attachment; filename=book.pdf'}});
 });
 assert.equal(r.status,206);assert.equal(await r.text(),'%PDF-');
 assert.equal(r.headers.get('Content-Range'),'bytes 0-4/100');
 assert.match(r.headers.get('Content-Disposition'),/attachment/);
});
test('reject insecure origins and upstream redirects',async()=>{
 const c=context('/api/developer/login');c.env.LEGACY_ORIGIN='http://api.shinomino.com';
 assert.equal((await proxyLegacy(c,()=>{throw Error('must not send')})).status,503);
 delete c.env.LEGACY_ORIGIN;
 assert.equal((await proxyLegacy(c,async()=>new Response(null,{status:302,headers:{Location:'http://other.example'}}))).status,502);
});
test('origin failure returns 502 without error details or fallback',async()=>{
 const r=await proxyLegacy(context('/api/developer/login'),async()=>{throw Error('secret diagnostic')});
 assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/secret/);
});
test('original developer login uses MongoDB endpoint and MFA preauth',async()=>{
 const html=await readFile(new URL('../developer.html',import.meta.url),'utf8');
 assert.match(html,/\/api\/developer\/login/);assert.match(html,/preAuthToken=d.preAuthToken/);
 assert.doesNotMatch(html,/\/api\/auth\/signin/);
});

test('auxiliary server failure is structured 502',async()=>{
 const r=await proxyLegacy(context('/api/developer/login'),async()=>new Response('private diagnostic',{status:503}));
 assert.equal(r.status,502);assert.match(r.headers.get('Content-Type'),/application\/json/);
 assert.doesNotMatch(await r.text(),/private diagnostic/);
});
test('root developer page uses auxiliary server',async()=>{
 const {onRequest: page}=await import('../functions/developer.html.js');
 const original=globalThis.fetch;
 try{globalThis.fetch=async req=>{assert.equal(req.url,'https://api.shinomino.com/developer.html');return new Response('original panel')};
 assert.equal(await (await page(context('/developer.html'))).text(),'original panel');
 }finally{globalThis.fetch=original;}
});
