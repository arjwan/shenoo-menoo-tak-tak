import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {handleCallSignaling} from '../cloudflare/call-signaling.js';
const alice={id:'11111111-1111-4111-8111-111111111111',full_name:'Alice'};
const bob={id:'22222222-2222-4222-8222-222222222222',full_name:'Bob'};
const conversationId='33333333-3333-4333-8333-333333333333';
const callId='44444444-4444-4444-8444-444444444444';
function fakeDb(members=2){
 const events=[];const sessions=new Map();const histories=new Map();let index=0;
 return {events,sessions,histories,prepare(sql){
   let values=[];
   return {bind(...v){values=v;return this;},
     async first(){
       if(sql.includes('COUNT(*) AS n FROM conversation_members'))return {n:members};
       if(sql.includes('SELECT id FROM users'))return {id:values[0]};
       if(sql.includes('SELECT full_name FROM users'))return {full_name:'Alice'};
       if(sql.includes('FROM call_history'))return histories.get(values[0])||null;
       if(sql.includes('COUNT(*) AS n FROM private_call_signals'))return {n:events.length};
       if(sql.includes('FROM call_active_sessions')){
         const item=sessions.get(values[0]);
         return item && item.conversation_id===values[1] && !item.ended_at &&
           ((item.caller_id===values[2]&&item.recipient_id===values[3])||
           (item.caller_id===values[4]&&item.recipient_id===values[5])) ? {call_id:item.call_id}:null;
       }
       throw Error('unexpected first '+sql);
     },
     async run(){
       if(sql.startsWith('INSERT INTO private_call_signals')){
         events.push({id:++index,sender_id:values[0],recipient_id:values[1],conversation_id:values[2],call_id:values[3],event_type:values[4],payload:values[5],full_name:'Alice',expires_at:Date.now()/1000+120,created_at:Date.now()/1000});
         return {meta:{last_row_id:index}};
       }
       if(sql.startsWith('INSERT INTO call_active_sessions')){
         sessions.set(values[0],{call_id:values[0],conversation_id:values[1],caller_id:values[2],recipient_id:values[3],ended_at:null});
         return {meta:{changes:1}};
       }
       if(sql.startsWith('UPDATE call_active_sessions')){
         const item=sessions.get(values[0]);if(item)item.ended_at=Date.now();
         return {meta:{changes:item?1:0}};
       }
       if(sql.startsWith('INSERT OR IGNORE INTO call_history')){
         if(!histories.has(values[0])) histories.set(values[0],{call_id:values[0],conversation_id:values[1],caller_id:values[2],recipient_id:values[3],type:values[4],state:'ringing',answered_at:null,ended_at:null});
         return {meta:{changes:1}};
       }
       if(sql.startsWith("UPDATE call_history SET state='answered'")){
         const item=histories.get(values[0]);if(item){item.state='answered';item.answered_at=new Date().toISOString();}
         return {meta:{changes:item?1:0}};
       }
       if(sql.startsWith('UPDATE call_history SET state=CASE')){
         const item=histories.get(values[1]);
         if(item){item.state=item.answered_at?'answered':values[0]==='call:reject'?'declined':'missed';item.ended_at=new Date().toISOString();}
         return {meta:{changes:item?1:0}};
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

test('location cannot be sent without a live authenticated private call',async()=>{
 const DB=fakeDb();
 const result=await handleCallSignaling(request('POST',alice,{...payload,event:'call:location',data:{kind:'city',city:'بغداد',province:'بغداد'}}),{DB},alice);
 assert.equal(result.status,403);
 assert.equal(DB.events.length,0);
});
test('city location is visible only to the invited recipient and never includes coordinates',async()=>{
 const DB=fakeDb();
 await handleCallSignaling(request('POST',alice,payload),{DB},alice);
 const result=await handleCallSignaling(request('POST',alice,{...payload,event:'call:location',data:{kind:'city',city:'دهوك',province:'دهوك'}}),{DB},alice);
 assert.equal(result.status,201);
 const receiver=await(await handleCallSignaling(request('GET',bob),{DB},bob)).json();
 const cityEvent=receiver.events.find(x=>x.event==='call:location');
 assert.deepEqual(cityEvent.payload.data,{kind:'city',city:'دهوك',province:'دهوك'});
 assert.equal(JSON.stringify(cityEvent.payload).includes('latitude'),false);
 const sender=await(await handleCallSignaling(request('GET',alice),{DB},alice)).json();
 assert.equal(sender.events.some(x=>x.event==='call:location'),false);
});
test('precise coordinates are checked and revocation is sent as a separate event',async()=>{
 const DB=fakeDb();
 await handleCallSignaling(request('POST',alice,payload),{DB},alice);
 const bad=await handleCallSignaling(request('POST',alice,{...payload,event:'call:location',data:{kind:'precise',latitude:300,longitude:45,accuracy:10}}),{DB},alice);
 assert.equal(bad.status,400);
 const valid=await handleCallSignaling(request('POST',alice,{...payload,event:'call:location',data:{kind:'precise',latitude:36.86,longitude:42.99,accuracy:14}}),{DB},alice);
 assert.equal(valid.status,201);
 const revoke=await handleCallSignaling(request('POST',alice,{...payload,event:'call:location',data:{kind:'revoke'}}),{DB},alice);
 assert.equal(revoke.status,201);
 assert.equal(DB.events.at(-1).event_type,'call:location');
 assert.deepEqual(JSON.parse(DB.events.at(-1).payload).data,{kind:'revoke'});
});

test('answered, outgoing and missed call outcomes are persisted without storing call media',async()=>{
 const DB=fakeDb(),env={DB};
 await handleCallSignaling(request('POST',alice,payload),env,alice);
 assert.equal(DB.histories.get(callId).state,'ringing');
 const accepted=await handleCallSignaling(request('POST',bob,{...payload,event:'call:accept',userId:alice.id}),env,bob);
 assert.equal(accepted.status,201);
 assert.equal(DB.histories.get(callId).state,'answered');
 await handleCallSignaling(request('POST',alice,{...payload,event:'call:end'}),env,alice);
 assert.equal(DB.histories.get(callId).state,'answered');
 const anotherId='55555555-5555-4555-8555-555555555555';
 await handleCallSignaling(request('POST',alice,{...payload,callId:anotherId}),env,alice);
 await handleCallSignaling(request('POST',alice,{...payload,callId:anotherId,event:'call:end',reason:'no-answer'}),env,alice);
 assert.equal(DB.histories.get(anotherId).state,'missed');
});
