import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('cinematic Reels adds navigation and video controls without replacing existing application',async()=>{
 const [html,css,js,original]=await Promise.all([read('reels.html'),read('reels-cinema.css'),read('reels-cinema.js'),read('reels-v2.js')]);
 for(const id of ['feed','upload','create','commentsSheet','commentsList','commentForm','previousReel','nextReel','reelsPosition'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/reels-v2\.js\?v=20261104-100mb/);
 assert.match(html,/reels-cinema\.js\?v=20261107-1/);
 assert.match(html,/reels-cinema\.css\?v=20261107-1/);
 assert.match(js,/function enhance\(card\)/);
 assert.match(js,/function jump\(delta\)/);
 assert.match(js,/video\.muted=true/);
 assert.match(js,/IntersectionObserver/);
 assert.match(js,/visibilitychange/);
 assert.match(css,/\.reels-cinema \.reel-card/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(original,/uploadMediaToCloudflare/);
 assert.match(original,/\/api\/posts/);
 assert.match(original,/openComments/);
 assert.match(original,/navigator\.share/);
});
test('cinema layer does not add new third-party services or change stored media',async()=>{
 const [js,css]=await Promise.all([read('reels-cinema.js'),read('reels-cinema.css')]);
 assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|indexedDB|localStorage|\.remove\(\)/);
 assert.doesNotMatch(css,/url\(https?:\/\//);
 assert.match(js,/No forced auto-play/);
});
