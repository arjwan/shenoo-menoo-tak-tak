(function(){
  'use strict';
  window.kahwaTawlaUI = {
    mount: function(c,ctx){
      c.innerHTML='<div class="kahwa-board" style="background:linear-gradient(135deg,#061514,#0b1a15);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:14px;color:#fff;text-align:center;"><h3>🎲 طاولي <span style="color:#E0A83F">(لوحة حقيقية)</span></h3><div style="display:flex;justify-content:center;gap:12px;margin:10px 0;align-items:center;"><div id="tawla-dice" style="font-size:28px;font-weight:900;color:#fff;">🎲 ⚀ ⚁</div></div><div id="tawla-board" style="display:grid;grid-template-columns:repeat(12,1fr);gap:3px;margin:10px 0;background:#132824;padding:8px;border-radius:10px;"></div><div style="display:flex;gap:8px;justify-content:center;margin-top:10px;"><button id="btn-roll" class="kahwa-btn primary">🎲 رمي الزهر</button></div><div id="tawla-status" style="color:#91A39D;font-size:13px;margin-top:8px;"></div></div>';
      this.render(c, ctx && ctx.state ? ctx.state : {});
      (function(ui,self,ctx){
        var btn=document.getElementById('btn-roll');
        if(btn){
          btn.addEventListener('click',async function(){
            btn.disabled=true; btn.classList.add('loading');
            try{
              var roomId=(ctx&&ctx.roomId)?ctx.roomId:(new URLSearchParams(location.search)).get('room');
              if(!roomId) throw new Error('no room');
              var r=await window.SocialAPI.request('/api/game-rooms/'+roomId+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'roll'})});
              self.render(document.getElementById('kahwa-game-stage'),(r&&r.room&&r.room.engineState)?r.room.engineState:(r&&r.engineState?r.engineState:{}));
              self.showSuccess('تم رمي الزهر');
            }catch(e){self.showError(e.message||'خطأ');}
            finally{btn.disabled=false;btn.classList.remove('loading');}
          });
        }
      })(this,this,ctx);
    },
    render: function(c,state){
      state = state || {};
      var pub = state.public || state || {};
      var priv = state.private || {};
      var actions = state.legalActions || [];
      var status = pub.status || 'waiting';
      var turn = pub.turn || '—';
      var board = pub.board || [];
      var dice = pub.dice || [0,0];
      var canRoll = actions.some(function(a){return a && a.type==='roll';});
      document.getElementById('tawla-status').textContent = (status==='active' ? 'دور: ' + turn + ' | ' : '') + 'الحالة: ' + status;
      document.getElementById('btn-roll').style.display = canRoll ? 'inline-block' : 'none';
      document.getElementById('tawla-dice').innerHTML = (dice[0]&&dice[1]) ? '<span style="color:#E0A83F">' + dice[0] + '</span> <span style="color:#fff">' + dice[1] + '</span>' : '🎲 ⚀ ⚁';
      var html = '';
      // Top row points 1-12 (display as 12 points from right to left or standard; use simple 12 columns)
      for(var i=0;i<12;i++){ html += this.renderPoint(pub, i, actions, true); }
      // Bar / middle info
      html += '<div style="grid-column:span 12;display:flex;justify-content:center;gap:20px;padding:4px;background:#0d1814;border-radius:6px;color:#fff;font-size:12px;"><span>Bar: W='+(pub.bar&&pub.bar.white||0)+' B='+(pub.bar&&pub.bar.black||0)+'</span><span>Home: W='+(pub.home&&pub.home.white||0)+' B='+(pub.home&&pub.home.black||0)+'</span></div>';
      // Bottom row points 13-24
      for(var j=12;j<24;j++){ html += this.renderPoint(pub, j, actions, false); }
      document.getElementById('tawla-board').innerHTML = html;
    },
    renderPoint: function(pub, idx, actions, top){
      var point = pub.board && pub.board[idx] ? pub.board[idx] : {white:0,black:0};
      var w = point.white || 0, b = point.black || 0;
      var isLegal = actions.some(function(a){ return a && (a.from===idx || a.to===idx); });
      var bg = isLegal ? 'rgba(224,168,63,.25)' : '#1a2325';
      var dots = '';
      for(var i=0;i<w&&i<5;i++) dots += '<span style="display:inline-block;width:6px;height:6px;background:#fff;border-radius:50%;margin:1px;"></span>';
      if(w>5) dots += '<span style="font-size:10px;color:#fff;">+'+(w-5)+'</span>';
      for(var i=0;i<b&&i<5;i++) dots += '<span style="display:inline-block;width:6px;height:6px;background:#222;border:1px solid #E0A83F;border-radius:50%;margin:1px;"></span>';
      if(b>5) dots += '<span style="font-size:10px;color:#E0A83F;">+'+(b-5)+'</span>';
      return '<div style="background:'+bg+';border:1px solid #333;border-radius:6px;padding:4px;min-height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:#fff;cursor:pointer;">'+(top?'<span style="font-size:10px;color:#91A39D;">'+(idx+1)+'</span>':'<span style="font-size:10px;color:#91A39D;">'+(idx+1)+'</span>')+'<div>'+dots+'</div></div>';
    },
    setLegalActions: function(a){
      var btn = document.getElementById('btn-roll');
      if(btn) btn.style.display = (a && a.some(function(x){return x&&x.type==='roll';})) ? 'inline-block' : 'none';
    },
    setLoading: function(v){ var b=document.getElementById('btn-roll'); if(b){b.disabled=!!v; b.classList.toggle('loading',!!v);} },
    showSuccess: function(m){ var s=document.getElementById('tawla-status'); if(s){s.textContent='✓ '+m; s.style.color='#19D9A0'; setTimeout(function(){s.textContent='';},1800);} },
    showError: function(m){ var s=document.getElementById('tawla-status'); if(s){s.textContent='✗ '+m; s.style.color='#FF4D4F'; setTimeout(function(){s.textContent='';},2500);} },
    destroy: function(){}
  };
})();
