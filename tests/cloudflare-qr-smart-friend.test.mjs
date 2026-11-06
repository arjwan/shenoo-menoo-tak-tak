import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {friendQrRequest} from '../cloudflare/pages/friend-qr.js';
import {smartFriendRoute} from '../cloudflare/pages/smart-friend.js';
import {onRequest} from '../functions/api/[[path]].js';

const base='https://shenoo-main-cloudflare.pages.dev';
const owner={id:'11111111-1111-4111-8111-111111111111',username:'owner'};
const guest={id:'22222222-2222-4222-8222-222222222222',username:'friend'};
const req=(path,method='GET',body,origin=base)=>new Request(base+path,{
 method,headers:method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'},
 ...(body!==undefined?{body:JSON.stringify(body)}:{})
});
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
function db(){
 const tokens=new Map(),requests=[],personas=[];
 const DB={
  prepare(sql){
   return{
    args:[],bind(...args){this.args=args;return this},
    async run(){
     const a=this.args;
     if(sql.startsWith('INSERT INTO friend_qr_tokens')){tokens.set(a[2],{id:a[0],user_id:a[1],token_hash:a[2],used_at:null});return {meta:{changes:1}}}
     if(sql.startsWith('UPDATE friend_qr_tokens')){const found=[...tokens.values()].find(v=>v.id===a[0]&&!v.used_at);if(!found)return {meta:{changes:0}};found.used_at='now';return {meta:{changes:1}}}
     if(sql.startsWith('INSERT INTO friend_requests')){requests.push({sender_id:a[1],receiver_id:a[2],status:'pending'});return {meta:{changes:1}}}
     if(sql.startsWith('INSERT INTO smart_friend_personas')){personas.push({id:a[0],user_id:a[1],slot:a[2],name:a[3],gender:a[4],age:a[5],personality:a[6],conversation_style:a[7],interests_json:a[8],avatar_key:null});return {meta:{changes:1}}}
     if(sql.startsWith('UPDATE smart_friend_personas SET name=')){const p=personas.find(v=>v.id===a[6]&&v.user_id===a[7]);Object.assign(p,{name:a[0],gender:a[1],age:a[2],personality:a[3],conversation_style:a[4],interests_json:a[5]});return {meta:{changes:1}}}
     return {meta:{changes:1}}
    },
    async first(){
     const a=this.args;
     if(sql.includes('FROM friend_qr_tokens'))return [...tokens.values()].find(v=>v.token_hash===a[0]&&!v.used_at)||null;
     if(sql.includes('FROM users WHERE id'))return {id:a[0],status:'active'};
     if(sql.includes('FROM friend_requests'))return requests.find(r=>(r.sender_id===a[0]&&r.receiver_id===a[1])||(r.sender_id===a[2]&&r.receiver_id===a[3]))||null;
     if(sql.includes('FROM smart_friend_personas')&&sql.includes('slot='))return personas.find(v=>v.user_id===a[0]&&v.slot===a[1])||null;
     if(sql.includes('FROM smart_friend_personas')&&sql.includes('id=?'))return personas.find(v=>v.id===a[0]&&v.user_id===a[1])||null;
     return null;
    },
    async all(){
     const a=this.args;
     if(sql.includes('SELECT slot FROM smart_friend_personas'))return {results:personas.filter(v=>v.user_id===a[0]).map(v=>({slot:v.slot}))};
     if(sql.includes('SELECT * FROM smart_friend_personas'))return {results:personas.filter(v=>v.user_id===a[0])};
     return {results:[]};
    }
   }
  }
 };
 return {DB,tokens,requests,personas};
}
const persona={name:'صديق ودود',age:25,gender:'male',personality:'friendly',conversationStyle:'balanced',interests:['رياضة']};
test('D1 migrations use hashed expiring QR tokens and isolated smart friend personas',async()=>{
 const [qr,friend]=await Promise.all([read('cloudflare/migrations/0008_friend_qr_tokens.sql'),read('cloudflare/migrations/0009_smart_friend_personas.sql')]);
 assert.match(qr,/CREATE TABLE IF NOT EXISTS friend_qr_tokens/);
 assert.match(qr,/token_hash TEXT NOT NULL UNIQUE/);
 assert.match(qr,/used_at TEXT/);
 assert.match(friend,/CREATE TABLE IF NOT EXISTS smart_friend_personas/);
 assert.match(friend,/UNIQUE\(user_id,slot\)/);
 assert.doesNotMatch(qr+friend,/\bDROP TABLE\b|DELETE FROM users/);
});
test('QR generates random local payload and stores hash, not exposed token',async()=>{
 const {DB,tokens}=db();
 const r=await friendQrRequest(req('/api/friends/qr'),{DB},owner);
 assert.equal(r.status,200);const v=await r.json();
 assert.match(v.payload,/^shnomano:\/\/friend\?token=[A-Za-z0-9_-]{43}$/);
 assert.equal(v.expiresInSeconds,600);
 assert.equal(tokens.size,1);
 const stored=[...tokens.values()][0];
 assert.ok(!v.payload.includes(stored.token_hash),'hash never sent');
 assert.notEqual(stored.token_hash,v.payload.split('token=')[1]);
});
test('QR is one-time and cannot be scanned by own account or replayed',async()=>{
 const {DB,requests}=db();
 const issued=await (await friendQrRequest(req('/api/friends/qr'),{DB},owner)).json();
 const token=new URL(issued.payload).searchParams.get('token');
 const attempt=()=>friendQrRequest(req('/api/friends/qr/request','POST',{token}),{DB},guest);
 const own=await friendQrRequest(req('/api/friends/qr/request','POST',{token}),{DB},owner);
 assert.equal(own.status,400);
 const success=await attempt();assert.equal(success.status,200);assert.equal(requests.length,1);
 assert.equal(requests[0].receiver_id,owner.id);
 const repeat=await attempt();assert.equal(repeat.status,410);
 assert.equal(requests.length,1);
});
test('QR rejects cross-origin redemption',async()=>{
 const {DB}=db();
 const v=await (await friendQrRequest(req('/api/friends/qr'),{DB},owner)).json();
 const token=new URL(v.payload).searchParams.get('token');
 const r=await friendQrRequest(req('/api/friends/qr/request','POST',{token},'https://bad.example'),{DB},guest);
 assert.equal(r.status,403);
});
test('smart friend can create and edit D1 persona but does not claim AI provider available',async()=>{
 const state=db();
 let res=await smartFriendRoute(req('/api/smart-friend/friends','POST',persona),state,owner);
 assert.equal(res.status,201);
 let v=await res.json();assert.equal(v.friend.slot,1);const id=v.friend.id;
 res=await smartFriendRoute(req('/api/smart-friend/friends'),state,owner);
 v=await res.json();assert.equal(v.providerConfigured,false);assert.equal(v.friends.length,1);
 assert.equal(v.friends[0].name,persona.name);
 res=await smartFriendRoute(req('/api/smart-friend/friends/1','PUT',{...persona,name:'شخصيتي الجديدة'}),state,owner);
 assert.equal(res.status,200);
 assert.equal((await res.json()).friend.name,'شخصيتي الجديدة');
 res=await smartFriendRoute(req('/api/smart-friend/messages?friend='+id),state,owner);
 assert.equal(res.status,200);assert.deepEqual((await res.json()).messages,[]);
 res=await smartFriendRoute(req('/api/smart-friend/messages','POST',{}),state,owner);
 assert.equal(res.status,503);
});
test('different users cannot edit each others smart friend persona',async()=>{
 const state=db();
 await smartFriendRoute(req('/api/smart-friend/friends','POST',persona),state,owner);
 const res=await smartFriendRoute(req('/api/smart-friend/friends/1','PUT',persona),state,guest);
 assert.equal(res.status,404);
});
test('Cloudflare route blocks unauthenticated QR and persona operations before database queries',async()=>{
 const env={DB:{prepare(){throw Error('Anonymous must not read user tables')}}};
 for(const path of ['/api/friends/qr','/api/smart-friend/friends']){
  const r=await onRequest({env,request:new Request(base+path)});
  assert.equal(r.status,401,path);
 }
});
test('friend QR browser has local generator and local decoder without external image API',async()=>{
 const page=await read('friend-qr.html');
 for(const text of ['qr-code-vendor.min.js','jsqr-vendor.js','new QRCode(qrImage','decodeQr(bitmap)','getUserMedia','jsQR(','createImageBitmap(file)'])assert.ok(page.includes(text),text);
 assert.doesNotMatch(page,/qrserver\.com|chart\.googleapis\.com/);
 assert.match(page,/id="myQr" class="qr-image"/);
});
test('smart-friend browser no longer falsely reports unsuccessful AI messages as saved',async()=>{
 const client=await read('smart-friend-chat.js');
 assert.match(client,/تعذّر إرسال الرسالة/);
 assert.doesNotMatch(client,/تم حفظ رسالتك\. الشخصيات تعمل/);
});
test('Pages build includes static offline QR encoder and scanner assets',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 for(const p of ['friend-qr.html','qr-code-vendor.min.js','jsqr-vendor.js','smart-friend-chat.js']){
  assert.ok((await read('dist/'+p)).length>400,p);
 }
});
