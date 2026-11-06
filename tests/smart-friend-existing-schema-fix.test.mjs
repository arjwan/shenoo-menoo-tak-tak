import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {smartFriendRoute} from '../cloudflare/pages/smart-friend.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('production existing D1 personas are migrated additively to support R2 avatars',async()=>{
 const old=await read('cloudflare/migrations/0009_smart_friend_personas.sql');
 const delta=await read('cloudflare/migrations/0010_smart_friend_existing_avatar_column.sql');
 assert.match(old,/CREATE TABLE IF NOT EXISTS smart_friend_personas/);
 assert.match(delta,/ALTER TABLE smart_friend_personas ADD COLUMN avatar_key TEXT/);
 assert.doesNotMatch(delta.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n'),/DROP|DELETE|CREATE TABLE/);
});
test('smart friend editor uses safe named-item form elements for creation and editing',async()=>{
 const js=await read('smart-friend-chat.js');
 const html=await read('smart-friend-chat.html');
 assert.match(js,/form\.elements\.namedItem\(n\)/);
 assert.match(js,/f\.elements\.namedItem\(n\)/);
 assert.doesNotMatch(js,/f\.name\.value|form\.name\.value/);
 assert.match(js,/field\('name'\)\.value\.trim\(\)/);
 assert.match(js,/field\('slot'\)\.value/);
 assert.match(js,/credentials='same-origin'/);
 assert.match(js,/HTTP '\+r\.status/);
 assert.match(html,/smart-friend-chat\.js\?v=20261106-persona-fix-2/);
});
test('server supports saved existing personas while correctly rejecting unsupported fields',async()=>{
 const body={name:'علي',gender:'male',age:25,personality:'friendly',conversationStyle:'balanced',interests:['الرياضة']};
 const existing={id:'db-id',slot:1,user_id:'user1',...body,conversation_style:'balanced',interests_json:'["الرياضة"]',avatar_key:null};
 let updated=null;
 const env={DB:{prepare(sql){return{bind(...args){this.args=args;return this},async first(){return existing},async run(){updated={sql,args:this.args};return{meta:{changes:1}}}}}}};
 const request=new Request('https://shenoo-main-cloudflare.pages.dev/api/smart-friend/friends/1',{method:'PUT',headers:{Origin:'https://shenoo-main-cloudflare.pages.dev','Content-Type':'application/json'},body:JSON.stringify(body)});
 const res=await smartFriendRoute(request,env,{id:'user1'});
 assert.equal(res.status,200);assert.equal((await res.json()).friend.name,'علي');
 assert.match(updated.sql,/UPDATE smart_friend_personas/);
 assert.equal(updated.args.at(-1),'user1');
});
test('build includes fixed persona script without modifying Sumer School',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 assert.match(await read('dist/smart-friend-chat.html'),/20261106-persona-fix-2/);
 assert.match(await read('dist/smart-friend-chat.js'),/elements\.namedItem/);
 assert.doesNotMatch(await read('dist/school/index.html'),/persona-fix-2/);
});
