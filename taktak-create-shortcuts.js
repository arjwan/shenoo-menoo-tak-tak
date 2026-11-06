(function(){
  'use strict';
  const createButton=document.querySelector('[data-create-post]');
  if(!createButton)return;
  createButton.addEventListener('click',function(){
    const composer=document.querySelector('[data-composer]');
    const editor=composer?.querySelector('[data-post-text]');
    if(!composer||!editor)return;
    composer.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
    // The post is only published using the existing composer submit flow.
    editor.focus({preventScroll:true});
  });
})();
