(function(){
  'use strict';
  window.kahwaTawlaUI = {
    mount: function(c,ctx){
      c.innerHTML='<div class="kahwa-board" style="background:linear-gradient(135deg,#061514,#0b1a15);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:16px;color:#fff;text-align:center;"><h3>🎲 طاولي <span style="color:#E0A83F">(طاولة حقيقية)</span></h3><p style="color:#91A39D;font-size:13px;">العب عبر السيرفر — لا تحديث بعد الحركة</p><div id="tawla-board" style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px;margin:12px 0;">جارٍ تحميل اللوحة…</div><div style="margin:10px 0;"><button id="btn-roll" class="kahwa-btn primary">🎲 رمي الزهر</button></div><div id="tawla-status" style="color:#91A39D;font-size:13px;"></div></div>';
    },
    render: function(c,state) {
      document.getElementById('tawla-status').textContent = (state.public && state.public.status) ? 'الحالة: ' + state.public.status : 'جارٍ التحميل';
      document.getElementById('tawla-board').innerHTML = '<div style="padding:10px;color:#91A39D">لوحة 24 نقطة — 15 قطعة لكل لاعب. الزهر من السيرفر فقط.</div>';
    },
    setLegalActions: function(a){ var btn=document.getElementById('btn-roll'); if(btn) btn.style.display = a && a.some(function(x){return x.type==='roll'}) ? 'inline-block':'none'; },
    setLoading: function(v){ var b=document.getElementById('btn-roll'); if(b) b.disabled=!!v; b.classList.toggle('loading',!!v); },
    showSuccess: function(m){ var s=document.getElementById('tawla-status'); if(s){s.textContent='✓ '+m;s.style.color='#19D9A0';setTimeout(function(){s.textContent='';},1800);} },
    showError: function(m){ var s=document.getElementById('tawla-status'); if(s){s.textContent='✗ '+m;s.style.color='#FF4D4F';setTimeout(function(){s.textContent='';},2500);} },
    destroy: function(){}
  };
})();
