(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const requested=params.get('call');
  const userId=params.get('user');
  if(!['audio','video'].includes(requested)||!userId)return;

  // private-messages.js owns conversation creation and WebRTC signalling.
  // Do not emit call:invite here as well: doing so can ring the recipient twice.
  let tries=0;
  const timer=setInterval(function(){
    tries++;
    const button=document.querySelector('[data-start-call="'+requested+'"]');
    if(button){
      clearInterval(timer);
      button.click();
      return;
    }
    if(tries>40)clearInterval(timer);
  },250);
}());
