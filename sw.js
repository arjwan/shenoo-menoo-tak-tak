var CACHE_NAME="shenoo-offline-v5";
var CORE=[
 "index.html","signin.html","signup.html","taktak.html","messages.html","friends.html",
 "game-room.html","kahwa-games.css","kahwa-tawla-v2.js","kahwa-domino-ui.js",
 "tv.html","tv.css","tv.js","tv-current-channel.js","tv-room-mode.js","tv-chat-popup.js",
 "broadcast-ticker-client.js","tv-controls-autohide.js","social-api.js","social.css","mall.css"
];
self.addEventListener("install",function(event){
 event.waitUntil(caches.open(CACHE_NAME).then(function(cache){
  return Promise.allSettled(CORE.map(function(file){return cache.add(new Request(file,{cache:"reload"}));}));
 }));
 self.skipWaiting();
});
self.addEventListener("activate",function(event){
 event.waitUntil(caches.keys().then(function(keys){
  return Promise.all(keys.filter(function(key){return key!==CACHE_NAME;}).map(function(key){return caches.delete(key);}));
 }).then(function(){return self.clients.claim();}));
});
self.addEventListener("message",function(event){if(event.data==="SKIP_WAITING")self.skipWaiting();});
self.addEventListener("fetch",function(event){
 if(event.request.method!=="GET")return;
 var url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.indexOf("/api/")===0||url.pathname.indexOf("/socket.io/")===0)return;
 if(event.request.mode==="navigate"){
  event.respondWith(fetch(event.request).then(function(response){
   if(response&&response.ok)caches.open(CACHE_NAME).then(function(cache){cache.put(event.request,response.clone());});
   return response;
  }).catch(function(){
   return caches.match(event.request,{ignoreSearch:true}).then(function(cached){
    return cached||caches.match("taktak.html")||caches.match("index.html");
   });
  }));
  return;
 }
 event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(function(cached){
  var network=fetch(event.request).then(function(response){
   if(response&&response.ok)caches.open(CACHE_NAME).then(function(cache){cache.put(event.request,response.clone());});
   return response;
  }).catch(function(){return cached;});
  return cached||network;
 }));
});