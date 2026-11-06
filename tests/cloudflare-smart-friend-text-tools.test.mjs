import {test} from 'node:test';
import assert from 'node:assert/strict';
import {smartFriendRoute} from '../cloudflare/pages/smart-friend.js';

const root='https://shinomino.com';
const actor={id:'test-user'};
const env={DB:{},AI:{async run(_model,options){
 assert.equal(options.messages[0].role,'system');
 return {response:'اقتراح نصي مُولّد من النموذج'};
}}};
const post=(path,data,headers={})=>new Request(root+path,{
 method:'POST',headers:{'Content-Type':'application/json',Origin:root,...headers},
 body:JSON.stringify(data)
});
test('review and compose generate real Workers AI text with expected UI keys',async()=>{
 for(const [path,input,key] of [
  ['/api/smart-friend/tools/review',{mode:'proofread',text:'مرحبا بكم'},'reply'],
  ['/api/smart-friend/tools/review',{mode:'opinion',text:'منشور اجتماعي'},'reply'],
  ['/api/smart-friend/tools/compose',{mode:'post',topic:'التعليم'},'text'],
  ['/api/smart-friend/tools/compose',{mode:'caption',topic:'بغداد'},'text'],
  ['/api/smart-friend/tools/compose',{mode:'image-prompt',topic:'منظر للمدينة'},'text']
 ]){
  const response=await smartFriendRoute(post(path,input),env,actor);
  assert.equal(response.status,200,path);
  const body=await response.json();
  assert.equal(body[key],'اقتراح نصي مُولّد من النموذج');
 }
});
test('rejects untrusted origin, image review, invalid mode, missing AI',async()=>{
 const p='/api/smart-friend/tools/review';
 const cases=[
  [post(p,{mode:'proofread',text:'hello'},{Origin:'https://evil.example'}),env,403],
  [post(p,{mode:'proofread',text:'hello',imageData:'data:image/jpeg;base64,abc'}),env,415],
  [post(p,{mode:'unknown',text:'hello'}),env,400],
  [post(p,{mode:'proofread',text:'hello'}),{DB:{}},503],
 ];
 for(const [request,environment,status] of cases){
  const response=await smartFriendRoute(request,environment,actor);
  assert.equal(response.status,status);
  assert.equal((await response.json()).ok,false);
 }
});
test('does not claim successful generation when provider throws',async()=>{
 const response=await smartFriendRoute(post('/api/smart-friend/tools/compose',{mode:'post',topic:'نص'}),{DB:{},AI:{run(){throw Error('provider unavailable')}}},actor);
 assert.equal(response.status,503);
 assert.equal((await response.json()).ok,false);
});
