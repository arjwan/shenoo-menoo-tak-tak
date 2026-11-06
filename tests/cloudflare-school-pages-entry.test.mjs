import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Sumer School entry point resolves /school to existing original school.html',async()=>{
 const [entry,source]=await Promise.all([read('school/index.html'),read('school.html')]);
 assert.match(entry,/location\.replace\('\/school\.html' \+ location\.search \+ location\.hash\)/);
 assert.match(entry,/href="\/school\.html"/);
 assert.match(source,/id="sumer-app"/);
});
test('Cloudflare Pages build includes full Sumer School asset tree',async()=>{
 const script=await read('scripts/build-cloudflare-pages.sh');
 assert.match(script,/for directory in [^\n]*\bschool;/);
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:30000});
 const files=[
  'dist/school/index.html','dist/school.html',
  'dist/school/css/sumer-tokens.css','dist/school/css/sumer-shell.css',
  'dist/school/css/sumer-components.css','dist/school/css/sumer-gateway.css',
  'dist/school/css/sumer-student.css','dist/school/css/sumer-teacher.css',
  'dist/school/js/sumer-api.js','dist/school/js/sumer-state.js',
  'dist/school/js/sumer-ui.js','dist/school/js/sumer-router.js',
  'dist/school/js/views/view-guest.js','dist/school/js/views/view-student.js',
  'dist/school/js/views/view-teacher.js','dist/school/js/views/view-guardian.js'
 ];
 for(const name of files)await access(new URL('../'+name,import.meta.url));
});
