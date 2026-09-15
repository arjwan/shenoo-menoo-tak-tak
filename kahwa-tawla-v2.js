(function(){
'use strict';
var ctx=null,selected=null,busy=false;
function id(x){return String(x&&x.id||x&&x._id||x||'')}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function actions(){return(ctx.state&&ctx.state.legalActions)||[]}
function notice(s,bad){var e=document.querySelector('.tawla-notice');if(e){e.textContent=s;e.className='tawla-notice '+(bad?'bad':'good')}}
function checker(color,n){var h='';for(var i=0;i<Math.min(n,5);i++)h+='<i class="'+color+'"></i>';if(n>5)h+='<b>'+n+'</b>';return h}
function point(pub,n,top){
 var p=pub.board&&pub.board[n]||{white:0,black:0},from=actions().some(a=>a.type==='move'&&a.from===n),to=selected&&actions().some(a=>a.type==='move'&&a.from===selected&&a.to===n);
 return '<button class="tawla-point '+(top?'top ':'bottom ')+(from?'can-from ':'')+(to?'can-to ':'')+(selected===n?'selected':'')+'" data-point="'+n+'"><span>'+(n+1)+'</span><div>'+checker('white',p.white||0)+checker('black',p.black||0)+'</div></button>'
}
function sound(){try{var A=window.AudioContext||window.webkitAudioContext,a=sound.a||(sound.a=new A());a.resume();var o=a.createOscillator(),g=a.createGain(),t=a.currentTime;o.frequency.setValueAtTime(170,t);o.frequency.exponentialRampToValueAtTime(80,t+.08);g.gain.setValueAtTime(.2,t);g.gain.exponentialRampToValueAtTime(.001,t+.1);o.connect(g);g.connect(a.destination);o.start();o.stop(t+.11)}catch(e){}}
async function act(a){
 if(busy)return;busy=true;
 try{await SocialAPI.request('/api/game-rooms/'+ctx.roomId+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});sound();selected=null;if(window.reloadKahwaRoom)await window.reloadKahwaRoom()}
 catch(e){notice(e.message||'تعذرت الحركة',true)}finally{busy=false}
}
function render(c,x){
 ctx=x;var s=x.state||{},pub=s.public||{},priv=s.private||{},room=x.room||{},players=room.players||[],dice=pub.dice||[0,0],legal=actions(),opening=pub.opening||{resolved:true,rolls:{}},openingRoll=legal.some(a=>a.type==='opening-roll'),canRoll=legal.some(a=>a.type==='roll')||openingRoll;
 document.body.classList.add('tawla-active');
 var top='',bottom='';for(var i=12;i<24;i++)top+=point(pub,i,true);for(var j=11;j>=0;j--)bottom+=point(pub,j,false);
 var names=players.map((p,i)=>'<div><b>'+(i?'⚫ ':'⚪ ')+esc(p.name||p.displayName||p.username||'لاعب')+'</b><small>'+(opening.resolved?Number((pub.scores||{})[id(p)]||0)+' نقطة':opening.rolls[id(p)]?'رمية البداية: '+opening.rolls[id(p)]:'بانتظار الرمية')+'</small></div>').join('');
 c.innerHTML='<section class="tawla-table"><header><strong>طاولي</strong><span>'+(pub.status==='finished'?'انتهت الجولة':priv.turn?'دورك':'انتظر دور اللاعب الآخر')+'</span></header><div class="tawla-players">'+names+'</div><div class="tawla-board"><div class="tawla-row top">'+top+'</div><div class="tawla-bar"><button data-bar="black">وسط الأسود <b>'+(pub.bar&&pub.bar.black||0)+'</b></button><div class="tawla-dice"><button data-roll '+(canRoll?'':'disabled')+'>'+(canRoll?(openingRoll?'🎲 رمية البداية':'🎲 ارْمِ الزهر'):'🎲')+'</button><i>'+(dice[0]||'–')+'</i><i>'+(dice[1]||'–')+'</i><small>'+((pub.remainingMoves||[]).length?'المتبقي: '+pub.remainingMoves.join('، '):'')+'</small></div><button data-bar="white">وسط الأبيض <b>'+(pub.bar&&pub.bar.white||0)+'</b></button></div><div class="tawla-row bottom">'+bottom+'</div></div><div class="tawla-home"><button data-home="black">بيت الأسود <b>'+(pub.home&&pub.home.black||0)+'</b></button><button data-home="white">بيت الأبيض <b>'+(pub.home&&pub.home.white||0)+'</b></button></div><p class="tawla-notice">'+(!opening.resolved?'كل لاعب يرمي مرة، وصاحب الرقم الأعلى يبدأ':priv.myColor==='white'?'أنت الأبيض وتتحرك نحو الخانة 1':'أنت الأسود وتتحرك نحو الخانة 24')+'</p></section>';
 c.querySelector('[data-roll]').onclick=function(){if(canRoll){sound();act({type:openingRoll?'opening-roll':'roll'})}};
 c.querySelectorAll('[data-point]').forEach(function(el){el.onclick=function(){pick(Number(el.dataset.point),c)}});
 c.querySelectorAll('[data-bar]').forEach(function(el){el.onclick=function(){if(el.dataset.bar===priv.myColor&&legal.some(a=>a.from==='bar')){selected='bar';mark(c)}}});
 c.querySelectorAll('[data-home]').forEach(function(el){el.onclick=function(){if(selected!==null){var a=legal.find(a=>a.type==='move'&&a.from===selected&&a.to==='home');if(a)act(a)}}});
}
function mark(c){
 c.querySelectorAll('[data-point]').forEach(function(el){var n=Number(el.dataset.point);el.classList.toggle('selected',selected===n);el.classList.toggle('can-to',selected!==null&&actions().some(a=>a.type==='move'&&a.from===selected&&a.to===n))});
 c.querySelectorAll('[data-home]').forEach(function(el){el.classList.toggle('can-to',selected!==null&&actions().some(a=>a.type==='move'&&a.from===selected&&a.to==='home'))})
}
function pick(n,c){
 var legal=actions();
 if(selected!==null){var choices=legal.filter(a=>a.type==='move'&&a.from===selected&&a.to===n);if(choices.length)return act(choices[0])}
 var direct=legal.filter(a=>a.type==='move'&&a.to===n);
 if(selected===null&&direct.length===1)return act(direct[0]);
 if(legal.some(a=>a.type==='move'&&a.from===n)){selected=n;mark(c);notice('اختر الخانة المضيئة للانتقال')}
 else{selected=null;mark(c);notice('اختر الحجر المضيء ثم مكان الانتقال',true)}
}
window.kahwaTawlaUI={mount:render,render:render,bindActions:function(){},setLegalActions:function(){},showSuccess:s=>notice(s),showError:s=>notice(s,true),destroy:function(){document.body.classList.remove('tawla-active')}};
})();