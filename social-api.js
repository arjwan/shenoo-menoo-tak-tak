(function (global) {
  "use strict";
  var API_BASE_URL = "https://shino-mino-tak-tak.duckdns.org";
  function getToken() { return localStorage.getItem("token") || sessionStorage.getItem("token") || ""; }
  async function request(path, options) {
    var config = options || {};
    config.headers = Object.assign({ Accept: "application/json" }, config.headers || {});
    var token = getToken();
    if (token) config.headers.Authorization = "Bearer " + token;
    var response = await fetch(API_BASE_URL + path, config);
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.message || "تعذر تنفيذ الطلب (" + response.status + ").");
    return data;
  }
  global.SocialAPI = { request: request, token: getToken, baseUrl: API_BASE_URL };
}(window));
