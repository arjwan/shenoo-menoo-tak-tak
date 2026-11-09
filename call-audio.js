/* Audibly distinct ringback (caller) and incoming ringtone (recipient).
   Created/resumed from user gestures when possible due to browser autoplay policy. */
(function (global) {
  'use strict';
  var ctx=null, timer=null, mode=null;
  function audio() {
    if (!ctx || ctx.state==='closed') {
      var Constructor=global.AudioContext||global.webkitAudioContext;
      if (!Constructor) return null;
      try {ctx=new Constructor();}catch (_) {return null;}
    }
    if(ctx.state==='suspended')ctx.resume().catch(function(){});
    return ctx;
  }
  function notes(freq,delay,duration,volume) {
    var a=audio();
    if(!a || a.state!=='running')return;
    var time=a.currentTime+delay,osc=a.createOscillator(),g=a.createGain();
    osc.type='sine';osc.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,time);
    g.gain.exponentialRampToValueAtTime(volume,time+0.025);
    g.gain.setValueAtTime(volume,time+Math.max(0.04,duration-0.06));
    g.gain.exponentialRampToValueAtTime(0.0001,time+duration);
    osc.connect(g);g.connect(a.destination);osc.start(time);osc.stop(time+duration+0.015);
  }
  function ring() {
    if(mode==='ringback'){
      // Audible double ringing tone on caller's side.
      notes(440,0,0.95,0.085);notes(480,0,0.95,0.065);
      notes(440,1.03,0.95,0.085);notes(480,1.03,0.95,0.065);
    } else if(mode==='incoming'){
      notes(740,0,0.3,0.11);notes(587,0.34,0.3,0.11);
      notes(740,0.72,0.3,0.11);notes(587,1.06,0.3,0.11);
    }
  }
  function start(next) {
    if(!['ringback','incoming'].includes(next))return;
    if(mode===next)return;
    stop();mode=next;
    if(global.ShnoManoNative && typeof global.ShnoManoNative.startCallTone==='function'){
      try{global.ShnoManoNative.startCallTone(next);return;}catch(_){}
    }
    audio();ring();timer=setInterval(ring,next==='incoming'?2550:3500);
  }
  function stop() {
    mode=null;
    if(timer){clearInterval(timer);timer=null;}
    if(global.ShnoManoNative && typeof global.ShnoManoNative.stopCallTone==='function'){
      try{global.ShnoManoNative.stopCallTone();}catch(_){}
    }
  }
  // Preserve a resumed audio context after a user interaction, for incoming
  // alerts that may be triggered asynchronously by signaling.
  function unlock(){audio();}
  document.addEventListener('pointerdown',unlock,{passive:true});
  document.addEventListener('keydown',unlock);
  global.addEventListener('pagehide',stop);
  global.ShnoCallAudio={startRingback:function(){start('ringback');},
    startIncoming:function(){start('incoming');},stop:stop,unlock:unlock};
}(window));
