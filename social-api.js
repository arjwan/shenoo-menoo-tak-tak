(function (global) {
  "use strict";

  var API_BASE_URL = window.location.protocol === "file:"
    ? "https://shino-mino-tak-tak.duckdns.org"
    : window.location.origin;

  function getToken() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  }

  async function request(path, options) {
    var config = Object.assign({}, options || {});
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

  global.SocialAPI = { request: request, token: getToken, baseUrl: API_BASE_URL, version: "2026.09.07.2" };
}(window));
