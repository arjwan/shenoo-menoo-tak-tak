(function (global) {
  "use strict";

  var API_BASE_URL = window.location.protocol === "file:"
    ? "https://shino-mino-tak-tak.duckdns.org"
    : window.location.origin;

  function tokenTime(token) {
    try {
      var part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      var data = JSON.parse(decodeURIComponent(atob(part).split("").map(function(c){return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);}).join("")));
      return Number(data.iat || 0);
    } catch (_e) { return 0; }
  }
  function getToken() {
    var sessionToken = sessionStorage.getItem("token") || "";
    var rememberedToken = localStorage.getItem("token") || "";
    if (!sessionToken) return rememberedToken;
    if (!rememberedToken) return sessionToken;
    return tokenTime(sessionToken) >= tokenTime(rememberedToken) ? sessionToken : rememberedToken;
  }

  async function request(path, options) {
    var config = Object.assign({ cache: "no-store" }, options || {});
    config.headers = Object.assign({ Accept: "application/json" }, config.headers || {});

    var token = getToken();
    if (token) config.headers.Authorization = "Bearer " + token;

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 20000);
    config.signal = config.signal || controller.signal;

    try {
      var response = await fetch(API_BASE_URL + path, config);
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        var error = new Error(data.message || "تعذر تنفيذ الطلب (" + response.status + ").");
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error && error.name === "AbortError") throw new Error("انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  global.SocialAPI = { request: request, token: getToken, baseUrl: API_BASE_URL, version: "2026.09.16.identity7" };
  if ("caches" in window) {
    caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return /^shenoo-(mall-shell|shell|offline)-v[1-5]$/.test(k);}).map(function(k){return caches.delete(k);}));}).catch(function(){});
  }
  if ("serviceWorker" in navigator && window.location.protocol === "https:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(function (registration) {
        if (registration.waiting) registration.waiting.postMessage("SKIP_WAITING");
        registration.update().catch(function () {});
      }).catch(function () {});
    });
  }
}(window));
