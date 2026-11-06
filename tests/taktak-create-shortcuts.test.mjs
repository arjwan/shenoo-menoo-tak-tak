import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('four social shortcuts are clearly ordered in top navigation RTL',async()=>{
 const html=await read('taktak.html');
 const segment=html.slice(html.indexOf('class="create-shortcuts"'),html.indexOf('class="top-actions"'));
 assert.ok(segment.length>100&&segment.length<2000);
 const actual=[...segment.matchAll(/class="create-shortcut[^"]*"[^>]*?(?:href="([^"]+)"|data-create-post)/g)];
 assert.equal(actual.length,4);
 for(const text of ['منشور','قصة','ريلز','بث مباشر'])assert.ok(segment.includes(text),text);
 const ordered=['data-create-post','href="stories.html?create=1"','href="reels.html?create=1"','href="live-create.html"'];
 let pos=-1;for(const token of ordered){const n=segment.indexOf(token);assert.ok(n>pos,'Correct order for '+token);pos=n}
 assert.match(segment,/aria-label="إنشاء محتوى جديد"/);
 assert.match(html,/id="theme-toggle"/);
 assert.match(html,/id="logout"/);
 assert.match(html,/data-people-search/);
});
test('new post action focuses existing editor instead of creating a fake post',async()=>{
 const [html,script]=await Promise.all([read('taktak.html'),read('taktak-create-shortcuts.js')]);
 assert.match(html,/data-composer/);
 assert.match(html,/data-post-text/);
 assert.match(script,/querySelector\('\[data-composer\]'\)/);
 assert.match(script,/querySelector\('\[data-post-text\]'\)/);
 assert.match(script,/editor\.focus\(/);
 assert.doesNotMatch(script,/fetch\(|submit\(|post\(/);
});
test('shortcuts render as adaptive white-violet action row and preserve original styles',async()=>{
 const [css,html]=await Promise.all([read('taktak-create-shortcuts.css'),read('taktak.html')]);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.create-shortcuts/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(html,/taktak-create-shortcuts\.css\?v=20261106-1/);
 assert.match(html,/taktak-create-shortcuts\.js\?v=20261106-1/);
 assert.match(html,/shinomino-shared-visual\.css/);
});
test('Cloudflare Pages build ships the shortcut CSS and JS with school unaffected',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 for(const path of ['dist/taktak.html','dist/taktak-create-shortcuts.css','dist/taktak-create-shortcuts.js'])assert.ok((await read(path)).length>100);
 assert.doesNotMatch(await read('dist/school/index.html'),/taktak-create-shortcuts/);
});
