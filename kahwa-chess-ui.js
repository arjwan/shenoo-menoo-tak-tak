(function(){
  'use strict';
  window.kahwaChessUI = {
    mount: function(c,ctx){
      c.innerHTML='<div class="kahwa-board" style="background:linear-gradient(135deg,#071111,#0d0f14);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:12px;color:#fff;text-align:center;"><h3>♟ شطرنج <span style="color:#D4A0E8">(رقعة حقيقية)</span></h3><p style="color:#91A39D;font-size:12px;">القفاز من السيرفر. لا صوت.</p><div id="chess-board" style="display:grid;grid-template-columns:repeat(8,1fr);gap:2px;max-width:90vh;margin:10px auto;"></div><div style="margin-top:8px"><button id="btn-chess-resign" class="kahwa-btn error">استسلام</button></div><div id="chess-status" style="color:#91A39D;font-size:13px;margin-top:8px;"></div></div>';
    },
    render: function(c,state){
      var b=state.public && state.public.board ? state.public.board : [];
      var html='';
      for(var r=0;r<8;r++){html+='<div style="display:flex;">'; for(var f=0;f<8;f++){var idx=r*8+f; var cell=b && b[idx] ? b[idx] : null; var piece=cell?(cell.type==='k'?'♔':cell.type==='q'?'♕':cell.type==='r'?'♖':cell.type==='b'?'♗':cell.type==='n'?'♘':cell.type==='p'?'♙':'?'):'·'; html+='<div style="flex:1;aspect-ratio:1;background:#1a1a2e;border:1px solid #333;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="window.chessMoveEvent && window.chessMoveEvent('+f+','+r+')">'+(cell?'<span style="font-size:22px;color:#'+(cell.color==='white'?'fff':'333')+';">'+piece+'</span>':'<span style="font-size:22px;color:#333;">·</span>')+'</div>'; } html+='</div>';}
      document.getElementById('chess-board').innerHTML=html;
      document.getElementById('chess-status').textContent=(state.public && state.public.turn ? 'دور: '+state.public.turn : 'جارٍ التحميل');
    },
    setLegalActions: function(a){},
    setLoading: function(v){var b=document.getElementById('btn-chess-resign'); if(b){b.disabled=!!v;b.classList.toggle('loading',!!v);}},
    showSuccess: function(m){var s=document.getElementById('chess-status'); if(s){s.textContent='✓ '+m;s.style.color='#19D9A0';setTimeout(function(){s.textContent='';},2000);}},
    showError: function(m){var s=document.getElementById('chess-status'); if(s){s.textContent='✗ '+m;s.style.color='#FF4D4F';setTimeout(function(){s.textContent='';},2500);}},
    destroy: function(){}
  };
})();
