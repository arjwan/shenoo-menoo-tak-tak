(function () {
  var themeScript = document.createElement('script');
  themeScript.src = 'theme.js?v=20260913-6';
  themeScript.defer = true;
  document.head.appendChild(themeScript);

  if (!document.querySelector('script[data-shno-i18n]')) {
    var i18n = document.createElement('script');
    i18n.src = 'i18n.js?v=20260913-1';
    i18n.defer = true;
    i18n.setAttribute('data-shno-i18n', '1');
    document.head.appendChild(i18n);
  }

  if (!document.querySelector('link[data-theme-light-fixes]')) {
    var themeFixes=document.createElement('link'); themeFixes.rel='stylesheet'; themeFixes.href='theme-light-fixes.css?v=20260913-6'; themeFixes.setAttribute('data-theme-light-fixes','1'); document.head.appendChild(themeFixes);
  }
  if (!document.querySelector('link[data-theme-pages]')) {
    var themePages=document.createElement('link'); themePages.rel='stylesheet'; themePages.href='theme-pages.css?v=20260913-2'; themePages.setAttribute('data-theme-pages','1'); document.head.appendChild(themePages);
  }
  if (!document.querySelector('link[data-post-spacing]')) {
    var postSpacing=document.createElement('link'); postSpacing.rel='stylesheet'; postSpacing.href='post-spacing.css?v=20260913-1'; postSpacing.setAttribute('data-post-spacing','1'); document.head.appendChild(postSpacing);
  }
  if (!document.querySelector('link[data-platform-upgrades]')) {
    var upgradesCss=document.createElement('link'); upgradesCss.rel='stylesheet'; upgradesCss.href='platform-upgrades.css?v=20260913-1'; upgradesCss.setAttribute('data-platform-upgrades','1'); document.head.appendChild(upgradesCss);
  }
  if (!document.querySelector('script[data-shno-media-cache]')) {
    var mediaCache=document.createElement('script'); mediaCache.src='media-cache.js?v=20260912-2'; mediaCache.defer=true; mediaCache.setAttribute('data-shno-media-cache','1'); document.head.appendChild(mediaCache);
  }
  if (!document.querySelector('link[data-taktak-mobile-fixes]')) {
    var fixes=document.createElement('link'); fixes.rel='stylesheet'; fixes.href='taktak-mobile-fixes.css?v=20260910-2'; fixes.setAttribute('data-taktak-mobile-fixes','1'); document.head.appendChild(fixes);
  }

  var smartFriendPolish=document.createElement('script'); smartFriendPolish.src='smart-friend-ui-polish.js?v=20260911-2'; smartFriendPolish.defer=true; document.head.appendChild(smartFriendPolish);

  if (/\bprofile\.html$/i.test(location.pathname)) {
    var profilePostsCss=document.createElement('link'); profilePostsCss.rel='stylesheet'; profilePostsCss.href='profile-posts.css?v=20260910-1'; document.head.appendChild(profilePostsCss);
    var profilePosts=document.createElement('script'); profilePosts.src='profile-posts.js?v=20260910-1'; profilePosts.defer=true; document.head.appendChild(profilePosts);
  }

  if (/\bsettings\.html$/i.test(location.pathname)) {
    var notificationSettingsCss=document.createElement('link'); notificationSettingsCss.rel='stylesheet'; notificationSettingsCss.href='notification-settings.css?v=20260913-1'; document.head.appendChild(notificationSettingsCss);
    var notificationSettings=document.createElement('script'); notificationSettings.src='notification-settings.js?v=20260913-2'; notificationSettings.defer=true; document.head.appendChild(notificationSettings);
    var devicePanel=document.createElement('script'); devicePanel.src='settings-device-panel.js?v=20260913-2'; devicePanel.defer=true; document.head.appendChild(devicePanel);
  }

  if (/\/(?:taktak\.html)?$/i.test(location.pathname)) {
    if (!document.querySelector('link[data-home-notifications]')) { var notificationsCss=document.createElement('link'); notificationsCss.rel='stylesheet'; notificationsCss.href='home-notifications.css?v=20260913-3'; notificationsCss.setAttribute('data-home-notifications','1'); document.head.appendChild(notificationsCss); }
    var notificationsScript=document.createElement('script'); notificationsScript.src='home-notifications.js?v=20260913-2'; notificationsScript.defer=true; document.head.appendChild(notificationsScript);
    if (!document.querySelector('script[data-direct-post-upload]')) { var directPostUpload=document.createElement('script'); directPostUpload.src='taktak-direct-upload.js?v=20260912-1'; directPostUpload.defer=true; directPostUpload.setAttribute('data-direct-post-upload','1'); document.head.appendChild(directPostUpload); }
    if (!document.querySelector('script[data-home-rooms-link]')) { var roomsLink=document.createElement('script'); roomsLink.src='home-rooms-link.js?v=20260913-1'; roomsLink.defer=true; roomsLink.setAttribute('data-home-rooms-link','1'); document.head.appendChild(roomsLink); }
    if (!document.querySelector('link[data-home-mini-tv]')) { var miniTvCss=document.createElement('link'); miniTvCss.rel='stylesheet'; miniTvCss.href='home-mini-tv.css?v=20260913-1'; miniTvCss.setAttribute('data-home-mini-tv','1'); document.head.appendChild(miniTvCss); }
    if (!document.querySelector('script[data-home-mini-tv]')) { var miniTv=document.createElement('script'); miniTv.src='home-mini-tv.js?v=20260913-1'; miniTv.defer=true; miniTv.setAttribute('data-home-mini-tv','1'); document.head.appendChild(miniTv); }
  }

  if (!document.querySelector('script[data-platform-upgrades]')) { var upgrades=document.createElement('script'); upgrades.src='platform-upgrades.js?v=20260913-3'; upgrades.defer=true; upgrades.setAttribute('data-platform-upgrades','1'); document.head.appendChild(upgrades); }

  var token=localStorage.getItem('token')||sessionStorage.getItem('token');
  if (!token) { window.location.replace('signin.html'); return; }

  if (!document.querySelector('script[data-shno-presence]')) { var presence=document.createElement('script'); presence.src='presence-client.js?v=20260913-1'; presence.defer=true; presence.setAttribute('data-shno-presence','1'); document.head.appendChild(presence); }

  if (!document.querySelector('link[data-shno-communication-dock]')) { var commCss=document.createElement('link'); commCss.rel='stylesheet'; commCss.href='communication-dock.css?v=20260913-toggle-page-4'; commCss.setAttribute('data-shno-communication-dock','1'); document.head.appendChild(commCss); }
  if (!document.querySelector('script[data-shno-communication-dock]')) { var comm=document.createElement('script'); comm.src='communication-dock.js?v=20260913-toggle-page-4'; comm.defer=true; comm.setAttribute('data-shno-communication-dock','1'); document.head.appendChild(comm); }
  if (!document.querySelector('link[data-shno-social-actions]')) { var socialActions=document.createElement('link'); socialActions.rel='stylesheet'; socialActions.href='social-actions-fix.css?v=20260913-4'; socialActions.setAttribute('data-shno-social-actions','1'); document.head.appendChild(socialActions); }
  if (/\/stories\.html$/i.test(location.pathname) && !document.querySelector('script[data-shno-story-deck]')) { var storyDeck=document.createElement('script'); storyDeck.src='stories-deck.js?v=20260913-2'; storyDeck.defer=true; storyDeck.setAttribute('data-shno-story-deck','1'); document.head.appendChild(storyDeck); }
  if (!document.querySelector('script[data-shno-messages-link]')) { var messagesLink=document.createElement('script'); messagesLink.src='communication-messages-link.js?v=20260913-2'; messagesLink.defer=true; messagesLink.setAttribute('data-shno-messages-link','1'); document.head.appendChild(messagesLink); }
})();