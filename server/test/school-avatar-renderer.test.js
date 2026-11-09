'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../school-avatar-renderer.js'), 'utf8');
function harness(options = {}) {
  const calls = {draw:0, audio:0, close:0, frames:[]};
  const ctx = new Proxy({}, {set(o,k,v){o[k]=v;return true;},get(o,k){return o[k] || (()=>{calls.draw++;});}});
  const canvas = {width:280,height:280,hidden:false,getContext:()=>ctx};
  const img = {hidden:false};
  const events = {};
  class AudioElement {}
  class AudioContext {
    state = options.suspended ? 'suspended' : 'running';
    destination = {};
    createMediaElementSource(el) { calls.audio++; return {connect() {}}; }
    createAnalyser() { return {fftSize:256, smoothingTimeConstant:0,connect(){},getByteTimeDomainData(data){data.fill(options.loud ? 170 : 128);}}; }
    resume(){this.state='running';return Promise.resolve();}
    close(){this.state='closed';calls.close++;return Promise.resolve();}
  }
  const window = {AudioContext,addEventListener:(k,f)=>events[k]=f};
  const env = {window,document:{getElementById:id=>id==='sumerTeacherCanvas'?canvas:id==='teacherAvatarImg'?img:null},HTMLMediaElement:AudioElement,matchMedia:()=>({matches:!!options.reduced}),performance:{now:()=>100},requestAnimationFrame:cb=>(calls.frames.push(cb),calls.frames.length),cancelAnimationFrame:()=>{},Math,Uint8Array,console};
  vm.runInNewContext(source,env,{filename:'school-avatar-renderer.js',timeout:1000});
  return {avatar:window.SumerTeacherAvatar,canvas,img,calls,AudioElement,step(t=1000){const cb=calls.frames.pop();cb(t);},events};
}
test('Canvas renderer boots without network or camera and hides original image',()=>{
 const h=harness();assert.ok(h.avatar);assert.equal(h.img.hidden,true);assert.ok(h.calls.draw>0);h.avatar.destroy();
});
test('silent audio keeps mouth closed',async()=>{
 const h=harness();const el=new h.AudioElement();assert.equal(await h.avatar.attachAudioElement(el),true);h.avatar.setSpeakingState(true);h.step();assert.equal(h.avatar.level,0);h.avatar.destroy();
});
test('actual audio waveform opens mouth',async()=>{
 const h=harness({loud:true});await h.avatar.attachAudioElement(new h.AudioElement());h.avatar.setSpeakingState(true);h.step();assert.ok(h.avatar.level>0);h.avatar.destroy();
});
test('mute resets speaking and mouth state',async()=>{
 const h=harness({loud:true});await h.avatar.attachAudioElement(new h.AudioElement());h.avatar.setSpeakingState(true);h.step();h.avatar.setSpeakingState(false);assert.equal(h.avatar.level,0);assert.equal(h.avatar.speaking,false);h.avatar.destroy();
});
test('speech synthesis fallback animates without audio analyser',()=>{
 const h=harness();h.avatar.setSpeakingState(true);h.step();assert.ok(h.avatar.level>0);h.avatar.destroy();
});
test('reduced motion uses low-frequency redraw',()=>{
 const h=harness({reduced:true});h.avatar.setSpeakingState(true);h.step(200);assert.ok(h.avatar.level>0);h.avatar.destroy();
});
test('detach closes audio context and preserves renderer',async()=>{
 const h=harness();await h.avatar.attachAudioElement(new h.AudioElement());h.avatar.detachAudio();assert.equal(h.avatar.analyser,null);assert.equal(h.calls.close,1);h.avatar.destroy();
});
test('pagehide destroys renderer',()=>{
 const h=harness();h.events.pagehide();assert.equal(h.avatar.running,false);
});
