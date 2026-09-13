(function () {
  'use strict';
  if (window.ShnoPresenceSocket) return;

  var API = 'https://shino-mino-tak-tak.duckdns.org';
  var token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  if (!token) return;

  function start() {
    if (!window.io || window.ShnoPresenceSocket) return;
    var socket = window.io(API, {
      auth: { token: token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
      reconnectionDelayMax: 5000,
      timeout: 12000
    });
    window.ShnoPresenceSocket = socket;

    function emit(name, detail) {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }
    socket.on('presence:state', function (payload) { emit('shno:presence:state', payload); });
    socket.on('presence:online', function (payload) { emit('shno:presence:online', payload); });
    socket.on('presence:offline', function (payload) { emit('shno:presence:offline', payload); });
    socket.on('connect', function () { emit('shno:presence:connected', { socketId: socket.id }); });
    socket.on('disconnect', function (reason) { emit('shno:presence:disconnected', { reason: reason }); });
  }

  if (window.io) {
    start();
    return;
  }

  var existing = document.querySelector('script[data-shno-socketio]');
  if (existing) {
    existing.addEventListener('load', start, { once: true });
    return;
  }

  var script = document.createElement('script');
  script.src = API + '/socket.io/socket.io.js';
  script.defer = true;
  script.setAttribute('data-shno-socketio', '1');
  script.addEventListener('load', start, { once: true });
  document.head.appendChild(script);
})();
