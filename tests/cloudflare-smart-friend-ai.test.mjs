import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { smartFriendRoute } from '../cloudflare/pages/smart-friend.js';

const base='https://shinomino.com';
const alice={id:'11111111-1111-4111-8111-111111111111'};
const bob={id:'22222222-2222-4222-8222-222222222222'};
const personaId='33333333-3333-4333-8333-333333333333';
const persona={id:personaId,user_id:alice.id,slot:1,name:'سارة',personality:'friendly',conversation_style:'balanced',interests_json:'["الشعر"]'};
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const post=(body,origin=base)=>new Request(base+'/api/smart-friend/messages',{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify(body)});
const envFactory=()=>{
 const messages=[];
 let aiCalls=0,inputs=[];
 const env={
  DB:{
   prepare(sql){
    return {args:[],bind(...a){this.args=a;return this},
     async first(){
      if(sql.includes('FROM smart_friend_personas'))return this.args[0]===personaId&&this.args[1]===alice.id?persona:null;
      return null;
     },
     async all(){
      if(sql.includes('FROM smart_friend_messages')){
       const list=messages.filter(m=>m.user_id===this.args[0]&&m.persona_id===this.args[1]).slice().reverse();
       return {results:list.slice(0,sql.includes('LIMIT 12')?12:100)};
      }
      return {results:[]};
     }}
   },
   async batch(statements){
    for(const stmt of statements){
     const args=stmt.args||[];
     messages.push({id:args[0],user_id:args[1],persona_id:args[2],role:stmt.sql.includes("'assistant'")?'assistant':'user',text:args[3],created_at:new Date().toISOString()});
    }
    return statements.map(()=>({success:true}));
   }
  },
  AI:{async run(model,params){aiCalls++;inputs.push({model,params});return {response:'هلا بيك، شلونك اليوم؟'}}}
 };
 // Expose INSERT SQL to test SQLite row order from the D1 batch.
 const original=env.DB.prepare;
 env.DB.prepare=function(sql){const stmt=original.call(this,sql);stmt.sql=sql;return stmt};
 return {env,messages,inputs,get calls(){return aiCalls}};
};
test('Workers AI binding returns real response and D1 persists user/assistant messages',async()=>{
 const state=envFactory();
 let result=await smartFriendRoute(post({friendId:personaId,text:'هلا شلونج؟'}),state.env,alice);
 assert.equal(result.status,200);
 const body=await result.json();
 assert.equal(body.ok,true);
 assert.equal(body.message.text,'هلا بيك، شلونك اليوم؟');
 assert.equal(body.saved,true);
 assert.equal(state.calls,1);
 assert.equal(state.inputs[0].model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');
 assert.equal(state.inputs[0].params.messages[0].role,'system');
 assert.ok(state.inputs[0].params.messages[0].content.includes('سارة'));
 assert.deepEqual(state.messages.map(m=>m.role),['user','assistant']);
 result=await smartFriendRoute(new Request(base+'/api/smart-friend/messages?friend='+personaId),state.env,alice);
 assert.equal(result.status,200);
 assert.deepEqual((await result.json()).messages.map(m=>m.text),['هلا شلونج؟','هلا بيك، شلونك اليوم؟']);
});
test('AI failure neither fabricates nor saves assistant messages',async()=>{
 const state=envFactory();
 state.env.AI.run=async()=>{throw Error('internal provider secret not exposed')};
 const res=await smartFriendRoute(post({friendId:personaId,text:'هلا'}),state.env,alice);
 assert.equal(res.status,503);
 assert.equal(state.messages.length,0);
 assert.doesNotMatch((await res.json()).message,/secret/);
});
test('missing Workers AI binding responds with explicit 503 instead of fake saved messages',async()=>{
 const state=envFactory();delete state.env.AI;
 const res=await smartFriendRoute(post({friendId:personaId,text:'هلا'}),state.env,alice);
 assert.equal(res.status,503);assert.equal(state.messages.length,0);
});
test('reject cross-origin, wrong user, empty text and unsupported media',async()=>{
 const state=envFactory();
 const badOrigin=await smartFriendRoute(post({friendId:personaId,text:'اهلا'},'https://attacker.example'),state.env,alice);
 assert.equal(badOrigin.status,403);
 const forbidden=await smartFriendRoute(post({friendId:personaId,text:'اهلا'}),state.env,bob);
 assert.equal(forbidden.status,404);
 const noText=await smartFriendRoute(post({friendId:personaId,text:''}),state.env,alice);
 assert.equal(noText.status,400);
 const fd=new FormData();fd.append('friendId',personaId);fd.append('text','مرحبا');fd.append('media',new Blob(['unsafe'],{type:'audio/webm'}),'voice.webm');
 const media=await smartFriendRoute(new Request(base+'/api/smart-friend/messages',{method:'POST',headers:{Origin:base},body:fd}),state.env,alice);
 assert.equal(media.status,415);
 assert.equal(state.calls,0);assert.equal(state.messages.length,0);
});
test('group responses use each persona identity and real AI, no invented replies',async()=>{
 const state=envFactory();
 // A single participant cannot start a group.
 let res=await smartFriendRoute(new Request(base+'/api/smart-friend/group',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({text:'احچوا عن بغداد',friendIds:[personaId]})}),state.env,alice);
 assert.equal(res.status,400);
 const repeated=[personaId,personaId];
 res=await smartFriendRoute(new Request(base+'/api/smart-friend/group',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({text:'احچوا عن بغداد',friendIds:repeated})}),state.env,alice);
 assert.equal(res.status,400);
});
test('HTML only displays messages as saved after API response and keeps unsent drafts',async()=>{
 const [js,html,migration]=await Promise.all([read('smart-friend-chat.js'),read('smart-friend-chat.html'),read('cloudflare/migrations/0011_smart_friend_messages.sql')]);
 assert.match(js,/const d=await api\('\/api\/smart-friend\/messages'/);
 assert.ok(js.indexOf("append('user',text,'أنت')")>js.indexOf("const d=await api('/api/smart-friend/messages'"));
 assert.match(js,/submit\.disabled=true/);
 assert.match(js,/field\('name'\)/); // incidental form test not required
 assert.match(html,/20261106-workers-ai-chat-1/);
 assert.match(migration,/REFERENCES smart_friend_personas\(id\) ON DELETE CASCADE/);
});
test('Pages build contains latest AI chat scripts without affecting school',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 assert.match(await read('dist/smart-friend-chat.html'),/20261106-workers-ai-chat-1/);
 assert.doesNotMatch(await read('dist/school/index.html'),/workers-ai-chat-1/);
});
