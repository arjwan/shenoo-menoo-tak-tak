(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const requested=params.get('call');
  const userId=params.get('user');
  if(!['audio','video'].includes(requested)||!userId)return;
  let conversationId='';
  SocialAPI.request('/api/conversations/'+encodeURIComponent(userId),{method:'POST'}).then(function(data){
    conversationId=data.conversation&&data.conversation.id||'';
    if(window.io&&conversationId){
      const socket=window.io(SocialAPI.baseUrl,{auth:{token:SocialAPI.token()}});
      socket.on('connect',function(){
        socket.emit('call:invite',{userId:userId,conversationId:conversationId,type:requested});
        setTimeout(function(){socket.disconnect();},1500);
      });
    }
  }).catch(function(){});
  let tries=0;
  const timer=setInterval(function(){
    tries++;
    const button=document.querySelector('[data-start-call="'+requested+'"]');
    if(button){clearInterval(timer);button.click();return;}
    if(tries>40)clearInterval(timer);
  },250);
}());
