/* Explicit per-call location consent. No background GPS, no persistent coordinates. */
(function(global){
'use strict';
var callbackSeq=0,waiting=new Map(),currentCallId='';
function validCoord(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;}
function geolocate(precise){
 return new Promise(function(resolve,reject){
  if(!navigator.geolocation){reject(Error('خدمة الموقع غير متاحة'));return;}
  navigator.geolocation.getCurrentPosition(resolve,function(e){reject(Error(e.code===1?'تم رفض إذن الموقع':'تعذر تحديد الموقع'));},
    {enableHighAccuracy:!!precise,timeout:13000,maximumAge:precise?0:120000});
 });
}
function reverse(lat,lon){
 return new Promise(function(resolve,reject){
  if(!global.ShnoAndroidCall || typeof global.ShnoAndroidCall.reverseLocation!=='function'){
   reject(Error('تسمية المدينة والمحافظة تلقائياً متاحة حالياً في تطبيق أندرويد فقط'));return;
  }
  var id='gps'+(++callbackSeq);
  var timeout=setTimeout(function(){waiting.delete(id);reject(Error('تعذر معرفة المدينة والمحافظة'));},11000);
  waiting.set(id,{resolve:resolve,reject:reject,timeout:timeout});
  global.ShnoAndroidCall.reverseLocation(lat,lon,id);
 });
}
function onReverseLocation(id,city,province){
 var pending=waiting.get(id);if(!pending)return;
 waiting.delete(id);clearTimeout(pending.timeout);
 city=String(city||'').trim().slice(0,80);province=String(province||'').trim().slice(0,80);
 if(!city||!province){pending.reject(Error('تعذر معرفة المدينة والمحافظة'));return;}
 pending.resolve({city:city,province:province});
}
function reset(callId){currentCallId=callId||'';waiting.forEach(function(p){clearTimeout(p.timeout);p.reject(Error('انتهت المكالمة'));});waiting.clear();}
async function city(callId){
 if(!callId||callId!==currentCallId)throw Error('المكالمة غير نشطة');
 var pos=await geolocate(false);
 if(callId!==currentCallId)throw Error('انتهت المكالمة');
 var latitude=pos.coords.latitude,longitude=pos.coords.longitude;
 if(!validCoord(latitude,longitude))throw Error('بيانات الموقع غير صالحة');
 var name=await reverse(latitude,longitude);
 if(callId!==currentCallId)throw Error('انتهت المكالمة');
 return {kind:'city',city:name.city,province:name.province};
}
async function precise(callId){
 if(!callId||callId!==currentCallId)throw Error('المكالمة غير نشطة');
 var pos=await geolocate(true);
 if(callId!==currentCallId)throw Error('انتهت المكالمة');
 var latitude=pos.coords.latitude,longitude=pos.coords.longitude;
 if(!validCoord(latitude,longitude)||pos.coords.accuracy>300)throw Error('الدقة غير كافية؛ حاول مجدداً');
 return {kind:'precise',latitude:latitude,longitude:longitude,accuracy:Math.ceil(pos.coords.accuracy)};
}
global.ShnoCallLocation={reset:reset,city:city,precise:precise,onReverseLocation:onReverseLocation};
})(window);
