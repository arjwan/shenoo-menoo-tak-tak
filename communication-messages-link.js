(function(){
  'use strict';
  function addMessagesButton(){
    document.querySelectorAll('.shno-comm-card.is-contacts').forEach(function(card){
      if(card.querySelector('[data-open-shno-messages-page]')) return;
      var button=document.createElement('button');
      button.type='button';
      button.setAttribute('data-open-shno-messages-page','1');
      button.textContent='💬 شنو منو مراسلات';
      button.style.cssText='margin:10px 12px 4px;padding:12px 14px;border:0;border-radius:13px;background:linear-gradient(135deg,#6753df,#24a9d8);color:#fff;font:inherit;font-weight:900;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.18)';
      button.addEventListener('click',function(){ location.href='taal-nsolf.html'; });
      var search=card.querySelector('.shno-comm-search');
      if(search) card.insertBefore(button,search);
      else card.appendChild(button);
    });
  }
  addMessagesButton();
  var observer=new MutationObserver(addMessagesButton);
  observer.observe(document.documentElement,{childList:true,subtree:true});
}());
