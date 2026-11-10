/* One consent-driven screen source for the browser and Android MediaProjection. */
(function(global){
 'use strict';
 let stream=null,canvas=null,pending=null,decoding=false;
 function changed(){global.dispatchEvent(new Event('shno:screen-share-stopped'));}
 function release(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(canvas)canvas.remove();canvas=null;decoding=false;}
 function failed(message){const start=pending;pending=null;release();if(start)start.reject(new Error(message||'تعذر بدء مشاركة الشاشة'));else changed();}
 global.ShnoScreenShare={
  async start(){
   if(stream)return stream;
   if(global.ShnoAndroidCall && typeof global.ShnoAndroidCall.startScreenShare==='function'){
    if(pending)throw new Error('انتظر موافقة مشاركة الشاشة');
    return new Promise((resolve,reject)=>{pending={resolve,reject};global.ShnoAndroidCall.startScreenShare();});
   }
   if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('مشاركة الشاشة تحتاج متصفحاً يدعم التقاط الشاشة أو تطبيق اتصال المحدّث');
   stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:15,max:20}},audio:false});
   stream.getVideoTracks()[0].addEventListener('ended',()=>{release();changed();},{once:true});
   return stream;
  },
  stop(){
   const start=pending;pending=null;
   release();
   if(start)start.reject(new Error('تم إلغاء مشاركة الشاشة'));
   if(global.ShnoAndroidCall?.stopScreenShare)global.ShnoAndroidCall.stopScreenShare();
  },
  onNativeFrame(base64,width,height){
   if(decoding || (!pending && !stream))return;
   decoding=true;
   const frame=new Image();
   frame.onload=()=>{
    if(!pending && !stream){decoding=false;return;}
    if(!canvas){canvas=document.createElement('canvas');canvas.hidden=true;}
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    canvas.getContext('2d',{alpha:false}).drawImage(frame,0,0,width,height);
    if(!stream){
     if(!canvas.captureStream){decoding=false;failed('إصدار WebView لا يدعم بث الشاشة؛ حدّث Android System WebView');global.ShnoAndroidCall.stopScreenShare();return;}
     stream=canvas.captureStream(8);
     const start=pending;pending=null;if(start)start.resolve(stream);
    }
    decoding=false;
   };
   frame.onerror=()=>{decoding=false;};frame.src='data:image/jpeg;base64,'+base64;
  },
  onNativeStopped(message){failed(message);}
 };
 global.addEventListener('pagehide',()=>global.ShnoScreenShare.stop());
})(window);
