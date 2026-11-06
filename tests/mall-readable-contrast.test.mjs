import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Mall Iraq loads a high-contrast stylesheet after existing global styles',async()=>{
 const html=await read('mall.html');
 assert.match(html,/<html[^>]*class="shinomino-ui mall-readable"/);
 const base=html.indexOf('href="mall.css"'),shared=html.indexOf('shinomino-shared-visual.css'),contrast=html.indexOf('mall-readability.css');
 assert.ok(base>=0&&shared>base&&contrast>shared,'contrast CSS loads last');
 assert.match(html,/<meta name="theme-color" content="#fbfaff">/);
});
test('category cards receive solid light surface and dark readable text at all widths',async()=>{
 const css=await read('mall-readability.css');
 assert.match(css,/\.category-card\s*\{[^}]*background:#fff!important/);
 assert.match(css,/\.category-card strong\s*\{[^}]*color:#291d42!important/);
 assert.match(css,/\.category-card small\s*\{[^}]*color:#5f526f!important/);
 assert.match(css,/\.category-card small\s*\{[^}]*white-space:normal!important/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/\.nav-link\{color:#41354f!important/);
});
test('dark advertising banners use bright titles and copy despite global h2 override',async()=>{
 const css=await read('mall-readability.css');
 assert.match(css,/\.ad-large\{background:linear-gradient\(112deg,#32275d,#1c2942 78%\)!important/);
 assert.match(css,/\.ad-copy h2\{color:#fff!important/);
 assert.match(css,/\.ad-copy h2 em\{color:#56efda!important/);
 assert.match(css,/\.ad-copy p\{color:#edf0fa!important/);
 assert.match(css,/\.ad-label\{color:#e1d6ff!important/);
 assert.match(css,/\.ad-copy\{position:relative;z-index:2\}/);
});
test('styling patch is scoped to mall and leaves school and original commerce flows unchanged',async()=>{
 const [css,html,script,school]=await Promise.all([read('mall-readability.css'),read('mall.html'),read('mall.js'),read('school.html')]);
 assert.ok(css.includes('html.shinomino-ui.mall-readable'));
 assert.doesNotMatch(css,/\.sumer-|\.school-/);
 assert.doesNotMatch(school,/mall-readability/);
 for(const label of ['تصنيفات المتاجر','المتاجر المميزة','خلِّ مشروعك','أنشئ متجرك'])assert.ok(html.includes(label));
 assert.match(script,/data-search-button/);
});
test('Cloudflare Pages output contains mall accessibility patch',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 assert.match(await read('dist/mall.html'),/mall-readability.css\?v=20261106-1/);
 assert.match(await read('dist/mall-readability.css'),/\.category-card small/);
});
