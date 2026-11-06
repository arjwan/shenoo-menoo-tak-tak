import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('profile exposes a same-host login recovery on expired session',async()=>{
 const js=await readFile(new URL('../profile.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../profile.html',import.meta.url),'utf8');
 assert.match(js,/e\.status===401\|\|e\.status===403/);
 assert.match(js,/\/signin\.html\?next=/);
 assert.match(html,/profile\.js\?v=20261107-session-recovery-1/);
});
