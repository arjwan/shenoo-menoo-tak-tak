import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {smartFriendRoute} from '../cloudflare/pages/smart-friend.js';
const source=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Smart Friend enhancements use same origin, HttpOnly cookies, and fresh HTML asset',async()=>{
 const js=await source('smart-friend-chat-enhancements.js');
 const html=await source('smart-friend-chat.html');
 assert.match(js,/const API=window.location.origin/);
 assert.match(js,/credentials:'same-origin'/);
 assert.doesNotMatch(js,/duckdns|Authorization:'Bearer'|localStorage\.getItem\('token'/);
 assert.match(html,/smart-friend-chat-enhancements\.js\?v=20261107-same-origin-2/);
 assert.match(html,/smart-friend-chat\.js\?v=20261107-domain-ai-2/);
});
test('delete conversation is owner- and persona-scoped, rejects cross-site request',async()=>{
 const user={id:'owner'},friend='12345678-1234-4234-8234-123456789abc';
 let deleted=false;
 const env={DB:{prepare(sql){return {args:[],bind(...args){this.args=args;return this},async first(){assert.match(sql,/smart_friend_personas/);return this.args[1]==='owner'?{id:friend}:null},async run(){assert.match(sql,/DELETE FROM smart_friend_messages WHERE user_id=\? AND persona_id=\?/);assert.deepEqual(this.args,['owner',friend]);deleted=true;return {meta:{changes:1}};}}}}};
 const url='https://shinomino.com/api/smart-friend/messages?friend='+friend;
 let response=await smartFriendRoute(new Request(url,{method:'DELETE',headers:{Origin:'https://evil.test'}}),env,user);
 assert.equal(response.status,403);assert.equal(deleted,false);
 response=await smartFriendRoute(new Request(url,{method:'DELETE',headers:{Origin:'https://shinomino.com'}}),env,user);
 assert.equal(response.status,200);assert.equal(deleted,true);
});
