(function () {
  'use strict';
  var activeContext = null, activeContainer = null, legalActions = [];

  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function pipPattern(value) {
    var positions={0:[],1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]}, on=positions[Number(value)]||[], html='<span class="domino-pip-grid domino-value-'+Number(value)+'" aria-hidden="true">';
    on.forEach(function(position){html+='<i class="domino-pip domino-pip-'+position+'"></i>';});
    return html+'</span>';
  }
  function tileFace(tile, extraClass, attrs) {
    return '<button type="button" class="domino-tile domino-face '+(extraClass||'')+'" '+(attrs||'')+' aria-label="حجر دومنة '+tile.a+' و'+tile.b+'"><span class="domino-half">'+pipPattern(tile.a)+'</span><span class="domino-divider"></span><span class="domino-half">'+pipPattern(tile.b)+'</span></button>';
  }
  function tileBack(extraClass) { return '<span class="domino-tile domino-back '+(extraClass||'')+'" aria-hidden="true"><span class="domino-ornament"><i></i><b>ش</b><i></i></span></span>'; }
  function normaliseState(ctx) {
    var state=(ctx&&ctx.state)||{}, pri=state.private||{}, pub=state.public||{};
    return {privateState:pri,publicState:pub,hand:pri.hand||state.hand||[],chain:pri.chain||pub.chain||state.chain||[],players:pub.players||state.players||[],stockCount:pri.stockCount!=null?pri.stockCount:(pub.stockCount||0),myTurn:!!(pri.turn!=null?pri.turn:state.turn),status:pub.status||pri.status||state.status||'waiting',winner:pub.winner||state.winner||null,actions:state.legalActions||[]};
  }
  function playerId(player) { return String((player&&(player.id||player._id))||player||''); }
  function playerName(player,index) { return esc((player&&(player.name||player.fullName||player.username))||('اللاعب '+(index+1))); }
  function opponentSeat(player,index) {
    var count=Math.max(0,Number(player&&player.handCount)||0), backs='', shown=Math.min(count,9);
    for(var i=0;i<shown;i+=1) backs+=tileBack('domino-back-mini');
    return '<div class="domino-opponent domino-opponent-'+(index+1)+'"><div class="domino-opponent-meta"><span class="domino-avatar">'+playerName(player,index).charAt(0)+'</span><span><b>'+playerName(player,index)+'</b><small>'+count+' أحجار</small></span></div><div class="domino-opponent-hand">'+backs+'</div></div>';
  }
  function canPlace(tile) { return legalActions.some(function(a){return a.type==='place'&&a.tile&&String(a.tile.id)===String(tile.id);}); }
  function statusText(m) { if(m.status==='finished')return m.winner?'انتهت الجولة — لدينا فائز':'انتهت الجولة';if(m.status==='waiting')return 'بانتظار بدء الجولة';return m.myTurn?'دورك الآن':'دور الخصم'; }
  async function submitAction(action) {
    if(!activeContext||!activeContext.roomId)return;
    var buttons=activeContainer.querySelectorAll('button');buttons.forEach(function(b){b.disabled=true;});
    try {
      var response=await SocialAPI.request('/api/game-rooms/'+activeContext.roomId+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)});
      if(!response.ok)throw new Error(response.message||'الحركة غير مسموحة');
      window.kahwaDominoUI.showSuccess(action.type==='place'?'تم وضع الحجر':action.type==='draw'?'تم سحب حجر':'تم تمرير الدور');
      if(activeContext.onAction)activeContext.onAction({success:true,state:response.room||response});
      document.dispatchEvent(new CustomEvent('kahwa:refresh-room'));
    } catch(error) { window.kahwaDominoUI.showError(error.message||'تعذر تنفيذ الحركة');buttons.forEach(function(b){b.disabled=false;}); }
  }

  window.kahwaDominoUI={
    mount:function(container,ctx){activeContainer=container;activeContext=ctx;legalActions=(ctx&&ctx.state&&ctx.state.legalActions)||[];this.render(container,ctx);},
    render:function(container,ctx){
      activeContainer=container;activeContext=ctx;var m=normaliseState(ctx);legalActions=m.actions;
      var opponents=m.players.filter(function(p){return playerId(p)!==String((m.privateState&&m.privateState.userId)||'');}).slice(0,3);if(opponents.length===m.players.length&&opponents.length>1)opponents=opponents.slice(1);
      var html='<section class="domino-game" aria-label="طاولة الدومنة"><div class="domino-table-frame"><div class="domino-table-felt"><div class="domino-table-mark" aria-hidden="true"><span>ش</span><small>شنو منو</small></div><div class="domino-round-status '+(m.myTurn?'is-my-turn':'')+'"><i></i><span>'+esc(statusText(m))+'</span></div>';
      opponents.forEach(function(p,i){html+=opponentSeat(p,i);});
      html+='<div class="domino-chain" id="domino-chain">';
      if(m.chain.length)m.chain.forEach(function(t){html+=tileFace(t,t.a===t.b?'is-double':'','tabindex="-1"');});else html+='<span class="domino-chain-empty">أول حجر يبدأ السلسلة</span>';
      html+='</div><div class="domino-stock" title="المخزن">'+tileBack('domino-stock-tile')+'<b>'+m.stockCount+'</b><small>المخزن</small></div><div class="domino-player-edge"><div class="domino-player-label"><span class="domino-avatar is-me">أنت</span><b>أحجارك</b></div><div class="domino-player-hand" id="domino-hand">';
      if(m.hand.length)m.hand.forEach(function(t){var playable=m.myTurn&&canPlace(t);html+=tileFace(t,playable?'is-playable':'is-locked','data-tile-id="'+esc(t.id||(t.a+'-'+t.b))+'" data-a="'+t.a+'" data-b="'+t.b+'"'+(playable?'':' disabled'));});else html+='<span class="domino-hand-empty">لا توجد أحجار في يدك</span>';
      html+='</div></div></div></div><div class="domino-action-bar"><div class="domino-direction" hidden><span>ضع الحجر في:</span><button type="button" data-place-side="left">يمين السلسلة</button><button type="button" data-place-side="right">يسار السلسلة</button><button type="button" data-cancel-place>إلغاء</button></div><button type="button" id="btn-draw" class="kahwa-btn primary">سحب من المخزن</button><button type="button" id="btn-pass" class="kahwa-btn accent">مرور</button><span id="domino-status" class="kahwa-status" role="status" aria-live="polite"></span></div></section>';
      container.innerHTML=html;this.setLegalActions(legalActions);
    },
    bindActions:function(container){
      var selected=null;container.addEventListener('click',function(e){var tile=e.target.closest('[data-tile-id]'),direction=container.querySelector('.domino-direction');if(tile&&!tile.disabled){selected={id:tile.dataset.tileId,a:Number(tile.dataset.a),b:Number(tile.dataset.b)};container.querySelectorAll('[data-tile-id]').forEach(function(el){el.classList.toggle('is-selected',el===tile);});direction.hidden=false;return;}var side=e.target.closest('[data-place-side]');if(side&&selected){submitAction({type:'place',tile:selected,direction:side.dataset.placeSide});return;}if(e.target.closest('[data-cancel-place]')){selected=null;direction.hidden=true;container.querySelectorAll('[data-tile-id]').forEach(function(el){el.classList.remove('is-selected');});}});
      container.querySelector('#btn-draw').addEventListener('click',function(){submitAction({type:'draw'});});container.querySelector('#btn-pass').addEventListener('click',function(){submitAction({type:'pass'});});
    },
    setLoading:function(v){if(activeContainer)activeContainer.classList.toggle('is-loading',!!v);},
    setLegalActions:function(actions){legalActions=Array.isArray(actions)?actions:[];if(!activeContainer)return;var d=activeContainer.querySelector('#btn-draw'),p=activeContainer.querySelector('#btn-pass');if(d)d.hidden=!legalActions.some(function(a){return a.type==='draw';});if(p)p.hidden=!legalActions.some(function(a){return a.type==='pass';});},
    showSuccess:function(msg){var el=activeContainer&&activeContainer.querySelector('#domino-status');if(el){el.textContent=msg;el.className='kahwa-status is-success';}},
    showError:function(msg){var el=activeContainer&&activeContainer.querySelector('#domino-status');if(el){el.textContent=msg;el.className='kahwa-status is-error';}},
    destroy:function(){activeContext=null;activeContainer=null;legalActions=[];}
  };
})();
