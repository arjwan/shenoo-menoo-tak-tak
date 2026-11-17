import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseNews,orderNews,buildNews,callContentRoute} from '../cloudflare/pages/call-content.js';
const now=Date.now();
const item=(title,url,date=now)=>`<item><title><![CDATA[${title}]]></title><link>${url}</link><description><![CDATA[<p>وصف مختصر</p>]]></description><pubDate>${new Date(date).toUTCString()}</pubDate></item>`;
test('News removes unsafe URLs, markup and stale items and orders Iraq/breaking then region then world',()=>{
 const data=parseNews('<rss>'+item('خبر العالم','https://example.com/world')+item('خبر العراق','https://example.com/iraq',now-1000)+item('خبر سوريا','https://example.com/region')+item('محتوى قديم','https://example.com/old',now-9*86400000)+item('غير آمن','javascript:alert(1)')+'</rss>','مصدر',now);
 assert.equal(data.length,3);assert.equal(data[0].summary,'وصف مختصر');
 assert.deepEqual(orderNews(data).map(x=>x.area),['iraq','region','world']);assert.equal(orderNews([...data,...data]).length,3);
});
test('Partial feed outage is explicit and never fabricates news',async()=>{
 const data=await buildNews(async url=>{if(url.includes('bbc'))throw Error('offline');return new Response('<rss>'+item('العراق','https://example.com/news')+'</rss>')});
 assert.equal(data.partial,true);assert.equal(data.items.length,1);assert.equal(data.items[0].source,'الجزيرة');
});
test('Content routes require the app session and reject writes',async()=>{
 assert.equal((await callContentRoute({request:new Request('https://shinomino.com/api/call-content/news'),env:{}})).status,401);
 assert.equal((await callContentRoute({request:new Request('https://shinomino.com/api/call-content/news',{method:'POST'}),env:{}})).status,405);
});

test('News uses source images and MP4 enclosures, rejects unsafe media and preserves encoded URLs',async()=>{
 const {newsMedia}=await import('../cloudflare/pages/call-content.js');
 assert.deepEqual(newsMedia('<media:thumbnail url="https://example.com/a.jpg?a=1&amp;b=2"/><enclosure type="video/mp4" url="https://example.com/clip.mp4"/>'),{image:'https://example.com/a.jpg?a=1&b=2',video:'https://example.com/clip.mp4'});
 assert.deepEqual(newsMedia('<media:content medium="image" url="javascript:alert(1)"/><enclosure type="text/html" url="https://example.com/frame"/>'),{image:'',video:''});
 assert.equal(newsMedia('<description><![CDATA[<img src="https://example.com/photo.jpg">]]></description>').image,'https://example.com/photo.jpg');
});
test('Discover cards pair a real article with its own image and expanded text',async()=>{
 const {explore}=await import('../cloudflare/pages/call-content.js');
 const data=await explore('food',async url=>{assert.match(url,/pageimages/);assert.match(url,/pilicense=free/);return Response.json({query:{pages:{1:{pageid:1,title:'دولمة',extract:'تفاصيل حقيقية '.repeat(70),fullurl:'https://ar.wikipedia.org/wiki/Dolma',thumbnail:{source:'https://upload.wikimedia.org/dolma.jpg'}},2:{pageid:2,title:'بلا صورة',extract:'نص',fullurl:'https://ar.wikipedia.org/wiki/Other'}}}})});
 assert.equal(data.items.length,1);assert.ok(data.items[0].detail.length>data.items[0].summary.length);assert.equal(data.items[0].image,'https://upload.wikimedia.org/dolma.jpg');
});
