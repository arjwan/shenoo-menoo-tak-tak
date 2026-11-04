(function (global) {
  "use strict";

  var API_BASE_URL = window.location.protocol === "file:"
    ? "https://shinomino.com"
    : window.location.origin;

  // Auth uses HttpOnly cookies; browser tokens are not accepted here.
  function getToken(){return '';}

  async function request(path, options) {
    if (global.shnoSessionReady && !(await global.shnoSessionReady)) throw new Error('انتهت الجلسة، يرجى تسجيل الدخول');
    var config = Object.assign({ cache: "no-store" }, options || {});
    config.headers = Object.assign({ Accept: "application/json" }, config.headers || {});

    config.credentials = 'same-origin';

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
