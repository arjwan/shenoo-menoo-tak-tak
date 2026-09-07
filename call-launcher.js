(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const requested=params.get('call');
  if(!['audio','video'].includes(requested))return;
  let tries=0;
  const timer=setInterval(function(){
    tries++;
    const button=document.querySelector('[data-start-call="'+requested+'"]');
    if(button){clearInterval(timer);button.click();return;}
    if(tries>40)clearInterval(timer);
  },250);
}());
