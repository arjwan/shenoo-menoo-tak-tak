import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {onRequest} from '../functions/api/smart-friend/[[path]].js';
const base='https://shinomino.com';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('specific Cloudflare Pages route returns login challenge instead of legacy 501',async()=>{
 const env={DB:{prepare(){throw Error('must not query anonymous session')}}};
 for(const path of ['/api/smart-friend/messages','/api/smart-friend/friends','/api/smart-friend/tools/review']){
  const res=await onRequest({env,request:new Request(base+path)});
  assert.equal(res.status,401,path);
  assert.match((await res.json()).message,/تسجيل الدخول/);
 }
});
test('with verified session, the compact dock can receive an AI message on the domain',async()=>{
 const id='33333333-3333-4333-8333-333333333333',uid='11111111-1111-4111-8111-111111111111';
 const token='test-session-cookie',digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const hash=Buffer.from(digest).toString('base64url');let saved=[];
 const db={prepare(sql){return{args:[],sql,bind(...args){this.args=args;return this},
  async first(){if(sql.includes('FROM auth_sessions')){assert.equal(this.args[0],hash);return{id:uid,username:'tester',full_name:'Tester'};}
   if(sql.includes('FROM smart_friend_personas'))return this.args[0]===id&&this.args[1]===uid?{id,name:'حسناء',personality:'friendly',conversation_style:'balanced',interests_json:'[]'}:null;return null},
  async all(){return {results:[]}};
 }},
 async batch(statements){saved=statements;return statements.map(()=>({success:true}))}
 };
 const env={DB:db,AI:{async run(model,opts){assert.ok(opts.messages.some(x=>x.role==='user'&&x.content==='هلا'));return {response:'أهلاً بيك'}}}};
 const res=await onRequest({env,request:new Request(base+'/api/smart-friend/messages',{method:'POST',headers:{Cookie:'__Host-shino_session='+token,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({friendId:id,text:'هلا'})})});
 assert.equal(res.status,200);const body=await res.json();
 assert.equal(body.message.text,'أهلاً بيك');
 assert.equal(saved.length,2);
});
test('homepage compact dock keeps message on failure, and shows returned message on success',async()=>{
 const [js,html,route]=await Promise.all([read('smart-friend-dock.js'),read('taktak.html'),read('functions/api/smart-friend/[[path]].js')]);
 assert.match(js,/credentials:'same-origin'/);
 assert.match(js,/const d=await req\('\/api\/smart-friend\/messages'/);
 assert.match(js,/t\.value=''/);
 assert.ok(js.indexOf("t.value=''")>js.indexOf("const d=await req('/api/smart-friend/messages'"));
 assert.match(js,/تعذر إرسال الرسالة/);
 assert.match(js,/button\.disabled=true/);
 assert.match(html,/smart-friend-dock\.js\?v=20261106-cloudflare-dock-1/);
 assert.match(route,/getAuthenticatedAppUser/);
 assert.match(route,/smartFriendRoute/);
});
test('Pages build retains explicit route and updated dock asset',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 assert.match(await read('dist/taktak.html'),/20261106-cloudflare-dock-1/);
 assert.match(await read('dist/smart-friend-dock.js'),/credentials:'same-origin'/);
});
