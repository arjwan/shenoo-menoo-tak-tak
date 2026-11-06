const status=document.getElementById('status'),button=document.getElementById('approve');
const params=new URLSearchParams(location.hash.slice(1));
const user=params.get('user'),pair=params.get('pair'),challenge=params.get('approve');
const key='shnoDeveloperPhone:'+user;
// Preserve the existing device pairing; no credentials are copied into the DOM.
if(pair&&user){localStorage.setItem(key,pair);history.replaceState(null,'',location.pathname);status.textContent='تم حفظ اقتران الهاتف. استخدم هذا المتصفح للموافقة على طلبات دخولك.';}
else if(challenge&&user){history.replaceState(null,'',location.pathname);const secret=localStorage.getItem(key);if(!secret)status.textContent='هذا المتصفح غير مقترن. افتح الطلب بالمتصفح المقترن سابقاً.';else{status.textContent='وافق فقط إذا كنت أنت من بدأ تسجيل الدخول إلى لوحة المطوّر.';button.hidden=false;button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/api/developer-mfa/phone/approve',{method:'POST',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,challengeId:challenge,secret})});const d=await r.json();if(!r.ok)throw Error(d.message||'تعذر تأكيد الدخول');status.textContent='تمت الموافقة. يمكنك العودة إلى لوحة المطوّر.';button.hidden=true;}catch(e){status.textContent=e.message;button.disabled=false;}};}}
else status.textContent='لا يوجد طلب موافقة صالح في هذا الرابط.';
