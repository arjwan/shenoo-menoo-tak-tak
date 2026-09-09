(function(){'use strict';
const API='https://shino-mino-tak-tak.duckdns.org';
const token=localStorage.getItem('token')||sessionStorage.getItem('token')||'';
const kind=document.body.dataset.kind||'profession';
const list=document.querySelector('[data-provider-list]');
const form=document.querySelector('[data-provider-form]');
const q=document.querySelector('[data-filter-q]');
const category=document.querySelector('[data-filter-category]');
const governorate=document.querySelector('[data-filter-governorate]');
const available=document.querySelector('[data-filter-available]');
const status=document.querySelector('[data-form-status]');
const coords=document.querySelector('[data-coords]');
const esc=v=>String(v||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const absolute=u=>!u?'':/^https?:\/\//i.test(u)?u:API+u;
function theme(){const saved=localStorage.getItem('taktak-theme')||'dark';document.documentElement.dataset.theme=saved;}
theme();
function phoneHref(v){return 'tel:'+encodeURIComponent(String(v||'').replace(/\s+/g,''));}
function waHref(v){const digits=String(v||'').replace(/\D/g,'');if(!digits)return '#';let n=digits;if(n.startsWith('0'))n='964'+n.slice(1);if(!n.startsWith('964'))n='964'+n;return 'https://wa.me/'+n;}
function mapHref(p){return p.latitude!=null&&p.longitude!=null?'https://www.google.com/maps?q='+encodeURIComponent(p.latitude+','+p.longitude):'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([p.address,p.area,p.governorate].filter(Boolean).join(' '));}
function avatar(p){return p.imageUrl?'<span class="provider-avatar"><img src="'+esc(absolute(p.imageUrl))+'" alt=""></span>':'<span class="provider-avatar">'+esc((p.name||'?').slice(0,1))+'</span>';}
function card(p){const vehicle=kind==='transport'?[p.vehicleType,p.vehicleModel].filter(Boolean).join(' · '):'';return '<article class="card">'+
'<div class="card-head">'+avatar(p)+'<div><h3>'+esc(p.name)+'</h3><div class="meta">'+esc(p.category)+' · '+esc(p.area)+' / '+esc(p.governorate)+'</div>'+(vehicle?'<div class="meta">🚘 '+esc(vehicle)+'</div>':'')+'</div></div>'+
'<div class="statuses"><span class="status '+(p.online?'online':'offline')+'">'+(p.online?'● متصل الآن':'● غير متصل')+'</span><span class="status '+(p.availableForWork?'available':'busy')+'">'+(p.availableForWork?'✓ متاح للعمل':'⏸ غير متاح حاليًا')+'</span></div>'+
'<div class="desc">'+esc(p.description||'لا يوجد وصف إضافي.')+'</div><div class="meta">📍 '+esc(p.address)+'</div>'+
'<div class="actions"><a class="call" href="'+phoneHref(p.phone)+'">☎ اتصال</a><a class="whatsapp" target="_blank" rel="noopener" href="'+waHref(p.whatsapp||p.phone)+'">واتساب</a><a class="map" target="_blank" rel="noopener" href="'+mapHref(p)+'">📍 الموقع</a></div></article>';}
async function load(){if(!list)return;list.innerHTML='<div class="empty">جارٍ تحميل النتائج…</div>';const params=new URLSearchParams({kind});if(q?.value.trim())params.set('q',q.value.trim());if(category?.value)params.set('category',category.value);if(governorate?.value.trim())params.set('governorate',governorate.value.trim());if(available?.checked)params.set('available','1');try{const r=await fetch(API+'/api/service-providers?'+params);const d=await r.json();if(!r.ok)throw new Error(d.message||'تعذر التحميل');list.innerHTML=(d.providers||[]).length?d.providers.map(card).join(''):'<div class="empty">لا توجد نتائج مطابقة الآن.</div>';}catch(e){list.innerHTML='<div class="empty">'+esc(e.message)+'</div>';}}
let timer;q?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,300)});category?.addEventListener('change',load);governorate?.addEventListener('change',load);available?.addEventListener('change',load);
document.querySelector('[data-locate]')?.addEventListener('click',()=>{if(!navigator.geolocation)return alert('تحديد الموقع غير مدعوم على هذا الجهاز');navigator.geolocation.getCurrentPosition(pos=>{form.elements.latitude.value=pos.coords.latitude.toFixed(6);form.elements.longitude.value=pos.coords.longitude.toFixed(6);if(coords)coords.textContent='تم تحديد الموقع ✓';},()=>alert('تعذر الحصول على الموقع. تأكد من منح الإذن.'),{enableHighAccuracy:true,timeout:10000});});
form?.addEventListener('submit',async e=>{e.preventDefault();if(!token)return location.href='signin.html';const btn=form.querySelector('[type=submit]');btn.disabled=true;if(status)status.textContent='جارٍ إرسال الطلب…';try{const fd=new FormData(form);fd.set('kind',kind);const r=await fetch(API+'/api/service-providers',{method:'POST',headers:{Authorization:'Bearer '+token},body:fd});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'تعذر إرسال الطلب');if(status)status.textContent=d.message||'تم إرسال الطلب';form.reset();if(coords)coords.textContent='لم يتم تحديد الموقع';}catch(err){if(status)status.textContent=err.message;}finally{btn.disabled=false;}});
load();
})();