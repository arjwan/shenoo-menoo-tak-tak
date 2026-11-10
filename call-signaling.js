/* Private 1:1 WebRTC signaling on the current Cloudflare D1 cookie session.
   Retains the existing messages UI and RTCPeerConnection callbacks; no Socket.IO,
   retired DuckDNS host or bearer-token dependency. */
(function(global){
  'use strict';
  var allowed={ 'call:invite':1,'call:accept':1,'call:reject':1,'call:end':1,'webrtc:offer':1,'webrtc:answer':1,'webrtc:ice':1 };
  function create(){
    var listeners=Object.create(null), cursor=0, stopped=false, failures=0;
    var socket={connected:true,on:function(type,handler){
      if(!listeners[type])listeners[type]=[];
      listeners[type].push(handler);return socket;
    },emit:function(event,data,ack){
      if(!allowed[event]){
        if(typeof ack==='function')ack({ok:false,message:'الإشارة غير مدعومة'});
        return socket;
      }
      var value=data||{};
      if(!value.userId||!value.conversationId||!value.callId){
        if(typeof ack==='function')ack({ok:false,message:'معرّفات المكالمة غير مكتملة'});
        return socket;
      }
      global.SocialAPI.request('/api/call-signals',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          event:event,userId:value.userId,conversationId:value.conversationId,
          callId:value.callId,type:value.type,reason:value.reason,data:value.data||null
        })
      }).then(function(x){if(typeof ack==='function')ack(x);})
        .catch(function(e){if(typeof ack==='function')ack({ok:false,message:e.message||'تعذر توجيه المكالمة'});});
      return socket;
    }};
    async function dispatch(type,payload){
      for(var fn of (listeners[type]||[])){try{await fn(payload);}catch(e){console.error('Call event',type,e);}}
    }
    async function poll(){
      if(stopped)return;
      try{
        var r=await global.SocialAPI.request('/api/call-signals?after='+cursor);
        if(r.ok){
          failures=0;socket.connected=true;
          var events=r.events||[];
          var finished=new Set(events.filter(function(e){return ['call:end','call:reject','call:accept'].includes(e.event);}).map(function(e){return e.callId;}));
          for(var event of events){
            if(event.event==='call:invite' && finished.has(event.callId))continue;
            var d=event.payload||{};
            await dispatch(event.event,{
              callId:event.callId,conversationId:event.conversationId,
              from:event.from,userId:event.from,callerName:event.callerName,
              type:d.type,reason:d.reason,data:d.data
            });
          }
          cursor=r.cursor||cursor;
        }
      }catch(e){
        failures++;
        if(failures>=3&&socket.connected){
          socket.connected=false;dispatch('disconnect',{message:e.message});
        }
      }
      if(!stopped)global.setTimeout(poll,failures?2600:1300);
    }
    global.setTimeout(poll,0);
    global.addEventListener('beforeunload',function(){stopped=true;},{once:true});
    return socket;
  }
  global.ShnoCallSignaling={create:create};
}(window));
