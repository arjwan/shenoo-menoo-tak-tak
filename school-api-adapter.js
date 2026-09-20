/* school-api-adapter.js — shared client for the seven standalone school pages.
 * Talks only to the real /api/school surface (auth required). No fake data. */
(function (global) {
  'use strict';
  function token() {
    try { return localStorage.getItem('token') || sessionStorage.getItem('token') || ''; }
    catch (e) { return ''; }
  }
  function headers(extra) {
    var h = { 'Accept': 'application/json' };
    if (token()) h.Authorization = 'Bearer ' + token();
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }
  function req(path, opts) {
    opts = opts || {};
    var init = {
      method: opts.method || 'GET',
      headers: headers(opts.json ? { 'Content-Type': 'application/json' } : opts.headers)
    };
    if (opts.body != null) init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    return fetch(path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { status: r.status, ok: r.ok && d && d.ok !== false, data: d };
      });
    });
  }
  var api = {
    token: token,
    dashboard: function () { return req('/api/school/dashboard'); },
    structure: function () { return req('/api/school/structure'); },
    teachers: function () { return req('/api/school/teachers'); },
    students: function () { return req('/api/school/students'); },
    createStudent: function (body) { return req('/api/school/students', { method: 'POST', json: true, body: body }); },
    books: function (query) {
      var q = new URLSearchParams(query || {}).toString();
      return req('/api/school/books' + (q ? ('?' + q) : ''));
    },
    catalog: function (query) {
      var q = new URLSearchParams(query || {}).toString();
      return req('/api/school/curriculum/catalog' + (q ? ('?' + q) : ''));
    },
    files: function () { return req('/api/school/curriculum/files'); },
    reader: function (id) { return req('/api/school/books/' + encodeURIComponent(id) + '/reader'); },
    classroomOptions: function () { return req('/api/school/classroom/options'); },
    classroomAction: function (body) { return req('/api/school/classroom/actions', { method: 'POST', json: true, body: body }); },
    startSession: function (body) { return req('/api/school/sessions/start', { method: 'POST', json: true, body: body }); },
    activeSession: function () { return req('/api/school/sessions/active'); }
  };
  global.SchoolAPI = api;
})(typeof window !== 'undefined' ? window : global);
