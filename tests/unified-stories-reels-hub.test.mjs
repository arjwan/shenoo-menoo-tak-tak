import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('media hub keeps distinct working Stories and Reels applications',async()=>{
 const [html,js,css,home]=await Promise.all([read('moments.html'),read('moments.js'),read('moments.css'),read('taktak.html')]);
 assert.match(html,/id="createMedia"/);
 assert.equal((html.match(/id="createMedia"/g)||[]).length,1);
 for(const mode of ['stories','reels']){
  assert.match(html,new RegExp('id="tab-'+mode+'"'));
  assert.match(html,new RegExp('id="panel-'+mode+'"'));
  assert.match(html,new RegExp(mode+'\.html\\?embedded=1'));
  assert.match(js,new RegExp(mode+':'));
 }
 assert.match(js,/function switchMode\(mode,updateUrl=true\)/);
 assert.match(js,/function showCreate\(mode\)/);
 assert.match(js,/pause\?\.\(\)/);
 assert.match(css,/\.moments-tabs/);
 assert.match(home,/href="moments\.html\?create=1"/);
 assert.match(home,/href="moments\.html\?tab=stories&create=1"/);
 assert.match(home,/href="moments\.html\?tab=reels&create=1"/);
});
test('legacy Stories/Reels publishers and their saved URLs remain untouched',async()=>{
 const [stories,reels,script]=await Promise.all([read('stories.html'),read('reels.html'),read('reels-v2.js')]);
 assert.match(stories,/id="storyForm"/);
 assert.match(stories,/id="storyVisibility"/);
 assert.match(reels,/id="upload"/);
 assert.match(script,/uploadMediaToCloudflare/);
 assert.match(script,/\/api\/reels/);
});
test('share button completes independently from missing share analytics',async()=>{
 const js=await read('taktak-feed.js');
 const start=js.indexOf('async function sharePost(post)');
 const end=js.indexOf('function closePostDetails',start);
 const share=js.slice(start,end);
 assert.match(share,/navigator\.share/);
 assert.match(share,/navigator\.clipboard/);
 assert.match(share,/taktak\.html\?post=/);
 assert.match(share,/if\(completed\)try/);
 assert.match(share,/catch\(_\)\{\}/);
});
