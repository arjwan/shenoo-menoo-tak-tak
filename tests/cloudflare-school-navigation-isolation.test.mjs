import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Sumer School does not send visitors or managers to developer dashboard',async()=>{
 const html=await readFile(new URL('../school.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/location\.replace\(['"]\/developer\//);
 assert.match(html,/location\.replace\(['"]\/school-admin\.html#/);
 assert.match(html,/if \(ctx\.isDeveloper \|\| ctx\.isManager\) return '#welcome'/);
 const gateway=await readFile(new URL('../school/index.html',import.meta.url),'utf8');
 assert.match(gateway,/\/school\.html/);
});
