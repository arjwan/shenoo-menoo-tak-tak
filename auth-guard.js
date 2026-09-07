(function () {
  var themeScript = document.createElement('script');
  themeScript.src = 'theme.js';
  themeScript.defer = true;
  document.head.appendChild(themeScript);

  var token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) window.location.replace('signin.html');
})();
