'use strict';
const MEDIA_CACHE='shno-mano-media-v1';
const isMedia=req=>{try{const u=new URL(req.url);return ['video','audio','image'].includes(req.destination)||u.pathname.startsWith('/uploads/')}catch(_){return false}};
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET'||!isMedia(req))return;
 event.respondWith((async()=>{
  const cache=await caches.open(MEDIA_CACHE),cached=await cache.match(req.url);
  if(cached){
   const range=req.headers.get('range');
   if(range){try{const blob=await cached.blob(),m=/bytes=(\d+)-(\d*)/.exec(range);if(m&&blob.size){const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),blob.size-1):blob.size-1;if(start<=end&&start<blob.size){const part=blob.slice(start,end+1,blob.type);return new Response(part,{status:206,statusText:'Partial Content',headers:{'Content-Type':blob.type||cached.headers.get('Content-Type')||'application/octet-stream','Content-Length':String(part.size),'Content-Range':`bytes ${start}-${end}/${blob.size}`,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable'}})}}}catch(_){}}
   return cached;
  }
  try{return await fetch(req)}catch(_){return new Response('',{status:503,statusText:'Offline media unavailable'})}
 })());
});