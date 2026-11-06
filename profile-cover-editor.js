/* Crop controls are deliberately visual: the original R2 photo remains intact.
   Final framing is persisted in user_profiles.profile_json by the existing D1 API. */
(function(global){
 'use strict';
 var frame=document.querySelector('[data-cover-crop]');
 var image=document.querySelector('[data-cover-preview]');
 var placeholder=document.querySelector('[data-cover-placeholder]');
 var slider=document.querySelector('[data-cover-zoom]');
 var label=document.querySelector('[data-cover-zoom-label]');
 if(!frame||!image||!slider)return;
 var state={x:50,y:50,zoom:100};
 var active=null,objectUrl='';
 function clamp(value,min,max){return Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):min));}
 function draw(){
  image.style.objectPosition=state.x+'% '+state.y+'%';
  image.style.transformOrigin=state.x+'% '+state.y+'%';
  image.style.transform='scale('+(state.zoom/100)+')';
  slider.value=String(state.zoom);
  label.textContent=state.zoom+'%';
 }
 function source(url){
  image.src=url||'';
  image.hidden=!url;
  placeholder.hidden=!!url;
  frame.classList.toggle('has-image',!!url);
  draw();
 }
 function reset(){
  state.x=50;state.y=50;state.zoom=100;draw();
 }
 function open(profile){
  active=null;
  if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
  state.x=clamp(profile?.coverPositionX??50,0,100);
  state.y=clamp(profile?.coverPositionY??50,0,100);
  state.zoom=clamp(profile?.coverZoom??100,100,250);
  source(profile?.coverUrl||'');
 }
 function setFile(file){
  if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
  if(file&&file.size&&file.type.startsWith('image/')){
   objectUrl=URL.createObjectURL(file);
   source(objectUrl);
  }else{
   source('');
  }
 }
 slider.addEventListener('input',function(){
  state.zoom=clamp(slider.value,100,250);draw();
 });
 document.querySelector('[data-cover-zoom-in]')?.addEventListener('click',function(){
  state.zoom=clamp(state.zoom+5,100,250);draw();
 });
 document.querySelector('[data-cover-zoom-out]')?.addEventListener('click',function(){
  state.zoom=clamp(state.zoom-5,100,250);draw();
 });
 document.querySelector('[data-cover-reset]')?.addEventListener('click',reset);
 frame.addEventListener('pointerdown',function(e){
  if(image.hidden||e.button!==0)return;
  active={id:e.pointerId,x:e.clientX,y:e.clientY,px:state.x,py:state.y};
  frame.setPointerCapture(e.pointerId);
  frame.classList.add('is-dragging');
  e.preventDefault();
 });
 frame.addEventListener('pointermove',function(e){
  if(!active||e.pointerId!==active.id)return;
  var box=frame.getBoundingClientRect();
  if(box.width<1||box.height<1)return;
  state.x=clamp(Math.round(active.px-((e.clientX-active.x)/box.width)*100),0,100);
  state.y=clamp(Math.round(active.py-((e.clientY-active.y)/box.height)*100),0,100);
  draw();
 });
 function stop(e){
  if(!active||e.pointerId!==active.id)return;
  active=null;frame.classList.remove('is-dragging');
  if(frame.hasPointerCapture(e.pointerId))frame.releasePointerCapture(e.pointerId);
 }
 frame.addEventListener('pointerup',stop);
 frame.addEventListener('pointercancel',stop);
 frame.addEventListener('lostpointercapture',function(){active=null;frame.classList.remove('is-dragging')});
 frame.addEventListener('keydown',function(e){
  if(image.hidden)return;
  var step=e.shiftKey?10:2;
  if(e.key==='ArrowRight')state.x=clamp(state.x-step,0,100);
  else if(e.key==='ArrowLeft')state.x=clamp(state.x+step,0,100);
  else if(e.key==='ArrowUp')state.y=clamp(state.y+step,0,100);
  else if(e.key==='ArrowDown')state.y=clamp(state.y-step,0,100);
  else return;
  e.preventDefault();draw();
 });
 global.ProfileCoverEditor={open:open,setFile:setFile,getState:function(){
  return {coverPositionX:state.x,coverPositionY:state.y,coverZoom:state.zoom};
 }};
})(window);
