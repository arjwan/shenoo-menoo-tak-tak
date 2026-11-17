(() => {
  'use strict';
  const panel = document.querySelector('.home-reels-sidebar');
  const sidebar = document.querySelector('.right-side');
  const stories = document.querySelector('.feed > .stories-block');
  if (!panel || !sidebar || !stories) return;
  const compact = window.matchMedia('(max-width: 1100px)');
  function placeReels() {
    if (compact.matches) stories.after(panel);
    else sidebar.prepend(panel);
  }
  placeReels();
  compact.addEventListener('change', placeReels);
})();
