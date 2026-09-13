(function(){'use strict';
function apply(){
  document.querySelectorAll('a[href="messages.html"]').forEach(a=>{
    const text=(a.textContent||'').trim();
    if(text.includes('المحادثات الخاصة')){
      a.href='groups.html';
      a.textContent='🏠 الغرف العامة والخاصة';
    }
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
