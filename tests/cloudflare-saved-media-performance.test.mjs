import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('first visible saved feed images load eagerly, remaining posts stay lazy',async()=>{
 const js=await read('taktak-feed.js');
 assert.match(js,/function media\(p,priority=false\)/);
 assert.match(js,/function card\(p,priority=false\)/);
 assert.match(js,/d\.posts\.map\(\(post,index\)=>card\(post,index<2\)\)/);
 assert.match(js,/fetchpriority="\'\+\(priority\?'high':'low'\)/);
 assert.match(js,/decoding="async"/);
});
test('public saved R2 media gets a longer browser cache and conditional ETag reuse',async()=>{
 const worker=await read('cloudflare/worker.js');
 assert.match(worker,/cachePolicy=m\.ad_status&&m\.ad_status!=='approved'\?'private, no-store':'public, max-age=86400'/);
 assert.match(worker,/If-None-Match/);
 assert.match(worker,/status:304/);
 assert.match(worker,/env\.MEDIA\.get\(m\.r2_key/);
});
