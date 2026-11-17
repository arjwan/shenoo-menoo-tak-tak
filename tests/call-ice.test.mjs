import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueCallIce,callIceRoute} from '../cloudflare/pages/call-ice.js';
const req=()=>new Request('https://shinomino.com/api/call-ice');
const user={id:'test-user'};
const db={prepare(){return {bind(){return this},async first(){return {attempts:1}}}}};
test('relay issuer is authenticated and never exposes the long-lived server token',async()=>{
 assert.equal((await callIceRoute({request:req(),env:{}})).status,401);
 const env={DB:db,SHNO_CALL_TURN_KEY:'server-key-id',SHNO_CALL_TURN_TOKEN:'long-lived-server-secret'};
 const result=await issueCallIce(req(),env,user,async(url,init)=>{
  assert.equal(init.headers.Authorization,'Bearer long-lived-server-secret');
  assert.equal(JSON.parse(init.body).ttl,14400);
  return Response.json({iceServers:[{urls:['turns:turn.cloudflare.com:443?transport=tcp','turn:untrusted.example:443'],username:'temporary-user',credential:'temporary-password'}],key:'never-return-this'});
 });
 const body=await result.text();assert(!body.includes('long-lived-server-secret'));assert(!body.includes('never-return-this'));
 const data=JSON.parse(body);assert(data.relay);assert.equal(data.iceServers[0].urls.length,1);
});
test('unconfigured relay remains explicit and transient failures are not fake success',async()=>{
 const fallback=await (await issueCallIce(req(),{DB:db},user)).json();assert.equal(fallback.relay,false);
 const bad=await issueCallIce(req(),{DB:db,SHNO_CALL_TURN_KEY:'x',SHNO_CALL_TURN_TOKEN:'x'},user,async()=>new Response('',{status:503}));assert.equal(bad.status,503);
});

test('Weak-network mode bounds video capture while audio calls never request a camera',async()=>{
 const {readFile}=await import('node:fs/promises');const vm=await import('node:vm');const code=await readFile(new URL('../call-ice.js',import.meta.url),'utf8');
 const window={navigator:{connection:{effectiveType:'2g'}},location:{search:''},localStorage:{getItem:()=>null}};
 vm.runInNewContext(code,{window,URLSearchParams});
 assert.equal(window.ShnoCallIce.constraints('audio').video,false);
 assert.equal(window.ShnoCallIce.constraints('video').video.width.max,480);
 window.navigator.connection.effectiveType='4g';assert.equal(window.ShnoCallIce.constraints('video').video.width.ideal,1280);
 window.location.search='?lowData=1';assert.equal(window.ShnoCallIce.constraints('video').video.frameRate.max,15);
});
