// Commercial release service worker: network-only until an audited offline
// data synchronization strategy is approved. Never cache authenticated pages,
// account information, or API responses in the browser.
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('shenoo-')).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING')self.skipWaiting();
});
// Intentionally no fetch interception. Requests use the network, and offline
// operation fails visibly rather than displaying obsolete/fake data.
