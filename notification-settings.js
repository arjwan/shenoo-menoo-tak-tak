(function(){
'use strict';
if(!/settings\.html$/i.test(location.pathname))return;
var KEY='shnoNotificationPreferences';
var defaults={messages:true,calls:true,missedCalls:true,sound:true,vibration:true,lockScreenPreview:false};
function load(){try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){return Object.assign({},defaults);}}
function save(p){var json=JSON.stringify(p);localStorage.setItem(KEY,json);try{if(window.ShnoManoNative&&typeof window.ShnoManoNative.saveNotificationPreferences==='function')window.ShnoManoNative.saveNotificationPreferences(json);}catch(_){}window.dispatchEvent(new CustomEvent('shno:notification-settings',{detail:p}));}
function row(key,title,desc){return '<label class="notification-setting-row"><span><strong>'+title+'</strong><small>'+desc+'</small></span><input type="checkbox" data-notification-pref="'+key+'"></label>';}
function install(){
 var host=document.querySelector('.settings-layout > section');if(!host||document.querySelector('[data-notification-settings]'))return;
 var section=document.createElement('section');section.className='settings-section';section.id='notifications';section.setAttribute('data-notification-settings','1');
 section.innerHTML='<h2>الإشعارات والمكالمات</h2><p>تحكم بتنبيهات الرسائل والمكالمات على هذا الجهاز. إشعارات شاشة القفل تحتاج تفعيل إذن الإشعارات في تطبيق أندرويد.</p><div class="notification-settings-grid">'+
 row('messages','إشعارات الرسائل','تنبيه عند وصول رسالة جديدة.')+
 row('calls','إشعارات المكالمات الواردة','رنين وتنبيه عند ورود مكالمة صوتية أو فيديو.')+
 row('missedCalls','المكالمات الفائتة','إظهار تنبيه مستقل عند انتهاء مكالمة دون رد.')+
 row('sound','الصوت','تشغيل صوت التنبيه والرنين.')+
 row('vibration','الاهتزاز','استخدام اهتزاز الجهاز عندما يكون مدعوماً.')+
 row('lockScreenPreview','إظهار محتوى الرسالة على شاشة القفل','عند إيقافه يظهر تنبيه عام حفاظاً على الخصوصية.')+
 '</div><div class="settings-actions"><button class="button button-primary" type="button" data-save-notifications>حفظ إعدادات الإشعارات</button><button class="icon-button" type="button" data-request-notification-permission>تفعيل إذن إشعارات الجهاز</button><span class="settings-message" data-notification-message></span></div>';
 host.insertBefore(section,host.firstChild);
 var nav=document.querySelector('.settings-nav');if(nav){var a=document.createElement('a');a.href='#notifications';a.textContent='الإشعارات والمكالمات';nav.appendChild(a);}
 var p=load();section.querySelectorAll('[data-notification-pref]').forEach(function(input){input.checked=!!p[input.dataset.notificationPref];});save(p);
 section.querySelector('[data-save-notifications]').onclick=function(){var next={};section.querySelectorAll('[data-notification-pref]').forEach(function(input){next[input.dataset.notificationPref]=input.checked;});save(next);var m=section.querySelector('[data-notification-message]');m.textContent='تم حفظ إعدادات الإشعارات على هذا الجهاز.';setTimeout(function(){m.textContent='';},2500);};
 section.querySelector('[data-request-notification-permission]').onclick=async function(){var m=section.querySelector('[data-notification-message]');try{if(window.ShnoManoNative&&typeof window.ShnoManoNative.requestNotificationPermission==='function'){window.ShnoManoNative.requestNotificationPermission();m.textContent='تم إرسال طلب إذن الإشعارات إلى أندرويد.';return;}if('Notification'in window){var r=await Notification.requestPermission();m.textContent=r==='granted'?'تم تفعيل إشعارات المتصفح.':'لم يتم منح إذن الإشعارات.';return;}m.textContent='هذا الجهاز لا يدعم طلب الإشعارات من المتصفح.';}catch(e){m.textContent='تعذر طلب إذن الإشعارات.';}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
