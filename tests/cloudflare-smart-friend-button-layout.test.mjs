import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('chat action buttons use an RTL four-column desktop and two-column mobile grid',async()=>{
 const [css,html]=await Promise.all([read('smart-friend-chat.css'),read('smart-friend-chat.html')]);
 assert.match(css,/\.sf-composer \.sf-tools\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:640px\)\{\.sf-composer \.sf-tools\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 for(const attr of ['data-record-audio','data-attach','data-read-last'])assert.match(html,new RegExp(attr));
 assert.match(html,/<button class="primary" type="submit">إرسال<\/button>/);
 assert.match(css,/\.sf-composer \.sf-tools button\[type="submit"\]/);
 assert.match(css,/\.sf-chat \[data-sf-extra-controls\] \[data-clear-chat\]/);
});
