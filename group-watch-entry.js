(function(){'use strict';
const button=document.querySelector('[data-group-watch]');
if(!button)return;
const roomId=new URLSearchParams(location.search).get('id')||'';
button.addEventListener('click',()=>{
  if(!roomId){alert('رابط الغرفة غير صالح');return;}
  localStorage.setItem('taktak_tv_room_id',roomId);
  localStorage.setItem('taktak_tv_mode','collective');
  location.href='tv.html?room='+encodeURIComponent(roomId)+'&mode=collective';
});
})();
