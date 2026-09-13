(function(){'use strict';
const packs={
 ar:{brand:'شنو منو تك تك',brandTag:'شنو منو تك تك — بنكهة عراقية',brandLine:'لنا وللعرب ولكل العالم — ساهم، انشر، أضف أصدقاء، واستكشف عالمًا جديدًا من التواصل.',messages:'شنو منو مراسلات',notifications:'الإشعارات',markAll:'قراءة الكل',share:'مشاركة',shareMessages:'مشاركة عبر شنو منو مراسلات'},
 en:{brand:'Shno Meno Tak Tak',brandTag:'Shno Meno Tak Tak — Iraqi flavor',brandLine:'For us, for Arabs, and for everyone — contribute, share, add friends, and discover a new world of communication.',messages:'Shno Meno Messages',notifications:'Notifications',markAll:'Mark all read',share:'Share',shareMessages:'Share in Shno Meno Messages'}
};
const saved=localStorage.getItem('shno-language')||'ar';
function apply(lang){lang=packs[lang]?lang:'ar';localStorage.setItem('shno-language',lang);document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(packs[lang][key])el.textContent=packs[lang][key]});window.dispatchEvent(new CustomEvent('shno:language',{detail:{lang,pack:packs[lang]}}));}
window.ShnoI18n={packs,get language(){return localStorage.getItem('shno-language')||saved;},t:key=>(packs[localStorage.getItem('shno-language')||saved]||packs.ar)[key]||key,setLanguage:apply};
document.addEventListener('DOMContentLoaded',()=>apply(saved));
})();
