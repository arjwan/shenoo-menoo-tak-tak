(function(){
  'use strict';
  window.kahwaCardsUI = {
    mount: function(c,ctx){
      c.innerHTML='<div class="kahwa-board" style="background:linear-gradient(135deg,#061514,#0b1a15);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:16px;color:#fff;text-align:center;"><h3>🃏 ورق <span style="color:#F0A0C0">(إطار عام)</span></h3><p style="color:#91A39D;font-size:13px;">نوع اللعبة لم يُحدد بعد — سيتم تفعيله لاحقًا</p><div style="padding:20px;background:#132824;border-radius:12px;margin-top:10px;"><strong>yard</strong><div style="font-size:28px;margin:10px 0;">🃏</div><p>يدك: <span id="cards-hand-count">—</span></p><p>المخزن: <span id="cards-stock-count">—</span></p><p>التخليص: <span id="cards-discard-count">—</span></p></div></div>';
      this.render(c, ctx && ctx.state ? ctx.state : {});
    },
    render: function(c,state){
      var publicState = (state && state.public) ? state.public : {};
      document.getElementById('cards-hand-count').textContent = (publicState.players && publicState.players[0] ? publicState.players[0].handCount || '?' : '?');
      document.getElementById('cards-stock-count').textContent = (publicState.stockCount !== undefined ? publicState.stockCount : '?');
      document.getElementById('cards-discard-count').textContent = (publicState.discardCount !== undefined ? publicState.discardCount : '?');
    },
    setLegalActions: function(a){},
    setLoading: function(v){},
    showSuccess: function(m){},
    showError: function(m){},
    bindActions: function(){},
    destroy: function(){}
  };
})();
