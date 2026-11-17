import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = (n) => readFile(new URL('../'+n, import.meta.url),'utf8');
test('Reels fail closed when editing unsupported, too long, or rendered empty', async()=>{
 const js=await read('reels-v2.js');
 assert.match(js,/if \(needsRender\) \{/);
 assert.match(js,/typeof MediaRecorder === 'undefined'/);
 assert.match(js,/segmentDuration > 45/);
 assert.match(js,/!rendered \|\| rendered\.size === 0/);
 assert.match(js,/rendered\.size > 100 \* 1024 \* 1024/);
});
test('Stories do not silently upload unedited content', async()=>{
 const html=await read('stories.html');
 assert.match(html,/const needsVideoRender =/);
 assert.match(html,/if \(needsVideoRender\) \{/);
 assert.match(html,/segmentDuration > 45/);
 assert.match(html,/!rendered \|\| rendered\.size === 0/);
});
test('Renderer refuses unsupported recorder and silent truncation',async()=>{
 const js=await read('licensed-audio-library.js');
 assert.match(js,/if \(!mime\) throw Error/);
 assert.match(js,/requestedDuration > 45/);
 assert.match(js,/blob\.size === 0/);
});
test('Responsive controls and server endpoints still wired',async()=>{
 const [css,storyCss,reels,stories]=await Promise.all(['reels-v2.css','stories-reels-polish.css','reels.html','stories.html'].map(read));
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/data-ui-hidden/);
 assert.match(storyCss,/aspect-ratio:9\/16/);
 assert.match(reels,/licensed-audio-library\.js/);
 assert.match(stories,/licensed-audio-library\.js/);
 assert.match(stories,/\/api\/stories/);
});
