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
    var profilePostsCss = document.createElement('link');
    profilePostsCss.rel = 'stylesheet';
    profilePostsCss.href = 'profile-posts.css?v=20260910-1';
    document.head.appendChild(profilePostsCss);

    var profilePosts = document.createElement('script');
    profilePosts.src = 'profile-posts.js?v=20260910-1';
    profilePosts.defer = true;
    document.head.appendChild(profilePosts);
  }

  if (/\/(?:taktak\.html)?$/i.test(location.pathname)) {
    if (!document.querySelector('link[data-home-notifications]')) {
      var notificationsCss = document.createElement('link');
      notificationsCss.rel = 'stylesheet';
      notificationsCss.href = 'home-notifications.css?v=20260911-1';
      notificationsCss.setAttribute('data-home-notifications', '1');
      document.head.appendChild(notificationsCss);
    }
    var notificationsScript = document.createElement('script');
    notificationsScript.src = 'home-notifications.js?v=20260911-1';
    notificationsScript.defer = true;
    document.head.appendChild(notificationsScript);
  }

  var token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) window.location.replace('signin.html');
})();
