var CACHE_NAME = "shenoo-mall-shell-v3";
var SHELL = [
  "mall.html", "stores.html", "store.html", "store-create.html", "store-dashboard.html",
  "mall.css", "mall-pages.css", "mall.js", "offline-store.js", "stores.js", "store.js",
  "store-create.js", "store-dashboard.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL); })
      .catch(function () { return undefined; })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
        return cached || new Response("هذه الصفحة غير محفوظة على جهازك وتحتاج اتصالاً بالإنترنت لفتحها.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      });
    })
  );
});
