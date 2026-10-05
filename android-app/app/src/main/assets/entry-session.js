(function () {
  'use strict';
  async function resumeSession() {
    var token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;
    var button = document.querySelector('#signinForm button[type="submit"]');
    var message = document.getElementById('formMessage');
    function show(text) {
      message.className = 'message info';
      message.textContent = text;
    }
    button.disabled = true;
    show('جارٍ التحقق من جلسة الدخول…');
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    try {
      var response = await fetch('https://shino-mino-tak-tak.duckdns.org/api/users/me', {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
      if (response.status === 401) {
        [localStorage, sessionStorage].forEach(function (storage) {
          storage.removeItem('token');
          storage.removeItem('user');
        });
        show('انتهت جلسة الدخول. سجّل دخولك مرة أخرى.');
        return;
      }
      var data = await response.json();
      if (!response.ok || data.ok !== true || !data.user) {
        show('تعذر التحقق من الجلسة. يمكنك إعادة تسجيل الدخول.');
        return;
      }
      if ((localStorage.getItem('token') || sessionStorage.getItem('token')) !== token) return;
      var storage = localStorage.getItem('token') ? localStorage : sessionStorage;
      storage.setItem('user', JSON.stringify(data.user));
      window.location.replace('https://shino-mino-tak-tak.duckdns.org/taktak.html');
    } catch (error) {
      show('تعذر الاتصال بالخادم للتحقق من الجلسة. حاول تسجيل الدخول مجددًا.');
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
    }
  }
  resumeSession();
})();
