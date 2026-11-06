import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('avatar is persisted to R2 and referenced by owner-scoped D1 persona',async()=>{
 const route=await read('cloudflare/pages/smart-friend.js');
 assert.match(route,/await env\.MEDIA\.put\(key,file\.buffer/);
 assert.match(route,/UPDATE smart_friend_personas SET avatar_key=/);
 assert.match(route,/SELECT avatar_key FROM smart_friend_personas WHERE id=\? AND user_id=\?/);
 assert.match(route,/await env\.MEDIA\.get\(r\.avatar_key\)/);
});
test('avatar upload errors do not misreport a successful persona save as failed',async()=>{
 const client=await read('smart-friend-chat.js');
 assert.match(client,/let avatarError=null;[\s\S]*?catch\(err\)\{avatarError=err;\}/);
 assert.match(client,/تم حفظ الشخصية، لكن تعذر حفظ صورتها/);
 assert.match(client,/showEditor\('edit',d\.friend\)/);
 assert.match(client,/await loadFriends\(d\.friend\.id\)/);
});
