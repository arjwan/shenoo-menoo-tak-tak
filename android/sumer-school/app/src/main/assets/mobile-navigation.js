(function () {
  'use strict';
  if (window.__sumerMobileNavigation) return;
  window.__sumerMobileNavigation = true;
  var start = null;
  var routes = [
    ['#welcome', 'الرئيسية'], ['#curriculum', 'المناهج'],
    ['#student/overview', 'مساحة الطالب'], ['#teacher/overview', 'مساحة المعلم'],
    ['#guardian/overview', 'ولي الأمر'], ['#admin/overview', 'الإدارة']
  ];

  function visibleRoutes() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.sumer-mobile-bar a[href^="#"]'));
    return tabs.map(function (tab) { return tab.getAttribute('href'); });
  }
  function drawerOpen() {
    return !!document.querySelector('.sumer-drawer.open');
  }
  function setDrawer(open) {
    if (window.SumerStore && window.SumerStore.setDrawer) window.SumerStore.setDrawer(open);
  }
  function navigate(direction) {
    var tabs = visibleRoutes();
    if (!tabs.length) {
      var active = document.querySelector('.tab-btn.active[data-tab]');
      if (active) {
        var choices = Array.prototype.slice.call(document.querySelectorAll('.tab-btn[data-tab]'));
        var nextTab = choices[choices.indexOf(active) + direction];
        if (nextTab) nextTab.click();
      } else if (direction < 0 && window.history.length > 1) window.history.back();
      return;
    }
    var current = location.hash || '#welcome';
    var index = tabs.findIndex(function (tab) { return current === tab || current.indexOf(tab + '/') === 0; });
    if (index < 0) index = 0;
    var next = index + direction;
    if (next >= 0 && next < tabs.length) location.hash = tabs[next];
  }
  function interactive(target) {
    return !!target.closest('input,textarea,select,button,a,[contenteditable],video,canvas,[role="slider"],.sumer-drawer,.sumer-mobile-bar');
  }
  document.addEventListener('touchstart', function (event) {
    if (Math.min(window.innerWidth, window.innerHeight) > 800 || event.touches.length !== 1 || interactive(event.target)) { start = null; return; }
    var t = event.touches[0];
    start = { x: t.clientX, y: t.clientY, target: event.target };
  }, { passive: true });
  document.addEventListener('touchend', function (event) {
    if (!start || event.changedTouches.length !== 1) return;
    var t = event.changedTouches[0];
    var dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) { start = null; return; }
    if (start.target.closest('[data-swipe],.swiper,.carousel,.overflow-x-auto')) { start = null; return; }
    if (drawerOpen()) setDrawer(false);
    else if (dx < 0 && start.x > window.innerWidth - 42) setDrawer(true);
    else navigate(dx < 0 ? 1 : -1);
    start = null;
  }, { passive: true });

  function fillDrawer() {
    var list = document.querySelector('.sumer-drawer .sumer-nav-list');
    if (!list || list.querySelector('.sumer-app-extra')) return;
    var tabs = visibleRoutes();
    routes.forEach(function (route) {
      if (!tabs.includes(route[0]) || list.querySelector('a[href="' + route[0] + '"]')) return;
      var item = document.createElement('li');
      item.className = 'sumer-nav-item sumer-app-extra';
      var link = document.createElement('a');
      link.href = route[0]; link.textContent = route[1];
      link.addEventListener('click', function () { setDrawer(false); });
      item.appendChild(link); list.appendChild(item);
    });
  }
  new MutationObserver(fillDrawer).observe(document.getElementById('sumer-drawer-mount') || document.body, { childList: true });
  fillDrawer();
})();
