import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('the site-wide layout attaches native scroll regions to each independent column',async()=>{
 const [js,css]=await Promise.all([read('shinomino-scroll-layout.js'),read('shinomino-scroll-layout.css')]);
 assert.match(js,/if\(home\)mode='home'/);
 assert.match(js,/else if\(smart\)mode='smart-friend'/);
 assert.match(js,/else if\(messages\)mode='messages'/);
 assert.match(js,/else if\(developer\)mode='developer'/);
 assert.match(js,/else if\(school\)mode='school'/);
 assert.match(js,/directMain\.dataset\.shScrollRegion/);
 assert.match(js,/region\.tabIndex=0/);
 assert.doesNotMatch(js,/addEventListener\(['"]wheel|preventDefault\(\)/);
 for(const mode of ['home','smart-friend','messages','developer','school','main','body'])
  assert.ok(css.includes('data-sh-scroll="'+mode+'"'),mode);
 assert.match(css,/\.sf-personas,\.sf-settings/);
 assert.match(css,/\.conversation-list/);
 assert.match(css,/#navigation/);
 assert.match(css,/\.sumer-main/);
 assert.match(css,/overscroll-behavior-y:contain/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media print/);
});
test('production Pages build injects one reusable stylesheet and script into every root page',async()=>{
 const script=await read('scripts/build-cloudflare-pages.sh');
 assert.match(script,/shinomino-scroll-layout\.css/);
 assert.match(script,/shinomino-scroll-layout\.js/);
 assert.match(script,/fs\.readdirSync\('dist'\)/);
 assert.match(script,/for \(const folder of \['developer','school'\]\)/);
 assert.match(script,/if \(!html\.includes\('shinomino-scroll-layout\.css'\)\)/);
 assert.match(script,/if \(!html\.includes\('shinomino-scroll-layout\.js'\)\)/);
});
test('page layout structures and published app functionality remain unchanged',async()=>{
 const [home,smart,messages,school,developer]=await Promise.all([
  read('taktak.html'),read('smart-friend-chat.html'),read('messages.html'),
  read('school.html'),read('developer/index.html')]);
 assert.match(home,/class="feed"/);
 assert.match(home,/class="left-side side-card"/);
 assert.match(home,/class="right-side/);
 assert.match(smart,/class="sf-panel sf-personas"/);
 assert.match(smart,/class="sf-panel sf-settings"/);
 assert.match(smart,/data-messages/);
 assert.match(messages,/class="conversation-list"/);
 assert.match(messages,/class="chat-window"/);
 assert.match(school,/id="sumer-main"/);
 assert.match(developer,/id="navigation"/);
});
