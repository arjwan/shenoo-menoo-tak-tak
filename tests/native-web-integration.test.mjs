import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../cloudflare/worker.js';

// Executes the original worker against actual isolated SQLite, never production.
function fixture() {
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT UNIQUE,full_name TEXT,email TEXT UNIQUE,password_salt TEXT,password_hash TEXT,role TEXT,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE posts(id TEXT PRIMARY KEY,author_id TEXT REFERENCES users(id),text TEXT,visibility TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE media(id TEXT PRIMARY KEY,owner_id TEXT,post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,r2_key TEXT,kind TEXT,mime_type TEXT,size INTEGER);
 CREATE TABLE post_likes(post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,user_id TEXT,PRIMARY KEY(post_id,user_id));
 CREATE TABLE post_comments(id TEXT PRIMARY KEY,post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,author_id TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE follows(follower_id TEXT,followed_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(follower_id,followed_id));
 CREATE TABLE conversations(id TEXT PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE conversation_members(conversation_id TEXT REFERENCES conversations(id),user_id TEXT,PRIMARY KEY(conversation_id,user_id));
 CREATE TABLE messages(id TEXT PRIMARY KEY,conversation_id TEXT REFERENCES conversations(id),sender_id TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE notifications(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,body TEXT,read_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE stories(id TEXT PRIMARY KEY,author_id TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,expires_at TEXT);
 `);
 for(const name of ['0003_story_media.sql','0004_reel_saves.sql','0005_chunked_100mb_uploads.sql','0006_private_drafts_contacts.sql','0007_revocable_sessions.sql','0008_legacy_auth_revocations.sql','0009_auth_abuse_limits.sql',
   '0010_real_account_profiles.sql','0011_private_message_read_state.sql','0012_friend_requests.sql','0013_advertisement_approvals.sql']) {
   db.exec(readFileSync(new URL('../cloudflare/migrations/'+name,import.meta.url),'utf8'));
 }
 const D1={prepare(sql){return{args:[],bind(...args){this.args=args;return this;},
   async first(){return db.prepare(sql).get(...this.args)||null;},
   async all(){return{results:db.prepare(sql).all(...this.args)};},
   async run(){const x=db.prepare(sql).run(...this.args);return{meta:{changes:Number(x.changes)}};}};},
   async batch(queries){db.exec('BEGIN');try{const result=[];for(const q of queries)result.push(await q.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const objects=new Map(),uploads=new Map();
 const MEDIA={
  async createMultipartUpload(key,options){const id=crypto.randomUUID();uploads.set(id,{key,options,parts:new Map()});return{uploadId:id,...this.resumeMultipartUpload(key,id)};},
  resumeMultipartUpload(key,id){const upload=uploads.get(id);return{
   async uploadPart(number,body){upload.parts.set(number,Buffer.from(await new Response(body).arrayBuffer()));return{etag:'part-'+number};},
   async complete(parts){const bytes=Buffer.concat(parts.map(p=>upload.parts.get(p.partNumber)));objects.set(key,{bytes,options:upload.options});uploads.delete(id);return{size:bytes.length};},
   async abort(){uploads.delete(id);}
  };},
  async head(key){const obj=objects.get(key);return obj?{size:obj.bytes.length}:null;},
  async get(key,options){const obj=objects.get(key);if(!obj)return null;let bytes=obj.bytes;
    if(options?.range)bytes=bytes.subarray(options.range.offset,options.range.offset+options.range.length);
    return{body:new Blob([bytes]).stream(),arrayBuffer:async()=>Uint8Array.from(bytes).buffer};},
  async delete(key){objects.delete(key);}
 };
 const env={DB:D1,MEDIA,AUTH_SECRET:'isolated-test-secret-with-no-production-access'};
 const origin='https://shinomino.com';
 async function call(path,{method='GET',body,cookie,raw,headers:extraHeaders}={}){
   const headers={'Content-Type':'application/json',Origin:origin,'CF-Connecting-IP':'192.0.2.5',...extraHeaders};
   if(cookie)headers.Cookie=cookie;
   const response=await worker.fetch(new Request(origin+path,{method,headers,body:raw??(body===undefined?undefined:JSON.stringify(body))}),env);
   return {status:response.status,data:response.headers.get('Content-Type')?.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer()),headers:response.headers,cookie:response.headers.get('Set-Cookie')?.split(';')[0]};
 }
 async function account(username){
   let r=await call('/api/auth/signup',{method:'POST',body:{username,fullName:'حساب اختبار '+username,email:username+'@example.test',password:'Isolated-password-90210',confirmPassword:'Isolated-password-90210'}});
   assert.equal(r.status,201,JSON.stringify(r.data));
   r=await call('/api/auth/signin',{method:'POST',body:{identifier:username,password:'Isolated-password-90210'}});
   assert.equal(r.status,200,JSON.stringify(r.data));assert.ok(r.cookie);
   assert.equal(r.data.token,undefined,'The web does not return bearer tokens');
   return {id:r.data.user.id,cookie:r.cookie};
 }
 return {db,call,account};
}

test('Original web sessions, native text, reactions, comments and isolation share one data store',async()=>{
 const {db,call,account}=fixture();
 try{
  const alice=await account('native_alice'),bob=await account('web_bob'),stranger=await account('outsider');
  let r=await call('/api/auth/session',{cookie:alice.cookie});
  assert.equal(r.status,200);assert.equal(r.data.authenticated,true);assert.equal(r.data.user.id,alice.id);
  r=await call('/api/posts',{method:'POST',cookie:alice.cookie,body:{text:'من الهاتف إلى الويب',visibility:'everyone'}});
  assert.equal(r.status,201,JSON.stringify(r.data));
  r=await call('/api/posts',{cookie:bob.cookie});
  const post=r.data.posts.find(p=>p.text==='من الهاتف إلى الويب');assert.ok(post);
  r=await call('/api/posts/'+post.id+'/like',{method:'POST',cookie:bob.cookie});assert.equal(r.data.likesCount,1);
  r=await call('/api/posts/'+post.id+'/like',{method:'DELETE',cookie:bob.cookie});assert.equal(r.data.likesCount,0);
  r=await call('/api/posts/'+post.id+'/comments',{method:'POST',cookie:bob.cookie,body:{text:'تعليق من الويب'}});assert.equal(r.status,201);
  r=await call('/api/posts/'+post.id+'/comments',{cookie:alice.cookie});assert.equal(r.data.comments[0].text,'تعليق من الويب');
  r=await call('/api/posts/'+post.id,{method:'DELETE',cookie:stranger.cookie});assert.equal(r.status,403);
  r=await call('/api/conversations/'+bob.id,{method:'POST',cookie:alice.cookie});assert.equal(r.status,403,'Non-mutual accounts must not message');
  db.prepare('INSERT INTO follows(follower_id,followed_id) VALUES(?,?),(?,?)').run(alice.id,bob.id,bob.id,alice.id);
  r=await call('/api/conversations/'+bob.id,{method:'POST',cookie:alice.cookie});assert.equal(r.status,200,JSON.stringify(r.data));
  const conversation=r.data.conversation.id;
  r=await call('/api/conversations/'+conversation+'/messages',{method:'POST',cookie:alice.cookie,body:{type:'text',text:'رسالة مشتركة'}});assert.equal(r.status,201,JSON.stringify(r.data));
  r=await call('/api/conversations/'+conversation+'/messages',{cookie:bob.cookie});assert.equal(r.data.messages[0].text,'رسالة مشتركة');assert.equal(r.data.messages[0].mine,false);
  r=await call('/api/conversations/'+conversation+'/messages',{cookie:stranger.cookie});assert.equal(r.status,404);
  r=await call('/api/conversations/'+conversation+'/read',{method:'PATCH',cookie:bob.cookie});assert.equal(r.status,200);
  r=await call('/api/conversations',{cookie:bob.cookie});assert.equal(r.data.conversations[0].unreadCount,0);
  r=await call('/api/auth/logout',{method:'POST',cookie:alice.cookie});assert.equal(r.status,200);
  r=await call('/api/posts',{cookie:alice.cookie});assert.equal(r.status,401,'Revoked native session must not authorize web data');
 }finally{db.close();}
});

test('Original uploads, image ranges, stories, profiles and notification state',async()=>{
 const {db,call,account}=fixture();
 try{
  const alice=await account('media_owner'),bob=await account('media_viewer');
  let r=await call('/api/users/me',{cookie:alice.cookie});assert.equal(r.data.user.id,alice.id);
  r=await call('/api/users/me',{method:'PATCH',cookie:alice.cookie,body:{fullName:'اسم محدث',username:'media_owner',gender:'other',birthDate:''}});assert.equal(r.status,200);
  r=await call('/api/users/me',{cookie:alice.cookie});assert.equal(r.data.user.fullName,'اسم محدث');
  const image=Buffer.from([255,216,255,224,0,16,0,0,0,0,0,0,0,0,0,0,255,217]);
  r=await call('/api/uploads',{method:'POST',cookie:alice.cookie,body:{name:'photo.jpg',mime:'image/jpeg',size:image.length,purpose:'posts'}});assert.equal(r.status,200);
  const id=r.data.uploadId;
  r=await call('/api/uploads/'+id+'/part/1',{method:'PUT',cookie:bob.cookie,raw:image,headers:{'Content-Length':String(image.length)}});assert.equal(r.status,404,'Upload belongs to its creator');
  r=await call('/api/uploads/'+id+'/part/1',{method:'PUT',cookie:alice.cookie,raw:image,headers:{'Content-Length':String(image.length)}});assert.equal(r.status,200,JSON.stringify(r.data));
  r=await call('/api/uploads/'+id+'/complete',{method:'POST',cookie:alice.cookie});assert.equal(r.status,200,JSON.stringify(r.data));
  r=await call('/api/posts',{method:'POST',cookie:alice.cookie,body:{text:'صورة من الهاتف',visibility:'everyone',uploadId:id}});assert.equal(r.status,201,JSON.stringify(r.data));
  r=await call('/api/posts',{cookie:bob.cookie});const post=r.data.posts.find(p=>p.text==='صورة من الهاتف');assert.ok(post.media[0]);
  r=await call(post.media[0].url,{headers:{Range:'bytes=0-2'}});assert.equal(r.status,206);assert.deepEqual(r.data,image.subarray(0,3));
  r=await call('/api/posts',{method:'POST',cookie:alice.cookie,body:{text:'reuse',visibility:'everyone',uploadId:id}});assert.equal(r.status,400,'Uploaded media cannot be consumed twice');
  r=await call('/api/stories',{method:'POST',cookie:alice.cookie,body:{text:'قصة من الهاتف',visibility:'everyone'}});assert.equal(r.status,201,JSON.stringify(r.data));
  r=await call('/api/stories',{cookie:bob.cookie});const story=r.data.stories.find(x=>x.text==='قصة من الهاتف');assert.ok(story);
  r=await call('/api/stories/'+story.id,{method:'DELETE',cookie:bob.cookie});assert.equal(r.status,403);
  r=await call('/api/stories/'+story.id,{method:'DELETE',cookie:alice.cookie});assert.equal(r.status,200);
  db.prepare('INSERT INTO notifications(id,user_id,kind,body) VALUES(?,?,?,?)').run(crypto.randomUUID(),alice.id,'text','إشعار اختبار');
  r=await call('/api/social/notifications',{cookie:alice.cookie});assert.equal(r.data.unread,1);
  r=await call('/api/social/notifications/read-all',{method:'PATCH',cookie:alice.cookie});assert.equal(r.status,200);
  r=await call('/api/social/notifications',{cookie:alice.cookie});assert.equal(r.data.unread,0);
  r=await call('/api/posts/'+post.id,{method:'DELETE',cookie:alice.cookie});assert.equal(r.status,200);
  r=await call(post.media[0].url);assert.equal(r.status,404);
 }finally{db.close();}
});
