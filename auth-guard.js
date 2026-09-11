(function () {
  var themeScript = document.createElement('script');
  themeScript.src = 'theme.js';
  themeScript.defer = true;
  document.head.appendChild(themeScript);

  if (!document.querySelector('script[data-shno-media-cache]')) {
    var mediaCache = document.createElement('script');
    mediaCache.src = 'media-cache.js?v=20260912-2';
    mediaCache.defer = true;
    mediaCache.setAttribute('data-shno-media-cache', '1');
    document.head.appendChild(mediaCache);
  }

  if (!document.querySelector('link[data-taktak-mobile-fixes]')) {
    var fixes = document.createElement('link');
    fixes.rel = 'stylesheet';
    fixes.href = 'taktak-mobile-fixes.css?v=20260910-2';
    fixes.setAttribute('data-taktak-mobile-fixes', '1');
    document.head.appendChild(fixes);
  }

  var smartFriendPolish = document.createElement('script');
  smartFriendPolish.src = 'smart-friend-ui-polish.js?v=20260911-2';
  smartFriendPolish.defer = true;
  document.head.appendChild(smartFriendPolish);

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

    /* Capture media composer submits before the legacy multipart handler so
       images/audio/video go browser -> R2 -> finalize, never through Oracle FFmpeg. */
    if (!document.querySelector('script[data-direct-post-upload]')) {
      var directPostUpload = document.createElement('script');
      directPostUpload.src = 'taktak-direct-upload.js?v=20260912-1';
      directPostUpload.defer = true;
      directPostUpload.setAttribute('data-direct-post-upload', '1');
      document.head.appendChild(directPostUpload);
    }
  }

  var token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) window.location.replace('signin.html');
})();
