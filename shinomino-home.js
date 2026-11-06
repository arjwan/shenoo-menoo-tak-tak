(function(){
  'use strict';
  const year=document.getElementById('year');
  if(year)year.textContent=String(new Date().getFullYear());
  const form=document.getElementById('homeSearch');
  const input=document.getElementById('serviceSearch');
  const feedback=document.getElementById('searchFeedback');
  const cards=Array.from(document.querySelectorAll('[data-search]'));
  if(!form||!input||!feedback)return;
  function normalize(value){
    return String(value||'').trim().toLocaleLowerCase('ar')
      .replace(/[\u064B-\u065F\u0670]/g,'')
      .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
  }
  function search(){
    const term=normalize(input.value);
    let matches=0;
    for(const card of cards){
      const haystack=normalize((card.getAttribute('data-search')||'')+' '+card.textContent);
      const visible=!term||haystack.includes(term);
      card.hidden=!visible;
      if(visible)matches++;
    }
    feedback.hidden=!term;
    feedback.textContent=term?(matches?'نتائج مطابقة: '+matches+' — اختر القسم المناسب':'ما لقينا نتيجة. جرّب كلمة ثانية.'):'';
    return matches;
  }
  form.addEventListener('submit',function(event){
    event.preventDefault();
    const matches=search();
    if(matches){
      const first=cards.find(card=>!card.hidden);
      if(first)first.scrollIntoView({behavior:'smooth',block:'center'});
    }
  });
  input.addEventListener('input',search);
})();
