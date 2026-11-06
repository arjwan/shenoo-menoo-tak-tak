import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {smartFriendRoute} from '../cloudflare/pages/smart-friend.js';

const origin='https://shenoo-main-cloudflare.pages.dev';
const owner={id:'11111111-1111-4111-8111-111111111111'};
const stranger={id:'22222222-2222-4222-8222-222222222222'};
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const req=(path,originHeader=origin)=>new Request(origin+path,{method:'DELETE',headers:{Origin:originHeader}});
function mockStore(){
 const rows=[
  {id:'aaa',user_id:owner.id,slot:1,name:'الأول',avatar_key:'smart-friend/'+owner.id+'/aaa/image.jpg'},
  {id:'bbb',user_id:owner.id,slot:2,name:'الثاني',avatar_key:null},
  {id:'ccc',user_id:stranger.id,slot:1,name:'شخصية أخرى',avatar_key:'smart-friend/'+stranger.id+'/ccc/image.jpg'}
 ];
 const deletedFiles=[];
 const env={
  DB:{prepare(sql){return {args:[],bind(...args){this.args=args;return this},
   async first(){
    if(sql.includes('FROM smart_friend_personas WHERE user_id=? AND slot=?'))
      return rows.find(r=>r.user_id===this.args[0]&&r.slot===this.args[1])||null;
    return null;
   },
   async run(){
    if(!sql.includes('DELETE FROM smart_friend_personas'))throw Error('unexpected mutation');
    const index=rows.findIndex(r=>r.id===this.args[0]&&r.user_id===this.args[1]&&r.slot===this.args[2]);
    if(index<0)return {meta:{changes:0}};
    rows.splice(index,1);return {meta:{changes:1}};
   }}}
  },
  MEDIA:{async delete(key){deletedFiles.push(key)}}
 };
 return {rows,deletedFiles,env};
}
test('only the owner can delete their selected persona and its R2 avatar',async()=>{
 const state=mockStore();
 let res=await smartFriendRoute(req('/api/smart-friend/friends/1'),state.env,stranger);
 assert.equal(res.status,200); // stranger owns their own slot 1, not owner's
 assert.equal(state.rows.length,2);
 assert.deepEqual(state.deletedFiles,['smart-friend/'+stranger.id+'/ccc/image.jpg']);
 res=await smartFriendRoute(req('/api/smart-friend/friends/1'),state.env,owner);
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.deleted,true);assert.equal(body.avatarRemoved,true);
 assert.equal(body.friendId,'aaa');
 assert.deepEqual(state.rows.map(r=>r.id),['bbb']);
 assert.equal(state.deletedFiles.length,2);
 res=await smartFriendRoute(req('/api/smart-friend/friends/1'),state.env,owner);
 assert.equal(res.status,404);
});
test('a different user cannot delete owner persona of the same slot',async()=>{
 const state=mockStore();
 // A stranger with no persona in slot 2 must not touch owner's slot 2.
 const response=await smartFriendRoute(req('/api/smart-friend/friends/2'),state.env,stranger);
 assert.equal(response.status,404);
 assert.equal(state.rows.length,3);
 assert.equal(state.deletedFiles.length,0);
});
test('cross-origin attempts never delete a persona',async()=>{
 const state=mockStore();
 const response=await smartFriendRoute(req('/api/smart-friend/friends/1','https://attacker.example'),state.env,owner);
 assert.equal(response.status,403);
 assert.equal(state.rows.length,3);
});
test('missing R2 binding still permits deletion of a persona with no avatar',async()=>{
 const state=mockStore();delete state.env.MEDIA;
 const response=await smartFriendRoute(req('/api/smart-friend/friends/2'),state.env,owner);
 assert.equal(response.status,200);assert.equal(state.rows.some(r=>r.id==='bbb'),false);
});
test('client requires irreversible-delete confirmation and refreshes the selected persona',async()=>{
 const [js,html,css]=await Promise.all([read('smart-friend-chat.js'),read('smart-friend-chat.html'),read('smart-friend-chat.css')]);
 assert.match(js,/\[data-delete-persona\]/);
 assert.match(js,/window\.confirm\(/);
 assert.match(js,/method:'DELETE'/);
 assert.match(js,/friends=friends\.filter/);
 assert.match(js,/active=null/);
 assert.match(html,/data-delete-persona/);
 assert.match(html,/20261106-persona-delete-1/);
 assert.match(css,/\.sf-delete-persona:focus-visible/);
});
test('Cloudflare Pages build contains delete button and server still uses D1',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 assert.match(await read('dist/smart-friend-chat.html'),/data-delete-persona/);
 assert.match(await read('dist/smart-friend-chat.js'),/method:'DELETE'/);
 assert.doesNotMatch(await read('dist/school/index.html'),/data-delete-persona/);
});
