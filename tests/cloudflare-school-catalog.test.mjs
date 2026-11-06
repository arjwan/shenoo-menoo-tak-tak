import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
test('Pages build publishes exactly 108 verified curriculum items from existing source',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:root,stdio:'pipe'});
 const data=JSON.parse(await read('dist/school-curriculum-catalog.json'));
 assert.equal(data.ok,true);
 assert.equal(data.total,108);
 assert.equal(data.items.length,108);
 for(const item of data.items){
   assert.equal(item.verified,true);
   assert.doesNotMatch(item.file?.url||'',/^\/uploads\//);
   assert.ok(item.id && item.title && item.grade && item.subject);
 }
});
test('school book list and reader require the D1 user session and do not use Mongo JWT',async()=>{
 const [book,reader,helper]=await Promise.all([
  read('functions/api/school/books.js'),
  read('functions/api/school/books/[[path]].js'),
  read('cloudflare/pages/school-helpers.js')
 ]);
 assert.match(book,/await schoolUser\(context\)/);
 assert.match(reader,/await schoolUser\(context\)/);
 assert.match(helper,/\/api\/auth\/session/);
 assert.match(helper,/context\.env\.API\.fetch/);
 assert.doesNotMatch(helper,/localStorage|mongoose|mongodb|Bearer/);
});
test('public curriculum catalog remains filterable without exposing indexed text',async()=>{
 const catalog=await read('functions/api/school/curriculum/catalog.js');
 assert.match(catalog,/\['stage','grade','subject'\]/);
 assert.match(catalog,/items\.length!==108/);
 assert.match(catalog,/context\.env\.ASSETS\.fetch/);
});
