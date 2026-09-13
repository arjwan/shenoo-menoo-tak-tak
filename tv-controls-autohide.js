(function(){
'use strict';
const wrapper=document.getElementById('videoWrapper');
const video=document.getElementById('mainVideoPlayer');
if(!wrapper||!video)return;
let timer=null;

function showControls(){
  wrapper.classList.remove('controls-hidden');
  clearTimeout(timer);
  if(!video.paused&&!video.ended){
    timer=setTimeout(()=>wrapper.classList.add('controls-hidden'),3000);
  }
}

function hideSoon(){
  clearTimeout(timer);
  if(!video.paused&&!video.ended){
    timer=setTimeout(()=>wrapper.classList.add('controls-hidden'),1800);
  }
}

['mousemove','pointermove','pointerdown','touchstart','click'].forEach(name=>{
  wrapper.addEventListener(name,showControls,{passive:true});
});
wrapper.addEventListener('mouseleave',hideSoon);
video.addEventListener('play',hideSoon);
video.addEventListener('pause',showControls);
video.addEventListener('ended',showControls);
document.addEventListener('keydown',showControls);
showControls();
})();
