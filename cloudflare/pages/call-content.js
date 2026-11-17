// Authenticated, bounded content feeds. Never accepts an upstream URL from a client.
const NEWS_SOURCES = [
  {name:'BBC عربي',url:'https://feeds.bbci.co.uk/arabic/rss.xml'},
  {name:'الجزيرة',url:'https://www.aljazeera.net/aljazeerarss/'}
];
const TOPICS = {food:'مطبخ عراقي',flowers:'زهرة',tourism:'السياحة في العراق',knowledge:'علوم',photos:'Iraq nature landscape'};
const plain = value => String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|#39);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[s])).replace(/\s+/g,' ').trim();
const secure = value => {try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}};
const attribute=(tag,name)=>plain(tag.match(new RegExp('\\b'+name+'=["\']([^"\']*)["\']','i'))?.[1]||'');
export function newsMedia(item){
 const tags=[...item.matchAll(/<(?:media:(?:thumbnail|content)|enclosure)\b[^>]*>/gi)].map(m=>m[0]);
 let image='',video='';
 for(const tag of tags){const url=secure(attribute(tag,'url')),type=attribute(tag,'type'),medium=attribute(tag,'medium');if(!url)continue;
  if(/video\/mp4/i.test(type)||medium==='video'&&/\.mp4(?:[?#]|$)/i.test(url))video ||=url;
  else if(/media:thumbnail/i.test(tag)||/^image\//i.test(type)||medium==='image'||/\.(?:jpg|jpeg|png|webp)(?:[?#]|$)/i.test(url))image ||=url;
 }
 if(!image){const raw=item.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1');const img=raw.match(/<img\b[^>]*>/i)?.[0];if(img)image=secure(attribute(img,'src'));}
 return {image,video};
}
export function parseNews(xml,source,now=Date.now()) {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,60).map(([,item])=>{
    const tag=n=>item.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+n+'>','i'))?.[1]||'';
    const title=plain(tag('title')).slice(0,250),summary=plain(tag('description')).slice(0,600),url=secure(plain(tag('link')));
    const timestamp=Date.parse(tag('pubDate'));
    if(!url||!title||!Number.isFinite(timestamp)||timestamp>now+3600000||now-timestamp>7*86400000)return null;
    const text=title+' '+summary;
    const area=/العراق|عراقي|بغداد|الموصل|البصرة|كردستان|دهوك|أربيل/.test(text)?'iraq':/إيران|إسرائيل|فلسطين|لبنان|سوريا|الأردن|تركيا|السعودية|الخليج|غزة|مصر|اليمن/.test(text)?'region':'world';
    const category=/عاجل/.test(title)?'breaking':/رياض|مباراة|كرة|منتخب|بطولة/.test(text)?'sport':/فن|سينما|موسيقى|مهرجان/.test(text)?'arts':/انتخاب|حكومة|رئيس|حرب|سياس/.test(text)?'politics':'general';
    return {id:url,title,summary,url,source,area,category,...newsMedia(item),publishedAt:new Date(timestamp).toISOString()};
  }).filter(Boolean);
}
export function orderNews(items){return [...new Map(items.map(x=>[x.url,x])).values()].sort((a,b)=>{
 const rank=x=>x.area==='iraq'||x.category==='breaking'?0:x.area==='region'?1:2;
 return rank(a)-rank(b)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt);
});}
async function boundedFetch(url,fetcher){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try {
  const r=await fetcher(url,{signal:controller.signal,headers:{'User-Agent':'ShnoManoCall/1.5 (+https://shinomino.com/support.html)','Accept':'application/json, application/rss+xml, text/xml'}});
  if(!r.ok)throw Error('Upstream unavailable');
  const reader=r.body.getReader();let size=0,parts=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1500000){await reader.cancel();throw Error('Feed too large')}parts.push(value)}
  const all=new Uint8Array(size);let pos=0;for(const p of parts){all.set(p,pos);pos+=p.length}return new TextDecoder().decode(all);
 } finally {clearTimeout(timer)}
}
export async function buildNews(fetcher=fetch){
 const results=await Promise.allSettled(NEWS_SOURCES.map(async s=>parseNews(await boundedFetch(s.url,fetcher),s.name)));
 const items=orderNews(results.flatMap(r=>r.status==='fulfilled'?r.value:[])).slice(0,90);
 return {ok:true,items,updatedAt:new Date().toISOString(),partial:results.some(r=>r.status==='rejected'),sources:NEWS_SOURCES.map(s=>s.name)};
}
export async function explore(topic,fetcher=fetch){
 if(topic==='photos'){
  const params=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:TOPICS.photos,gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'640'});
  const data=JSON.parse(await boundedFetch('https://commons.wikimedia.org/w/api.php?'+params,fetcher));
  const items=Object.values(data.query?.pages||{}).map(p=>{const i=p.imageinfo?.[0],m=i?.extmetadata||{};return {id:String(p.pageid),title:plain(p.title).replace(/^File:/,''),image:secure(i?.thumburl),url:secure(i?.descriptionurl),credit:plain(m.Artist?.value).slice(0,200),license:plain(m.LicenseShortName?.value),summary:plain(m.ImageDescription?.value).slice(0,450),source:'Wikimedia Commons'}}).filter(i=>i.image&&i.url&&i.credit&&i.license);
  return {ok:true,items,updatedAt:new Date().toISOString()};
 }
 const params=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:TOPICS[topic],gsrnamespace:'0',gsrlimit:'24',prop:'extracts|info|pageimages',piprop:'thumbnail',pithumbsize:'800',pilicense:'free',inprop:'url',exintro:'1',explaintext:'1',exchars:'1800'});
 const data=JSON.parse(await boundedFetch('https://ar.wikipedia.org/w/api.php?'+params,fetcher));
 return {ok:true,items:Object.values(data.query?.pages||{}).map(p=>({id:String(p.pageid),title:p.title,image:secure(p.thumbnail?.source),summary:plain(p.extract).slice(0,320),detail:plain(p.extract).slice(0,1800),url:secure(p.fullurl),source:'ويكيبيديا',license:'CC BY-SA — راجع صفحة المصدر ونسب المساهمين'})).filter(i=>i.url&&i.image&&i.detail).slice(0,12),updatedAt:new Date().toISOString()};
}
export async function callContentRoute({request,env},fetcher=fetch,cache=globalThis.caches?.default){
 if(request.method!=='GET')return Response.json({ok:false,message:'الطريقة غير مدعومة'},{status:405});
 const {getAuthenticatedAppUser}=await import('./profile-session.js');
 const user=env.DB&&await getAuthenticatedAppUser(request,env);
 if(!user)return Response.json({ok:false,message:'يرجى تسجيل الدخول'},{status:401,headers:{'Cache-Control':'no-store'}});
 const u=new URL(request.url),kind=u.pathname.endsWith('/news')?'news':u.pathname.endsWith('/discover')?'discover':'';
 const topic=u.searchParams.get('topic')||'food';
 if(!kind||kind==='discover'&&!Object.hasOwn(TOPICS,topic))return Response.json({ok:false,message:'قسم غير معروف'},{status:404});
 const key=new Request(u.origin+'/__call-content-cache-v2/'+kind+'/'+(kind==='news'?'all':topic));
 const hit=cache&&await cache.match(key);if(hit)return hit;
 try{
  const body=kind==='news'?await buildNews(fetcher):await explore(topic,fetcher);
  if(!body.items.length)return Response.json({ok:false,message:'تعذر جلب محتوى حديث من المصادر. أعد المحاولة لاحقاً.'},{status:503,headers:{'Cache-Control':'no-store'}});
  const response=Response.json(body,{headers:{'Cache-Control':'public, max-age='+(kind==='news'?120:600)}});
  if(cache)await cache.put(key,response.clone());
  // This content is public-source material; authentication is checked before cache access.
  return response;
 }catch{return Response.json({ok:false,message:'تعذر الاتصال بمصادر المحتوى حالياً'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
