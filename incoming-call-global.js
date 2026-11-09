/* Incoming call watcher across authenticated Shno Mano pages.
 * Ringtone and incoming-call UI work even when the conversation is not open.
 * Background/closed-app delivery is handled separately by a native push service.
 */
(function(global){
  'use strict';
  if(global.ShnoIncomingCalls)return;
  var inMessages=/\/messages\.html$/i.test(location.pathname);
  var active=null, bell=null, audio=null, timer=null, cursor=0, stopped=false, ready=false;
  var lastCursorKey='shno-call-cursor';
  function request(url,options){
    return fetch(url,Object.assign({credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}},options||{}))
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();});
  }
  function stopSound(){
    if(timer){clearInterval(timer);timer=null;}
    if(audio){try{audio.close();}catch(_){ }audio=null;}
    if(global.ShnoManoNative&&typeof global.ShnoManoNative.stopIncomingCallAlert==='function'){
      try{global.ShnoManoNative.stopIncomingCallAlert();}catch(_){}
    }
  }
  function beep(){
    if(!audio){try{audio=new (global.AudioContext||global.webkitAudioContext)();}catch(_){return;}}
    if(audio.state==='suspended')audio.resume().catch(function(){});
    if(audio.state!=='running')return;
    var now=audio.currentTime;
    [0,0.34].forEach(function(delta){
      var osc=audio.createOscillator(),gain=audio.createGain();
      osc.type='sine';osc.frequency.value=523.25;
      gain.gain.setValueAtTime(0.0001,now+delta);
      gain.gain.exponentialRampToValueAtTime(0.06,now+delta+0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+delta+0.27);
      osc.connect(gain).connect(audio.destination);osc.start(now+delta);osc.stop(now+delta+0.28);
    });
  }
  function startSound(){
    if(global.ShnoManoNative&&typeof global.ShnoManoNative.showIncomingCallAlert==='function'){
      try{global.ShnoManoNative.showIncomingCallAlert(active.callId,active.callerName,active.from,active.conversationId,active.type);}catch(_){}
      return;
    }
    beep();timer=setInterval(beep,2150);
  }
  function clear(){
    stopSound();
    if(bell){bell.remove();bell=null;}
    active=null;
  }
  function send(event,reason){
    if(!active)return Promise.resolve();
    return request('/api/call-signals',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        event:event,callId:active.callId,conversationId:active.conversationId,
        userId:active.from,type:active.type,reason:reason||''
      })
    }).catch(function(){});
  }
  function answer(){
    if(!active)return;
    var url='messages.html?conversation='+encodeURIComponent(active.conversationId)+'&incomingCall='+encodeURIComponent(active.callId);
    // The original conversation page handles the real WebRTC acceptance.
    stopSound();location.assign(url);
  }
  function dismiss(){
    send('call:reject','rejected');
    clear();
  }
  function show(event){
    if(!event||!event.callId||!event.conversationId||!event.from)return;
    if(active){
      if(active.callId===event.callId)return;
      send('call:reject','busy');return;
    }
    active={callId:String(event.callId),conversationId:String(event.conversationId),
      from:String(event.from),type:event.type==='video'?'video':'audio',
      callerName:String(event.callerName||'مستخدم شنو منو')};
    // In the conversation page, the existing call modal owns the buttons.
    if(inMessages){startSound();return;}
    // Use DOM methods for contact names to avoid HTML injection.
    bell=document.createElement('div');
    bell.setAttribute('role','alertdialog');
    bell.setAttribute('aria-label','مكالمة واردة');
    bell.style.cssText='position:fixed;z-index:2147483000;inset:0;display:flex;align-items:center;justify-content:center;background:#070b1ccc;padding:18px;direction:rtl';
    var card=document.createElement('section');
    card.style.cssText='width:min(100%,370px);border:1px solid #7c72dd88;border-radius:26px;background:#19223b;color:#fff;box-shadow:0 18px 50px #0009;padding:27px 22px;text-align:center;font-family:inherit';
    var title=document.createElement('h2');title.textContent=active.type==='video'?'📹 مكالمة فيديو واردة':'📞 مكالمة صوتية واردة';
    var name=document.createElement('p');name.textContent=active.callerName;name.style.cssText='font-size:21px;font-weight:bold;margin:20px 0';
    var actions=document.createElement('div');actions.style.cssText='display:flex;gap:12px;justify-content:center';
    var accept=document.createElement('button');accept.type='button';accept.textContent='قبول';accept.style.cssText='background:#178b6c;color:white;border:0;border-radius:14px;padding:13px 30px;font-weight:bold';
    var reject=document.createElement('button');reject.type='button';reject.textContent='رفض';reject.style.cssText='background:#a32e4d;color:white;border:0;border-radius:14px;padding:13px 30px;font-weight:bold';
    accept.addEventListener('click',answer);reject.addEventListener('click',dismiss);
    actions.append(accept,reject);card.append(title,name,actions);bell.append(card);
    document.body.appendChild(bell);startSound();
    if('Notification' in global&&Notification.permission==='granted'&&document.hidden){
      try{var n=new Notification('مكالمة واردة من شنو منو',{body:active.callerName,tag:'shno-incoming-call',requireInteraction:true});
        n.onclick=function(){global.focus();n.close();answer();};}catch(_){}
    }
  }
  function onSignal(event){
    var d=event&&event.payload||{};
    var type=event&&event.event||'';
    if(type==='call:invite')show({callId:event.callId,conversationId:event.conversationId,
      from:event.from,callerName:event.callerName,type:d.type});
    if((type==='call:end'||type==='call:reject'||type==='call:accept')&&active&&event.callId===active.callId)clear();
  }
  async function poll(){
    if(stopped||inMessages)return;
    try{
      var r=await request('/api/call-signals?after='+cursor);
      if(r.ok){
        (r.events||[]).forEach(onSignal);
        cursor=Number(r.cursor)||cursor;
      }
    }catch(_){}
    if(!stopped)setTimeout(poll,1500);
  }
  global.ShnoIncomingCalls={
    incoming:function(event){show(event);},
    end:function(callId){if(active&&(!callId||active.callId===callId))clear();},
    stop:clear
  };
  var allowAudio=function(){
    // Web Audio may require a prior user gesture on ordinary browsers.
    try{var c=new (global.AudioContext||global.webkitAudioContext)();c.resume().then(function(){c.close();}).catch(function(){});}catch(_){}
    if('Notification' in global&&Notification.permission==='default')Notification.requestPermission().catch(function(){});
  };
  document.addEventListener('pointerdown',allowAudio,{once:true,passive:true});
  Promise.resolve(global.shnoSessionReady||true).then(function(auth){
    if(auth===false)return;
    ready=true;
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',poll,{once:true});
    else poll();
  }).catch(function(){});
  global.addEventListener('beforeunload',function(){stopped=true;stopSound();});
}(window));
