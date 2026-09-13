(function(){
'use strict';
const DEFAULT_MESSAGE='🌟 أهلاً وسهلاً بكم في شنو منو TV — نتمنى لكم مشاهدة ممتعة وأوقاتاً طيبة مع الأهل والأصدقاء 🌟';
const API_BASE=window.SocialAPI?.baseUrl||window.location.origin;
const track=document.querySelector('[data-ticker-track]');
const label=document.querySelector('.tv-news-label');
if(!track)return;

let items=[];
let index=0;
let timer=null;

const typeLabel={notice:'تنبيه',guidance:'توجيه',ad:'إعلان'};
const typeIcon={notice:'🔔',guidance:'📌',ad:'📢'};

function setTicker(item){
  if(!item){
    track.textContent=DEFAULT_MESSAGE;
    if(label)label.textContent='شنو منو TV';
    restartAnimation(track.textContent.length);
    return;
  }
  track.textContent=`${typeIcon[item.type]||'📣'} ${item.text}`;
  if(label)label.textContent=typeLabel[item.type]||'رسمي';
  restartAnimation(track.textContent.length);
}

function restartAnimation(length){
  const seconds=Math.max(14,Math.min(38,10+length*.18));
  track.style.animation='none';
  track.offsetHeight;
  track.style.setProperty('--ticker-duration',seconds+'s');
  track.style.animation='tvTicker var(--ticker-duration) linear infinite';
}

function scheduleRotation(){
  clearTimeout(timer);
  if(items.length<=1)return;
  const current=items[index]||items[0];
  const hold=Math.max(14000,Math.min(36000,10000+String(current?.text||'').length*180));
  timer=setTimeout(()=>{
    index=(index+1)%items.length;
    setTicker(items[index]);
    scheduleRotation();
  },hold);
}

async function refresh(){
  try{
    const res=await fetch(API_BASE+'/api/ticker/active',{cache:'no-store'});
    const data=await res.json();
    if(!res.ok)throw new Error(data.message||'ticker failed');
    items=Array.isArray(data.items)?data.items:[];
    index=0;
    setTicker(items[0]||null);
    scheduleRotation();
  }catch(_){
    if(!items.length)setTicker(null);
  }
}

refresh();
setInterval(refresh,60000);

if(window.io){
  try{
    const token=window.SocialAPI?.token?.();
    const socket=window.io(API_BASE,token?{auth:{token}}:{});
    socket.on('broadcast-ticker:update',refresh);
  }catch(_){ }
}
})();
