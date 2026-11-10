(function(global){
 'use strict';let loaded=null,expires=0;
 let config={iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]};
 global.ShnoCallIce={config:()=>config,async prepare(){
  if(loaded&&Date.now()<expires)return loaded;
  expires=Date.now()+3600000;
  loaded=global.SocialAPI.request('/api/call-ice').then(data=>{if(data.ok&&data.iceServers?.length)config={iceServers:data.iceServers};return config;}).catch(()=>{expires=Date.now()+30000;return config;});
  return loaded;
 }};
})(window);
