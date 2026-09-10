(function () {
  var themeScript = document.createElement('script');
  themeScript.src = 'theme.js';
  themeScript.defer = true;
  document.head.appendChild(themeScript);

  if (!document.querySelector('link[data-taktak-mobile-fixes]')) {
    var fixes = document.createElement('link');
    fixes.rel = 'stylesheet';
    fixes.href = 'taktak-mobile-fixes.css?v=20260910-2';
    fixes.setAttribute('data-taktak-mobile-fixes', '1');
    document.head.appendChild(fixes);
  }

  if (/\bprofile\.html$/i.test(location.pathname)) {
    var profilePosts = document.createElement('script');
    profilePosts.src = 'profile-posts.js?v=20260910-1';
    profilePosts.defer = true;
    document.head.appendChild(profilePosts);
  }

  var token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) window.location.replace('signin.html');
})();
