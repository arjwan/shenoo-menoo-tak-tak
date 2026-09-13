(function(){
'use strict';
var root=document.querySelector('[data-device-permissions]');
if(!root)return;
var status=root.querySelector('[data-device-permission-status]');
var backgroundSwitch=root.querySelector('[data-background-realtime]');
var BG_KEY='shnoBackgroundRealtimeEnabled';
function say(t){if(status)status.textContent=t||'';}
function nativeCall(name,arg){try{var n=window.ShnoManoNative;if(n&&typeof n[name]==='function'){if(arguments.length>1)n[name](arg);else n[name]();return true;}}catch(_){}return false;}
function readBackground(){var enabled=localStorage.getItem(BG_KEY)==='1';try{if(window.ShnoManoNative&&typeof window.ShnoManoNative.isBackgroundRealtimeEnabled==='function')enabled=!!window.ShnoManoNative.isBackgroundRealtimeEnabled();}catch(_){}return enabled;}
function setBackground(enabled){localStorage.setItem(BG_KEY,enabled?'1':'0');nativeCall('setBackgroundRealtimeEnabled',!!enabled);say(enabled?'تم تفعيل استقبال الرسائل والمكالمات في الخلفية على هذا الجهاز.':'تم إيقاف عمل شنو منو في الخلفية على هذا الجهاز.');}
if(backgroundSwitch){backgroundSwitch.checked=readBackground();backgroundSwitch.addEventListener('change',function(){setBackground(backgroundSwitch.checked);});}
async function browserLocation(){if(!navigator.geolocation){say('الموقع غير مدعوم في هذا المتصفح.');return;}say('سيطلب الجهاز إذن الموقع. التفعيل اختياري ويمكنك الرفض.');navigator.geolocation.getCurrentPosition(function(){say('تم السماح بالموقع على هذا الجهاز.');},function(e){say(e&&e.code===1?'لم يتم تفعيل الموقع — يمكنك استخدام شنو منو بدونه.':'تعذر الحصول على الموقع حالياً.');},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});}
async function browserMedia(){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){say('الكاميرا والمايك غير مدعومين هنا.');return;}try{var s=await navigator.mediaDevices.getUserMedia({audio:true,video:true});s.getTracks().forEach(function(t){t.stop();});say('تم السماح للكاميرا والمايك.');}catch(_){say('لم يتم السماح للكاميرا/المايك. يمكنك تفعيلهما لاحقاً من إعدادات الجهاز.');}}
async function browserNotifications(){if(!('Notification'in window)){say('إشعارات المتصفح غير مدعومة هنا.');return;}try{var r=await Notification.requestPermission();say(r==='granted'?'تم السماح بالإشعارات.':'لم يتم تفعيل الإشعارات — يمكنك تفعيلها لاحقاً.');}catch(_){say('تعذر طلب إذن الإشعارات.');}}
root.addEventListener('click',function(e){var b=e.target.closest('[data-device-action]');if(!b)return;var a=b.dataset.deviceAction;if(a==='background'){if(backgroundSwitch&&!backgroundSwitch.checked){backgroundSwitch.checked=true;setBackground(true);}if(!nativeCall('openBackgroundSettings'))say('افتح إعدادات التطبيق في جهازك واختر البطارية/العمل في الخلفية ثم اسمح به إذا رغبت.');return;}if(a==='location'){if(!nativeCall('requestLocationPermission'))browserLocation();return;}if(a==='media'){if(!nativeCall('requestMediaPermission'))browserMedia();return;}if(a==='notifications'){if(!nativeCall('requestNotificationPermission'))browserNotifications();return;}if(a==='app-settings'){if(!nativeCall('openAppSettings'))say('افتح إعدادات التطبيق من إعدادات جهازك لتعديل الأذونات.');}});
})();
