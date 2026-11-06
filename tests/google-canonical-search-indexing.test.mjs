import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Google discovery uses only the official shinomino.com hostname',async()=>{
 const [robots,map,index]=await Promise.all([read('robots.txt'),read('sitemap.xml'),read('index.html')]);
 assert.match(robots,/Sitemap: https:\/\/shinomino\.com\/sitemap\.xml/);
 assert.match(map,/<loc>https:\/\/shinomino\.com\//);
 assert.doesNotMatch(robots+map,/duckdns\.org|pages\.dev/i);
 assert.match(index,/rel="canonical" href="https:\/\/shinomino\.com\//);
 assert.match(index,/"@type": "WebSite"/);
 assert.match(index,/"name": "شنو منو تك تك"/);
});
test('all sitemapped pages have official canonical URLs',async()=>{
 const map=await read('sitemap.xml');
 const urls=[...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
 assert.equal(urls.length,4);
 for(const url of urls){
  const pathname=new URL(url).pathname;
  const page=pathname==='/'?'index.html':pathname.slice(1);
  const body=await read(page);
  assert.match(body,new RegExp('rel="canonical" href="'+url.replaceAll('.','\\.')+'"'));
 }
});
test('developer URLs are crawlable to receive noindex and never appear in the sitemap',async()=>{
 const [robots,headers,admin,confirm,map]=await Promise.all([
  read('robots.txt'),read('_headers'),read('developer/index.html'),
  read('developer/confirm.html'),read('sitemap.xml')
 ]);
 assert.doesNotMatch(robots,/^Disallow: \/developer\//m);
 assert.match(headers,/\/developer\/\*\n  X-Robots-Tag: noindex, nofollow, noarchive/);
 assert.match(admin,/<meta name="robots" content="noindex,nofollow,noarchive">/);
 assert.match(confirm,/<meta name="robots" content="noindex,nofollow">/);
 assert.doesNotMatch(map,/developer/i);
});
