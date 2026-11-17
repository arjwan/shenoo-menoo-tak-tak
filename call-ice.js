(function(global){
 'use strict';let loaded=null,expires=0;
 let config={iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]};
 global.ShnoCallIce={constraints(type){
  const connection=global.navigator?.connection;
  let low=connection?.saveData||['slow-2g','2g','3g'].includes(connection?.effectiveType);
  try{low=low||new URLSearchParams(global.location.search).get('lowData')==='1'||global.localStorage.getItem('shno-call-low-data')==='1';}catch(_){}
  return {audio:{echoCancellation:true,noiseSuppression:true},video:type==='video'?(low?{width:{ideal:320,max:480},height:{ideal:240,max:360},frameRate:{ideal:15,max:15}}:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}}):false};
 },config:()=>config,async prepare(){
  if(loaded&&Date.now()<expires)return loaded;
  expires=Date.now()+3600000;
  loaded=global.SocialAPI.request('/api/call-ice').then(data=>{if(data.ok&&data.iceServers?.length)config={iceServers:data.iceServers};return config;}).catch(()=>{expires=Date.now()+30000;return config;});
  return loaded;
 }};
})(window);
