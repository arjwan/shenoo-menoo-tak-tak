import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {handleCallSignaling} from '../cloudflare/call-signaling.js';
const alice={id:'11111111-1111-4111-8111-111111111111',full_name:'Alice'};
const bob={id:'22222222-2222-4222-8222-222222222222',full_name:'Bob'};
const conversationId='33333333-3333-4333-8333-333333333333';
const callId='44444444-4444-4444-8444-444444444444';
function fakeDb(members=2){
 const events=[];let index=0;
 return {events,prepare(sql){
   let values=[];
   return {bind(...v){values=v;return this;},
     async first(){
       if(sql.includes('COUNT(*) AS n FROM conversation_members'))return {n:members};
       if(sql.includes('SELECT id FROM users'))return {id:values[0]};
       if(sql.includes('COUNT(*) AS n FROM private_call_signals'))return {n:events.length};
       throw Error('unexpected first '+sql);
     },
     async run(){
       if(sql.startsWith('INSERT INTO private_call_signals')){
         events.push({id:++index,sender_id:values[0],recipient_id:values[1],conversation_id:values[2],call_id:values[3],event_type:values[4],payload:values[5],full_name:'Alice',expires_at:Date.now()/1000+120,created_at:Date.now()/1000});
         return {meta:{last_row_id:index}};
       }
       if(sql.startsWith('DELETE FROM private_call_signals'))return {meta:{changes:0}};
       throw Error('unexpected run '+sql);
     },
     async all(){
       if(sql.includes('FROM private_call_signals s JOIN users')){
         return {results:events.filter(e=>e.recipient_id===values[0]&&e.id>values[1]).map(e=>({...e,full_name:e.sender_id===alice.id?'Alice':'Bob'}))};
       }
       throw Error('unexpected all '+sql);
     }
   };
 }};
}
const request=(method,user=alice,data)=>new Request('https://shinomino.com/api/call-signals',{method,headers:method==='POST'?{'Content-Type':'application/json'}:{},...(method==='POST'?{body:JSON.stringify(data)}:{})});
const payload={event:'call:invite',callId,conversationId,userId:bob.id,type:'video'};
test('authenticated call invite is delivered only to its intended recipient',async()=>{
 const DB=fakeDb(),env={DB};
 const posted=await handleCallSignaling(request('POST',alice,payload),env,alice);
 assert.equal(posted.status,201);
 const forBob=await (await handleCallSignaling(request('GET',bob),env,bob)).json();
 const forAlice=await (await handleCallSignaling(request('GET',alice),env,alice)).json();
 assert.equal(forBob.events.length,1);
 assert.equal(forAlice.events.length,0);
 assert.equal(forBob.events[0].from,alice.id);
 assert.equal(forBob.events[0].payload.type,'video');
});
test('nonmember can never send signaling to another user',async()=>{
 const DB=fakeDb(1);
 const result=await handleCallSignaling(request('POST',alice,payload),{DB},alice);
 assert.equal(result.status,403);
 assert.equal(DB.events.length,0);
});
test('wrong event and spoofing to oneself are rejected',async()=>{
 const DB=fakeDb();
 const bad=await handleCallSignaling(request('POST',alice,{...payload,event:'admin:override'}),{DB},alice);
 assert.equal(bad.status,400);
 const self=await handleCallSignaling(request('POST',alice,{...payload,userId:alice.id}),{DB},alice);
 assert.equal(self.status,400);
 assert.equal(DB.events.length,0);
});
test('client uses same-origin authenticated API, never legacy Socket.IO',()=>{
 const html=fs.readFileSync(new URL('../messages.html',import.meta.url),'utf8');
 const client=fs.readFileSync(new URL('../call-signaling.js',import.meta.url),'utf8');
 const messages=fs.readFileSync(new URL('../private-messages.js',import.meta.url),'utf8');
 assert.match(html,/call-signaling\.js\?v=/);
 assert.doesNotMatch(html,/duckdns\.org/);
 assert.match(messages,/ShnoCallSignaling\.create\(\)/);
 assert.match(client,/SocialAPI\.request\('\/api\/call-signals/);
 assert.match(client,/call:invite/);
 assert.match(client,/webrtc:offer/);
});

test('Pages API routes calls through its authenticated D1 session with CSRF protection',()=>{
 const source=fs.readFileSync(new URL('../functions/api/[[path]].js',import.meta.url),'utf8');
 assert.match(source,/pathname === '\/api\/call-signals'/);
 assert.match(source,/getAuthenticatedAppUser\(context.request,context.env\)/);
 assert.match(source,/handleCallSignaling\(context.request,context.env,actor\)/);
 assert.match(source,/Sec-Fetch-Site/);
});
