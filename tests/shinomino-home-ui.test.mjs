import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('approved social-first homepage shows verified platform functionality and routes',async()=>{
 const html=await read('index.html');
 for(const label of ['المنشورات','القصص','الريلز','البث المباشر','الاتصال','مدرسة سومر','الخدمات','المجتمع','إعلانات شنو منو'])assert.ok(html.includes(label),'Missing '+label);
 for(const target of ['/taktak.html','/stories.html','/reels.html','/calls.html','/school/','/services.html','/ads.html','/signin.html','/signup.html','/developer/'])assert.ok(html.includes('href="'+target+'"'),'Missing '+target);
 assert.match(html,/role="search"/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/class="mobile-nav"/);
 assert.match(html,/href="\/shinomino-home.css\?v=20261106-1"/);
 assert.match(html,/src="\/shinomino-home.js\?v=20261106-1"/);
 assert.match(html,/rel="canonical" href="https:\/\/shinomino\.com\/"/);
 assert.doesNotMatch(html,/1,248 شخص|متصل الآن|شاهد الآن \d+/);
});
test('homepage visual style is mobile-friendly and supports reduced motion',async()=>{
 const css=await read('shinomino-home.css');
 assert.match(css,/--violet:#713dcb/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/\.social-grid/);
 assert.match(css,/\.social-card/);
 assert.match(css,/\.heritage/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.mobile-nav/);
});
test('homepage search is client-side only and never pretends to query posts',async()=>{
 const js=await read('shinomino-home.js');
 assert.match(js,/data-search/);
 assert.match(js,/event\.preventDefault\(\)/);
 assert.match(js,/feedback\.textContent/);
 assert.doesNotMatch(js,/(?:fetch|XMLHttpRequest)\(/);
});
test('build includes homepage, CSS and JS without breaking sign-in',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),timeout:45000,stdio:'pipe'});
 for(const p of ['dist/index.html','dist/shinomino-home.css','dist/shinomino-home.js','dist/signin.html']){
  const v=await read(p);assert.ok(v.length>200,'Too small '+p);
 }
});
