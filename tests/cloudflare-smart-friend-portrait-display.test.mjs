import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('selected persona has a prominent portrait in conversation, not only settings',async()=>{
 const [html,js,css]=await Promise.all([read('smart-friend-chat.html'),read('smart-friend-chat.js'),read('smart-friend-chat.css')]);
 assert.match(html,/data-portrait-stage/);
 assert.match(html,/data-portrait-frame/);
 assert.match(html,/data-portrait-status/);
 assert.match(js,/function setMainAvatar\(f\)[\s\S]*?setPortrait\(f\)/);
 assert.match(js,/function setPortrait\(f\)/);
 assert.match(js,/img\.src=avatarSrc\(f\)/);
 assert.match(js,/avatarRevisions\.set\(d\.friend\.id,Date\.now\(\)\)/);
 assert.match(js,/img\.addEventListener\('error'/);
 assert.match(css,/\.sf-portrait-frame img\{[^}]*object-fit:cover/);
 assert.match(html,/smart-friend-chat\.js\?v=20261107-portrait-1/);
 assert.match(html,/smart-friend-chat\.css\?v=20261107-portrait-1/);
});
test('D1 avatar record and R2 media endpoint are owner-scoped',async()=>{
 const api=await read('cloudflare/pages/smart-friend.js');
 assert.match(api,/UPDATE smart_friend_personas SET avatar_key=\?,updated_at=CURRENT_TIMESTAMP WHERE id=\? AND user_id=\?/);
 assert.match(api,/SELECT avatar_key FROM smart_friend_personas WHERE id=\? AND user_id=\?/);
 assert.match(api,/await env\.MEDIA\.get\(r\.avatar_key\)/);
});
