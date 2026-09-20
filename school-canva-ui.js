/* school-canva-ui.js — tiny helpers shared by the seven school pages. */
(function (global) {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function setText(id, text) { var n = $(id); if (n) n.textContent = text == null ? '' : String(text); }
  function showError(el, msg) {
    if (!el) return;
    el.hidden = false;
    el.textContent = msg || 'تعذر التحميل من خادم شنو منو';
    el.classList.add('is-error');
  }
  function clearError(el) { if (!el) return; el.hidden = true; el.textContent = ''; el.classList.remove('is-error'); }
  function requireAuth() {
    var t = '';
    try { t = localStorage.getItem('token') || sessionStorage.getItem('token') || ''; } catch (e) {}
    if (!t) {
      var box = $('auth-gate') || $('page-status');
      if (box) { box.hidden = false; box.textContent = 'يلزم تسجيل الدخول لعرض بيانات المدرسة الحقيقية.'; }
      return false;
    }
    return true;
  }
  function card(title, meta, extra) {
    var a = document.createElement('article');
    a.className = 'school-card';
    var h = document.createElement('h3');
    h.textContent = title || '—';
    a.appendChild(h);
    if (meta) {
      var p = document.createElement('p');
      p.className = 'meta';
      p.textContent = meta;
      a.appendChild(p);
    }
    if (extra) a.appendChild(extra);
    return a;
  }
  function badge(text, kind) {
    var s = document.createElement('span');
    s.className = 'badge badge-' + (kind || 'pending');
    s.textContent = text;
    return s;
  }
  function availabilityBadge(item) {
    var a = (item && item.availability) || 'source_pending';
    if (a === 'available') return badge('متاح للقراءة', 'ok');
    if (a === 'remote_ok') return badge('مفهرس — الملف غير على هذا الخادم', 'warn');
    if (a === 'verified_metadata') return badge('موثّق بدون ملف', 'warn');
    return badge('بانتظار المصدر', 'pending');
  }
  global.SchoolUI = { $, setText, showError, clearError, requireAuth, card, badge, availabilityBadge };
})(typeof window !== 'undefined' ? window : global);
