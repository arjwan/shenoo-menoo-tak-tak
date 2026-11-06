/* Presentation enhancements only. The existing reels-v2.js remains the source
   of truth for uploading, comments, reactions, sharing, and deletion. */
(()=>{'use strict';
const feed=document.getElementById('feed'),previous=document.getElementById('previousReel'),
 next=document.getElementById('nextReel'),position=document.getElementById('reelsPosition');
if(!feed||!previous||!next||!position)return;
let current=null,observer=null,mediaObserver=null;
const cards=()=>[...feed.querySelectorAll('.reel-card')];
const videos=()=>[...feed.querySelectorAll('.reel-card>video')];
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function setCurrent(card){
 if(!card||card===current)return;
 current?.classList.remove('is-current');current=card;card.classList.add('is-current');
 const list=cards(),i=list.indexOf(card);
 position.textContent=(i+1)+' / '+list.length;
 previous.disabled=i<=0;next.disabled=i>=list.length-1;
 for(const video of videos()){
  if(!card.contains(video))video.pause();
 }
}
function jump(delta){
 const list=cards();if(!list.length)return;
 const at=Math.max(0,list.indexOf(current));const target=list[Math.min(list.length-1,Math.max(0,at+delta))];
 if(!target)return;
 setCurrent(target);
 target.scrollIntoView({block:'center',behavior:reducedMotion()?'auto':'smooth'});
}
previous.addEventListener('click',()=>jump(-1));next.addEventListener('click',()=>jump(1));
function enhance(card){
 if(card.dataset.cinemaReady)return;
 card.dataset.cinemaReady='1';
 const video=card.querySelector(':scope > video');
 if(!video)return;
 video.muted=true;
 video.setAttribute('aria-label','مشاهدة مقطع الريلز');
 const toolbar=document.createElement('div');toolbar.className='reel-video-tools';
 const play=document.createElement('button');play.type='button';play.className='cinema-play';play.setAttribute('aria-label','تشغيل الفيديو');play.textContent='▶';
 const sound=document.createElement('button');sound.type='button';sound.className='cinema-sound';sound.setAttribute('aria-label','تشغيل الصوت');sound.textContent='🔇';
 toolbar.append(play,sound);
 const track=document.createElement('div');track.className='reel-progress';track.setAttribute('aria-hidden','true');
 const fill=document.createElement('span');track.append(fill);card.append(toolbar,track);
 const update=()=>{play.textContent=video.paused?'▶':'Ⅱ';play.setAttribute('aria-label',video.paused?'تشغيل الفيديو':'إيقاف الفيديو');sound.textContent=video.muted?'🔇':'🔊';sound.setAttribute('aria-label',video.muted?'تشغيل الصوت':'كتم الصوت');if(Number.isFinite(video.duration)&&video.duration>0)fill.style.width=(video.currentTime/video.duration*100)+'%'};
 play.addEventListener('click',()=>{if(video.paused)video.play().catch(()=>{});else video.pause()});
 sound.addEventListener('click',()=>{video.muted=!video.muted;update()});
 video.addEventListener('play',()=>{setCurrent(card);for(const other of videos())if(other!==video)other.pause();update()});
 for(const event of ['pause','timeupdate','loadedmetadata','volumechange','ended'])video.addEventListener(event,update);
 update();
}
function refresh(){
 const list=cards();list.forEach(enhance);
 if(!list.length){position.textContent='—';previous.disabled=true;next.disabled=true;current=null;return}
 if(!current||!current.isConnected)setCurrent(list[0]);
 else {const i=list.indexOf(current);position.textContent=(i+1)+' / '+list.length;previous.disabled=i<=0;next.disabled=i===list.length-1}
 if(observer)observer.disconnect();
 if('IntersectionObserver'in window){
  observer=new IntersectionObserver(entries=>{
   let winner=null;
   for(const entry of entries)if(entry.isIntersecting&&(!winner||entry.intersectionRatio>winner.intersectionRatio))winner=entry;
   if(winner)setCurrent(winner.target);
  },{threshold:[0.35,0.55,0.75]});
  list.forEach(card=>observer.observe(card));
 }
 if(mediaObserver)mediaObserver.disconnect();
 if('IntersectionObserver'in window){
  mediaObserver=new IntersectionObserver(entries=>{
   for(const entry of entries){
    const video=entry.target.querySelector(':scope > video');
    if(!video)continue;
    if(!entry.isIntersecting)video.pause();
    // No forced auto-play: respect user's bandwidth and autoplay preferences.
   }
  },{threshold:0.08});
  list.forEach(card=>mediaObserver.observe(card));
 }
}
let queued=false;
new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh()})}).observe(feed,{childList:true});
document.addEventListener('keydown',e=>{
 if(e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 if(e.key==='ArrowDown'){e.preventDefault();jump(1)}
 if(e.key==='ArrowUp'){e.preventDefault();jump(-1)}
 if((e.key===' '||e.key==='k')&&current){e.preventDefault();const video=current.querySelector(':scope > video');if(video){if(video.paused)video.play().catch(()=>{});else video.pause()}}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)videos().forEach(v=>v.pause())});
refresh();
})();