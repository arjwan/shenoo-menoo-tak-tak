(function(){
'use strict';
var params=new URLSearchParams(location.search);
var requested=params.get('prepare');
if(params.get('native')==='1')return;
var running=false;
function status(text,isError){
  var feedback=document.querySelector('[data-message-feedback]');
  if(feedback){feedback.textContent=text||'';feedback.className='form-message'+(isError?' is-error':'');}
  var callStatus=document.querySelector('[data-call-status]');
  if(callStatus&&text)callStatus.textContent=text;
}
function mediaErrorMessage(type,error){
  var name=error&&error.name||'';
  if(name==='NotAllowedError'||name==='SecurityError')return type==='video'?'السماح بالكاميرا والميكروفون مرفوض. افتح صلاحيات الموقع واسمح بالكاميرا والميكروفون ثم حاول مجدداً.':'السماح بالميكروفون مرفوض. افتح صلاحيات الموقع واسمح بالميكروفون ثم حاول مجدداً.';
  if(name==='NotFoundError'||name==='DevicesNotFoundError')return type==='video'?'لم يتم العثور على كاميرا أو ميكروفون متاح على هذا الجهاز.':'لم يتم العثور على ميكروفون متاح على هذا الجهاز.';
  if(name==='NotReadableError'||name==='TrackStartError')return 'الكاميرا أو الميكروفون مستخدم من برنامج آخر أو تعذر تشغيله. أغلق البرنامج الآخر ثم حاول مجدداً.';
  if(!window.isSecureContext)return 'المكالمات تحتاج اتصال HTTPS آمن.';
  return type==='video'?'تعذر تشغيل الكاميرا أو الميكروفون. تحقق من صلاحيات المتصفح والجهاز.':'تعذر تشغيل الميكروفون. تحقق من صلاحيات المتصفح والجهاز.';
}
async function preflight(type){
  if(!navigator.mediaDevices||typeof navigator.mediaDevices.getUserMedia!=='function')throw new Error('UNSUPPORTED_MEDIA');
  var stream=await navigator.mediaDevices.getUserMedia({audio:true,video:type==='video'});
  stream.getTracks().forEach(function(track){track.stop();});
}
async function approveAndClick(button,type){
  if(running)return;
  running=true;
  button.disabled=true;
  status(type==='video'?'جارٍ التحقق من الكاميرا والميكروفون…':'جارٍ التحقق من الميكروفون…',false);
  try{
    await preflight(type);
    status('',false);
    button.dataset.mediaApproved='1';
    button.disabled=false;
    button.click();
  }catch(error){
    var message=(error&&error.message==='UNSUPPORTED_MEDIA')?'هذا المتصفح لا يدعم الوصول إلى الكاميرا أو الميكروفون للمكالمات.':mediaErrorMessage(type,error);
    status(message,true);
    button.disabled=false;
  }finally{running=false;}
}
document.addEventListener('click',function(event){
  var button=event.target.closest('[data-start-call]');
  if(!button)return;
  if(button.dataset.mediaApproved==='1'){delete button.dataset.mediaApproved;return;}
  event.preventDefault();
  event.stopImmediatePropagation();
  approveAndClick(button,button.dataset.startCall==='video'?'video':'audio');
},true);
function launchPrepared(){
  if(!['audio','video'].includes(requested))return;
  var tries=0;
  var timer=setInterval(function(){
    tries++;
    var button=document.querySelector('[data-start-call="'+requested+'"]');
    if(button){clearInterval(timer);approveAndClick(button,requested);}
    else if(tries>60){clearInterval(timer);status('تعذر تجهيز أزرار المكالمة. أعد فتح المحادثة وحاول مجدداً.',true);}
  },200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',launchPrepared);else launchPrepared();
}());
