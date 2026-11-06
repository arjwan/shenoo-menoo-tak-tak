import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {profileSession} from '../cloudflare/pages/profile-session.js';
import {handleProfile} from '../cloudflare/profile-api.js';
import {onRequest} from '../functions/api/[[path]].js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const origin='https://shenoo-main-cloudflare.pages.dev';
const uid='11111111-1111-4111-8111-111111111111';
const strangerId='22222222-2222-4222-8222-222222222222';
const cookie='__Host-shino_session=example-cookie';
const make=(path,method='GET',body=null,headers={})=>new Request(origin+path,{method,headers:{Cookie:cookie,...headers},body});
function fixture(){
 const state={profile:{bio:'قبلي',city:'بغداد'},files:new Map(),saved:[]};
 const env={
  DB:{prepare(sql){return{bind(...args){this.args=args;return this},async first(){
    if(sql.includes('auth_sessions'))return {id:uid,username:'owner',full_name:'صاحب الحساب'};
    if(sql.includes('FROM users WHERE id=?'))return {id:this.args[0],username:'owner',full_name:'صاحب الحساب',status:'active',created_at:'2026-01-01'};
    if(sql.includes('birth_date,gender'))return {birth_date:'2000-02-03',gender:'other'};
    if(sql.includes('SELECT profile_json'))return{profile_json:JSON.stringify(state.profile)};
    if(sql.includes('COUNT('))return{n:2};return null
  },async run(){
    if(sql.includes('INSERT INTO user_profiles')){state.profile=JSON.parse(this.args[1]);state.saved.push(state.profile)}
    return{meta:{changes:1}}
  }}}
  },
  MEDIA:{async put(key,body,options){state.files.set(key,{body,options})},async get(key){let v=state.files.get(key);return v?{body:v.body,httpMetadata:{contentType:v.options.httpMetadata.contentType}}:null},async delete(key){state.files.delete(key)}}
 };
 return {env,state};
}
test('anonymous users cannot load or edit private profiles',async()=>{
 const {env}=fixture();
 for(const path of ['/api/users/me/profile','/api/users/me/privacy','/api/users/me/profile/avatar']){
  const res=await profileSession({env,request:new Request(origin+path)});
  assert.equal(res.status,401,path);
 }
});
test('D1-backed profile endpoint returns editable account with birth date, counts and old bio',async()=>{
 const {env}=fixture();
 const res=await onRequest({env,request:make('/api/users/me/profile')});
 assert.equal(res.status,200);const v=await res.json();
 assert.equal(v.user.id,uid);
 assert.equal(v.user.birthDate,'2000-02-03');
 assert.equal(v.user.bio,'قبلي');
 assert.equal(v.user.isSelf,true);
 assert.equal(v.user.postsCount,2);
});
test('profile data PATCH persists JSON merge and never erases existing fields',async()=>{
 const {env,state}=fixture();
 const res=await profileSession({env,request:make('/api/users/me/profile','PATCH',JSON.stringify({bio:'محدثة',governorate:'بغداد'}),{'Origin':origin,'Content-Type':'application/json'})});
 assert.equal(res.status,200);assert.equal(state.profile.bio,'محدثة');assert.equal(state.profile.city,'بغداد');
});
test('privacy persists per-field choices and blocks strangers from photos',async()=>{
 const {env,state}=fixture();
 let res=await profileSession({env,request:make('/api/users/me/privacy','PATCH',JSON.stringify({photo:'nobody',city:'friends',socialLinks:'nobody'}),{'Origin':origin,'Content-Type':'application/json'})});
 assert.equal(res.status,200);assert.equal(state.profile.privacy.photo,'nobody');
 state.profile.avatarKey='profiles/'+uid+'/avatar/photo.jpg';
 res=await handleProfile(make('/api/profile-media/'+uid+'/avatar'),env,{id:strangerId});
 assert.equal(res.status,403);
 res=await handleProfile(make('/api/users/'+uid+'/profile'),env,{id:strangerId});
 const v=await res.json();assert.equal(v.user.avatarUrl,null);assert.equal(v.user.city,undefined);
});
test('R2 upload validates signature, size, origin and stores only under owner namespace',async()=>{
 const {env,state}=fixture();
 const payload=new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,0,2,3]);
 let res=await profileSession({env,request:make('/api/users/me/profile/avatar','PUT',payload,{'Origin':origin,'Content-Type':'image/jpeg'})});
 assert.equal(res.status,200);assert.match(state.profile.avatarKey,new RegExp('^profiles/'+uid+'/avatar/'));
 assert.equal(state.files.size,1);
 res=await profileSession({env,request:make('/api/users/me/profile/cover','PUT',payload,{'Origin':'https://bad.example','Content-Type':'image/jpeg'})});
 assert.equal(res.status,403);
 res=await profileSession({env,request:make('/api/users/me/profile/cover','PUT',payload,{'Origin':origin,'Content-Type':'image/svg+xml'})});
 assert.equal(res.status,415);
 res=await profileSession({env,request:make('/api/profile-media/'+uid+'/avatar')});
 assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/image\/jpeg/);
});
test('profile UI uses JSON D1, R2 binary saves, photo/cover quick actions, responsive style and message',async()=>{
 const [html,js,css,worker,route]=await Promise.all([read('profile.html'),read('profile.js'),read('profile-refresh.css'),read('cloudflare/profile-api.js'),read('functions/api/[[path]].js')]);
 assert.match(html,/profile-refresh\.css/);
 assert.match(html,/data-avatar-preview/);assert.match(html,/data-cover-preview/);
 assert.match(html,/data-profile-message role="status" aria-live="polite"/);
 assert.match(js,/data-profile-action="quick-cover"/);
 assert.match(js,/quick-avatar/);
 assert.match(js,/method:'PUT',headers:\{'Content-Type':file.type\},body:file/);
 assert.doesNotMatch(js,/\/api\/users\/me\/profile'\s*,\{method:'PATCH',body:fd\}/);
 assert.match(worker,/image\/webp/);
 assert.match(route,/profileSession\(context\)/);
 assert.match(css,/profile-avatar-quick/);assert.match(css,/@media\(max-width:740px\)/);
});
test('Pages build ships profile page, R2 handler code and styles',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 for(const f of ['dist/profile.html','dist/profile.js','dist/profile-refresh.css'])assert.ok((await read(f)).length>300);
 assert.doesNotMatch(await read('dist/school/index.html'),/profile-refresh\.css/);
});
