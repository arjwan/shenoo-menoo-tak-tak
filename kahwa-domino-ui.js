(function(){
'use strict';
var current=null,busy=false,nativeFullscreen=false;
function id(x){return String(x&&x.id||x&&x._id||x||'')}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function pip(n){var h='<span class="dom-pips p'+n+'">';for(var i=0;i<n;i++)h+='<i></i>';return h+'</span>'}
function tile(t,cls,attrs){return '<button type="button" class="dom-tile '+(t.a===t.b?'is-double ':'')+(cls||'')+'" '+(attrs||'')+' aria-label="حجر '+t.a+' '+t.b+'"><span>'+pip(t.a)+'</span><em></em><span>'+pip(t.b)+'</span></button>'}
function legalFor(t,state){return(state.legalActions||[]).filter(function(a){return a.type==='place'&&a.tile&&a.tile.id===t.id})}
function notice(s,error){var e=document.getElementById('domino-status');if(e){e.textContent=s;e.className='dom-notice '+(error?'bad':'good')}}
function audioContext(){
 try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;var ac=stoneSound.ac||(stoneSound.ac=new AC());if(ac.state==='suspended')ac.resume().catch(function(){});return ac}catch(_e){return null}
}
function stoneSound(type){
 var ac=audioContext();if(!ac)return;
 function play(){try{var now=ac.currentTime,g=ac.createGain(),o=ac.createOscillator();o.type='triangle';o.frequency.setValueAtTime(type==='draw'?210:155,now);o.frequency.exponentialRampToValueAtTime(type==='draw'?95:62,now+.075);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(type==='draw'?.18:.3,now+.006);g.gain.exponentialRampToValueAtTime(.0001,now+.12);o.connect(g);g.connect(ac.destination);o.start(now);o.stop(now+.13)}catch(_e){}}
 if(ac.state==='running')play();else ac.resume().then(play).catch(function(){});
}
async function act(action){
 if(busy)return;busy=true;notice('جارٍ تنفيذ الحركة…');
 try{await SocialAPI.request('/api/game-rooms/'+current.roomId+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)});stoneSound(action.type);notice('تمت الحركة');if(window.reloadKahwaRoom)await window.reloadKahwaRoom()}
 catch(e){notice(e.message||'تعذرت الحركة',true)}
 finally{busy=false}
}
function choose(t){
 var a=legalFor(t,current.state);
 if(!a.length)return notice(current.state.private&&current.state.private.turn?'هذا الحجر لا يطابق طرف السلسلة':'انتظر دورك',true);
 if(a.length===1)return act(a[0]);
 var bar=document.getElementById('dom-side-choice');bar.hidden=false;
 bar.innerHTML='<button data-side="left">ضع يسارًا</button><button data-side="right">ضع يمينًا</button>';
 bar.onclick=function(e){var side=e.target.dataset.side;if(side){bar.hidden=true;act(a.find(function(x){return x.direction===side})||a[0])}}
}
function render(container,ctx){
 current=ctx;var s=ctx.state||{},priv=s.private||{},pub=s.public||{},hand=priv.hand||[],chain=pub.chain||priv.chain||[],room=ctx.room||{},players=room.players||[];
 document.body.classList.add('domino-active');
 var opponents=players.filter(function(p){return id(p)!==ctx.me}).map(function(p,i){var ep=(pub.players||[]).find(function(x){return id(x)===id(p)});return '<div class="dom-player opponent pos-'+i+'"><b><span class="seat-number">'+(players.indexOf(p)+1)+'</span>'+esc(p.name||p.displayName||p.username||'لاعب')+'</b><small>'+(ep?ep.handCount:'—')+' أحجار</small><div class="dom-backs">'+Array.from({length:Math.min(7,ep?ep.handCount:7)},function(){return'<i></i>'}).join('')+'</div></div>'}).join('');
 var scores=pub.scores||{},last=pub.lastRound||null;
 var scoreHtml=players.map(function(p){return '<div class="dom-score-card"><b>'+esc(p.name||p.displayName||p.username||'لاعب')+'</b><strong>'+Number(scores[id(p)]||0)+'</strong><small>نقطة</small></div>'}).join('');
 var winner=last&&players.find(function(p){return id(p)===id(last.winner)});
 var endHtml=pub.status==='finished'&&last?'<div class="dom-round-end"><b>انتهت الجولة</b><span>الفائز: '+esc(winner&&(winner.name||winner.displayName||winner.username)||'اللاعب')+'</span><strong>+'+Number(last.points||0)+' نقطة</strong></div>':'';
 var chainHtml=chain.length?chain.map(function(t){return tile(t,'chain-tile','disabled')}).join(''):'<span class="dom-empty">ابدأ بالحجر المضيء</span>';
 var handHtml=hand.map(function(t){var ok=legalFor(t,s).length>0;return tile(t,(ok?'is-legal ':'')+'hand-tile','draggable="true" data-id="'+esc(t.id)+'"')}).join('');
 container.innerHTML='<section class="domino-table"><div class="dom-topbar"><strong>دومنة</strong><span>'+(pub.status==='finished'?'انتهت الجولة':priv.turn?'دورك الآن':'انتظر دور اللاعب الآخر')+'</span><button id="dom-menu" aria-label="القائمة">⋮</button></div><div class="dom-hud"><aside class="dom-scores"><small>الجولة '+Number(pub.roundNumber||1)+'</small><div>'+scoreHtml+'</div></aside><button type="button" class="dom-stock" data-stock><b>سحب</b><strong>'+Number(pub.stockCount||0)+'</strong><small>حجر</small></button></div>'+endHtml+opponents+'<div class="dom-chain-drop left" data-drop="left">يسار</div><div class="dom-chain" id="dom-chain">'+chainHtml+'</div><div class="dom-chain-drop right" data-drop="right">يمين</div><div id="dom-side-choice" class="dom-side-choice" hidden></div><div class="dom-self"><small>أحجارك</small><div class="dom-hand">'+handHtml+'</div></div><div class="dom-tools" hidden><button data-tool="draw">سحب</button><button data-tool="pass">مرور</button><button data-tool="newround">جولة جديدة</button><button data-tool="fullscreen">ملء الشاشة</button></div><p id="domino-status" class="dom-notice"></p></section>';
 container.querySelectorAll('.hand-tile').forEach(function(el){
   el.onpointerdown=audioContext;el.onclick=function(){audioContext();var t=hand.find(function(x){return x.id===el.dataset.id});if(t)choose(t)};
   el.ondragstart=function(e){e.dataTransfer.setData('text/plain',el.dataset.id);container.classList.add('drag-active')};
   el.ondragend=function(){container.classList.remove('drag-active')};
 });
 container.querySelectorAll('[data-drop]').forEach(function(z){z.ondragover=function(e){e.preventDefault()};z.ondrop=function(e){e.preventDefault();var tid=e.dataTransfer.getData('text/plain'),t=hand.find(function(x){return x.id===tid}),a=t&&legalFor(t,s).find(function(x){return x.direction===z.dataset.drop});container.classList.remove('drag-active');if(a)act(a);else notice('لا يمكن وضع الحجر في هذا الطرف',true)}});
 var chainEl=container.querySelector('#dom-chain'),pan=null;
 chainEl.onpointerdown=function(e){pan={x:e.clientX,left:chainEl.scrollLeft};chainEl.setPointerCapture&&chainEl.setPointerCapture(e.pointerId);chainEl.classList.add('is-panning')};
 chainEl.onpointermove=function(e){if(pan)chainEl.scrollLeft=pan.left-(e.clientX-pan.x)};
 chainEl.onpointerup=chainEl.onpointercancel=function(){pan=null;chainEl.classList.remove('is-panning')};
 var stockButton=container.querySelector('[data-stock]'),canDraw=(s.legalActions||[]).some(function(a){return a.type==='draw'});
 stockButton.disabled=!canDraw;stockButton.onpointerdown=audioContext;stockButton.onclick=function(){audioContext();if(canDraw)act({type:'draw'});else notice(priv.turn?'لديك حجر صالح للعب':'انتظر دورك',true)};
 var tools=container.querySelector('.dom-tools');container.querySelector('#dom-menu').onclick=function(){tools.hidden=!tools.hidden};
 tools.onclick=function(e){var k=e.target.dataset.tool;if(k==='fullscreen'){if(window.ShnoManoNative&&window.ShnoManoNative.setFullscreen){nativeFullscreen=!nativeFullscreen;window.ShnoManoNative.setFullscreen(nativeFullscreen);document.body.classList.toggle('native-game-fullscreen',nativeFullscreen)}else if(!document.fullscreenElement)container.requestFullscreen&&container.requestFullscreen();else document.exitFullscreen&&document.exitFullscreen()}if(k==='draw')act({type:'draw'});if(k==='pass')act({type:'pass'});if(k==='newround'){SocialAPI.request('/api/game-rooms/'+current.roomId+'/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(){return window.reloadKahwaRoom&&window.reloadKahwaRoom()}).catch(function(x){notice(x.message||'تعذر بدء جولة جديدة',true)})}};
 var draw=(s.legalActions||[]).some(function(a){return a.type==='draw'}),pass=(s.legalActions||[]).some(function(a){return a.type==='pass'});
 tools.querySelector('[data-tool="draw"]').hidden=!draw;tools.querySelector('[data-tool="pass"]').hidden=!pass;tools.querySelector('[data-tool="newround"]').hidden=!(pub.status==='finished'&&id(room.owner)===ctx.me);
 var target=Number(room.scoreTarget||100),topScore=Math.max.apply(null,[0].concat(Object.keys(scores).map(function(k){return Number(scores[k]||0)}))),matchFinished=topScore>=target;
 if(pub.status==='finished'&&matchFinished){notice('انتهت المباراة — تم بلوغ '+target+' نقطة')}
 if(pub.status==='finished'&&!matchFinished&&id(room.owner)===ctx.me){setTimeout(function(){if(current===ctx){SocialAPI.request('/api/game-rooms/'+ctx.roomId+'/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(){return window.reloadKahwaRoom&&window.reloadKahwaRoom()}).catch(function(e){notice(e.message||'تعذر بدء الجولة التالية',true)})}},5000)}
}
window.kahwaDominoUI={mount:render,render:render,bindActions:function(){},setLegalActions:function(){},showSuccess:function(s){notice(s)},showError:function(s){notice(s,true)},destroy:function(){document.body.classList.remove('domino-active')}};
})();