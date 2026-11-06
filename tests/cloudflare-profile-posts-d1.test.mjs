import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profilePostsRequest } from '../cloudflare/pages/profile-posts.js';

const root='https://shinomino.com';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', viewer='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fileId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const records=[
 {id:'11111111-1111-4111-8111-111111111111',text:'عام',visibility:'everyone',created_at:'2026-11-01'},
 {id:'22222222-2222-4222-8222-222222222222',text:'للأصدقاء',visibility:'friends',created_at:'2026-11-02'},
 {id:'33333333-3333-4333-8333-333333333333',text:'للمتابعين',visibility:'followers',created_at:'2026-11-03'},
 {id:'44444444-4444-4444-8444-444444444444',text:'للمقربين',visibility:'friends_followers',created_at:'2026-11-04'}
];
function makeEnv({friend=false,follower=false,mediaVisibility='friends'}={}){
 const calls=[];
 const DB={prepare(sql){return {
   params:[],
   bind(...params){this.params=params;return this},
   async first(){
    calls.push({sql,params:this.params});
    if(sql.includes("FROM users WHERE"))return {id:this.params[0]};
    if(sql.includes("FROM friend_requests"))return friend?{id:'accepted'}:null;
    if(sql.includes("FROM follows"))return follower?{found:1}:null;
    if(sql.includes("FROM media m JOIN posts"))return {r2_key:'posts/owner/private.png',mime_type:'image/png',size:5,author_id:owner,visibility:mediaVisibility};
    if(sql.includes("COUNT(*) AS n"))return {n:records.filter(x=>this.params.slice(1).includes(x.visibility)).length};
    throw Error('unknown first query: '+sql);
   },
   async all(){
    calls.push({sql,params:this.params});
    if(sql.includes("SELECT p.id,p.text,p.visibility"))return {results:records.filter(x=>this.params.slice(1).includes(x.visibility))};
    if(sql.includes("FROM media WHERE"))return {results:[{id:fileId,post_id:records[1].id,kind:'image',mime_type:'image/png',size:5}]};
    return {results:[]};
   }
 };}};
 const env={DB,MEDIA:{async get(){return {body:new Uint8Array([1,2,3])}}}};
 return {env,calls};
}
test('viewer only sees public posts without friendship or follow access',async()=>{
 const {env,calls}=makeEnv();
 const r=await profilePostsRequest(new Request(root+'/api/posts/user/'+owner),env,{id:viewer});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.deepEqual(data.posts.map(x=>x.text),['عام']);
 assert.equal(data.total,1);
 assert.match(calls.find(x=>x.sql.includes("SELECT p.id,p.text")).sql,/NOT EXISTS \(SELECT 1 FROM ad_records/);
});
test('friend and follower access are checked on D1 and scoped to the owner',async()=>{
 const {env,calls}=makeEnv({friend:true,follower:true});
 const r=await profilePostsRequest(new Request(root+'/api/posts/user/'+owner),env,{id:viewer});
 const data=await r.json();
 assert.deepEqual(data.posts.map(x=>x.visibility),records.map(x=>x.visibility));
 assert.equal(data.posts[1].media[0].url,'/api/profile-post-media/'+fileId);
 assert.ok(calls.some(x=>x.sql.includes('friend_requests')&&x.params[0]===viewer));
 assert.ok(calls.some(x=>x.sql.includes('follows')&&x.params[1]===owner));
});
test('owner sees own posts, and unauthenticated visitor is rejected',async()=>{
 const {env}=makeEnv();
 assert.equal((await profilePostsRequest(new Request(root+'/api/posts/user/me'),env)).status,401);
 const data=await (await profilePostsRequest(new Request(root+'/api/posts/user/me'),env,{id:owner})).json();
 assert.equal(data.posts.length,4);
});
test('non-public R2 media is protected by viewer permissions',async()=>{
 const url=root+'/api/profile-post-media/'+fileId;
 const denied=await profilePostsRequest(new Request(url),makeEnv().env,{id:viewer});
 assert.equal(denied.status,403);
 const allowed=await profilePostsRequest(new Request(url),makeEnv({friend:true}).env,{id:viewer});
 assert.equal(allowed.status,200);
 assert.equal(allowed.headers.get('Cache-Control'),'private, no-store');
 assert.equal(allowed.headers.get('Content-Type'),'image/png');
});
test('profile page no longer sends stale browser bearer tokens or caches its old JS',async()=>{
 const js=await readFile(new URL('../profile-posts.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../profile.html',import.meta.url),'utf8');
 const routes=await readFile(new URL('../functions/api/[[path]].js',import.meta.url),'utf8');
 assert.doesNotMatch(js,/localStorage\.getItem\('token'\)|Authorization:'Bearer'/);
 assert.match(js,/credentials:'same-origin'/);
 assert.match(html,/profile-posts\.js\?v=20261107-d1-1/);
 assert.match(routes,/profilePostsRequest/);
});
