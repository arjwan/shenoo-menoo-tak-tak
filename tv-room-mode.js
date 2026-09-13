(function(){'use strict';
const params=new URLSearchParams(location.search);
const roomId=params.get('room')||params.get('groupId')||params.get('id')||'';
const mode=params.get('mode')||'';
const groupButton=document.querySelector('[data-group-mode]');
if(!groupButton)return;
if(!roomId){groupButton.hidden=true;return;}
groupButton.hidden=false;
if(mode==='collective'){
  localStorage.setItem('taktak_tv_room_id',roomId);
  localStorage.setItem('taktak_tv_mode','collective');
  setTimeout(()=>groupButton.click(),180);
}
})();
