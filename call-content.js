(() => {
 'use strict';
 const kind=document.body.dataset.contentKind,items=document.getElementById('items'),status=document.getElementById('status'),tabs=document.getElementById('categories');
 const categories=kind==='news'?[['all','الكل'],['breaking','العاجلة'],['politics','السياسة'],['sport','الرياضة'],['arts','الفنون'],['general','عامة']]:[['food','الأكلات'],['flowers','الزهور'],['photos','الصور'],['tourism','السياحة'],['knowledge','المعلومات العامة']];
 let category=categories[0][0],all=[],busy=false,generation=0;
 const cleanURL=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
 const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value||'';return e};
 for(const [id,title] of categories){const b=text('button',title);b.type='button';b.dataset.category=id;b.setAttribute('aria-pressed',String(id===category));tabs.append(b)}
 function render(){
  items.replaceChildren();const search=document.getElementById('search').value.trim().toLocaleLowerCase('ar');
  const list=all.filter(i=>(kind!=='news'||category==='all'||i.category===category)&&(!search||(i.title+' '+i.summary).toLocaleLowerCase('ar').includes(search)));
  let lastArea='';
  for(const item of list){
   const area=item.area==='iraq'||item.category==='breaking'?'العراق والعاجلة':item.area==='region'?'المحيط الإقليمي':'العالم';
   if(kind==='news'&&area!==lastArea){items.append(Object.assign(text('h2',area),{className:'section-marker'}));lastArea=area}
   const card=document.createElement('article');card.className='content-card';
   if(cleanURL(item.image)){const img=document.createElement('img');img.src=cleanURL(item.image);img.alt=item.title;img.loading='lazy';card.append(img)}
   card.append(text('small',item.source+(item.publishedAt?' · '+new Date(item.publishedAt).toLocaleString('ar-IQ'):'')),text('h2',item.title),text('p',item.summary));
   if(item.license)card.append(text('small',[item.credit,item.license].filter(Boolean).join(' — ')));
   const actions=document.createElement('div');actions.className='content-actions';const read=text('button','قراءة');read.onclick=()=>openItem(item);const share=text('button','مشاركة');share.onclick=()=>shareItem(item);actions.append(read,share);card.append(actions);items.append(card);
  }
  if(!list.length)items.append(text('p','لا توجد نتائج مطابقة.'));
 }
 function openItem(item){const dialog=document.getElementById('article');dialog.querySelector('h2').textContent=item.title;dialog.querySelector('.article-text').textContent=item.summary;dialog.querySelector('small').textContent=[item.source,item.credit,item.license].filter(Boolean).join(' — ');const source=dialog.querySelector('a');source.href=cleanURL(item.url);source.textContent='متابعة القراءة لدى المصدر';dialog.showModal()}
 async function shareItem(item){try{const url=cleanURL(item.url);if(navigator.share)await navigator.share({title:item.title,url});else if(navigator.clipboard){await navigator.clipboard.writeText(item.title+'\n'+url);status.textContent='تم نسخ رابط المحتوى للمشاركة'}else status.textContent='افتح المحتوى وانسخ رابط المصدر للمشاركة'}catch(e){if(e.name!=='AbortError')status.textContent='تعذرت المشاركة'}}
 async function load(){const token=++generation;busy=true;status.textContent='جارٍ جلب المحتوى من المصادر…';document.getElementById('refresh').disabled=true;
  try{if(window.shnoSessionReady&&!(await window.shnoSessionReady))throw Error('يرجى تسجيل الدخول');const r=await fetch('/api/call-content/'+kind+(kind==='discover'?'?topic='+encodeURIComponent(category):''),{credentials:'same-origin',cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||'تعذر جلب المحتوى');if(token!==generation)return;all=d.items||[];render();status.textContent=(d.partial?'بعض المصادر غير متاحة. ':'')+'آخر جلب: '+new Date(d.updatedAt).toLocaleString('ar-IQ');}
  catch(e){if(token===generation)status.textContent=e.message;}finally{if(token===generation){busy=false;document.getElementById('refresh').disabled=false}}
 }
 tabs.onclick=e=>{const b=e.target.closest('[data-category]');if(!b)return;category=b.dataset.category;tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(kind==='discover')load();else render()};
 document.getElementById('search').oninput=render;document.getElementById('refresh').onclick=load;document.querySelector('[data-close-article]').onclick=()=>document.getElementById('article').close();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)load()});setInterval(()=>{if(!document.hidden&&!busy)load()},120000);load();
})();
