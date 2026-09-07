(function (global) {
  "use strict";

  var DB_NAME = "shenoo-mall-offline";
  var DB_VERSION = 1;
  var API_BASE_URL = "https://shino-mino-tak-tak.duckdns.org";
  var IMAGE_CACHE = "shenoo-mall-images-v1";
  var shellPromise;

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains("stores")) db.createObjectStore("stores", { keyPath: "id" });
        if (!db.objectStoreNames.contains("products")) {
          var products = db.createObjectStore("products", { keyPath: "id" });
          products.createIndex("storeId", "storeId", { unique: false });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("تعذر فتح التخزين المحلي.")); };
    });
  }

  function transaction(storeName, mode, operation) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var result;
        tx.oncomplete = function () { db.close(); resolve(result); };
        tx.onerror = function () { db.close(); reject(tx.error || new Error("تعذر تحديث التخزين المحلي.")); };
        result = operation(tx.objectStore(storeName), function (value) { result = value; });
      });
    });
  }

  function all(storeName) {
    return transaction(storeName, "readonly", function (store, setResult) {
      var request = store.getAll();
      request.onsuccess = function () { setResult(request.result); };
      return request;
    });
  }

  function get(storeName, id) {
    return transaction(storeName, "readonly", function (store, setResult) {
      var request = store.get(id);
      request.onsuccess = function () { setResult(request.result || null); };
      return request;
    });
  }

  function save(storeName, value) {
    return transaction(storeName, "readwrite", function (store) { return store.put(value); });
  }

  function saveMany(storeName, values) {
    return transaction(storeName, "readwrite", function (store) {
      values.forEach(function (value) { store.put(value); });
      return null;
    });
  }

  function imageUrls(value) {
    var urls = value && (value.images || value.imageUrls || []);
    if (!Array.isArray(urls)) urls = urls ? [urls] : [];
    return urls.concat([value && value.logoUrl, value && value.coverUrl]).filter(Boolean);
  }

  async function cacheImages(value) {
    if (!("caches" in global)) return;
    var cache = await caches.open(IMAGE_CACHE);
    await Promise.all(imageUrls(value).map(async function (url) {
      try { if (!(await cache.match(url))) await cache.add(url); } catch (error) { return error; }
      return null;
    }));
  }

  async function cacheStore(store, products) {
    var normalizedStore = Object.assign({}, store, { id: String(store.id || store._id) });
    await save("stores", normalizedStore);
    if (products && products.length) {
      await saveMany("products", products.map(function (product) {
        return Object.assign({}, product, { id: String(product.id || product._id), storeId: normalizedStore.id });
      }));
    }
    await cacheImages(normalizedStore);
    await Promise.all((products || []).map(cacheImages));
    return normalizedStore;
  }

  async function fetchJson(path) {
    var response = await fetch(API_BASE_URL + path, { headers: { Accept: "application/json" } });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.message || "تعذر تحميل البيانات (" + response.status + ").");
    return data;
  }

  async function loadStores() {
    if (!global.navigator.onLine) return all("stores");
    try {
      var data = await fetchJson("/api/stores");
      var stores = data.stores || data.data || [];
      var normalized = stores.map(function (store) { return Object.assign({}, store, { id: String(store.id || store._id) }); });
      await saveMany("stores", normalized);
      await Promise.all(normalized.map(cacheImages));
      return normalized;
    } catch (error) {
      var cached = await all("stores");
      if (cached.length) return cached;
      throw error;
    }
  }

  async function loadStore(id) {
    var cached = await get("stores", String(id));
    if (!global.navigator.onLine) return cached ? { store: cached, products: await productsFor(id), offline: true } : null;
    try {
      var data = await fetchJson("/api/stores/" + encodeURIComponent(id));
      var store = data.store || data.data || data;
      var products = [];
      await cacheStore(store, products);
      return { store: store, products: products, offline: false };
    } catch (error) {
      if (!cached) throw error;
      return { store: cached, products: await productsFor(id), offline: true, fallbackError: error };
    }
  }

  function productsFor(storeId) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("products", "readonly");
        var request = tx.objectStore("products").index("storeId").getAll(String(storeId));
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function setOfflineBanner() {
    var banner = document.querySelector("[data-offline-banner]");
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "offline-banner";
      banner.dataset.offlineBanner = "";
      banner.setAttribute("role", "status");
      document.body.prepend(banner);
    }
    function update() {
      banner.textContent = global.navigator.onLine ? "" : "وضع عدم الاتصال · الأسعار والتوفر حسب آخر تحديث محفوظ";
      banner.hidden = global.navigator.onLine;
    }
    global.addEventListener("online", update);
    global.addEventListener("offline", update);
    update();
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  shellPromise = Promise.resolve().then(function () { setOfflineBanner(); registerServiceWorker(); });

  global.MallOffline = {
    ready: shellPromise,
    loadStores: loadStores,
    loadStore: loadStore,
    saveStore: cacheStore,
    getCachedStore: function (id) { return get("stores", String(id)); },
    getCachedProducts: productsFor,
    isOffline: function () { return !global.navigator.onLine; },
    cachedImage: function (url) { return caches.match(url).then(function (response) { return response ? response.url : ""; }).catch(function () { return ""; }); }
  };
}(window));
