(()=>{'use strict';
const form=document.querySelector('#school-signin-form');
const message=document.querySelector('#school-signin-message');
const session=document.querySelector('#school-session');
const themeButton=document.querySelector('#school-theme-toggle');
function refreshTheme(){const dark=document.documentElement.dataset.theme==='dark';themeButton.textContent=dark?'☀':'☾';themeButton.setAttribute('aria-label',dark?'تفعيل الوضع النهاري':'تفعيل الوضع الليلي');themeButton.title=themeButton.getAttribute('aria-label')}
refreshTheme();themeButton.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('shno-theme',next);localStorage.setItem('taktak-theme',next);refreshTheme()});
const existing=localStorage.getItem('token')||sessionStorage.getItem('token');
if(existing)session.hidden=false;
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=form.querySelector('button');
  const data=new FormData(form);
  message.textContent='';button.disabled=true;button.textContent='جارٍ التحقق…';
  try{
    const response=await fetch('/api/auth/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:data.get('identifier'),password:data.get('password')})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.token)throw new Error(result.message||'تعذر تسجيل الدخول');
    const target=data.get('remember')?localStorage:sessionStorage;
    const other=target===localStorage?sessionStorage:localStorage;
    other.removeItem('token');target.setItem('token',result.token);
    if(result.user)target.setItem('user',JSON.stringify(result.user));
    location.replace('school-index.html');
  }catch(error){message.textContent=error.message||'تعذر تسجيل الدخول';button.disabled=false;button.textContent='الدخول إلى مدرسة سومر';}
});
})();
