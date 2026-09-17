(function(){
'use strict';
var ctx=null,selected=null,busy=false;
var glyph={white:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},black:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}},pieceName={p:'بيدق',n:'حصان',b:'فيل',r:'قلعة',q:'وزير',k:'ملك'};
function actions(){return(ctx&&ctx.state&&ctx.state.legalActions)||[]}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function square(file,rank){return'abcdefgh'[file]+String(rank+1)}
function sound(capture){try{var A=window.AudioContext||window.webkitAudioContext,a=sound.a||(sound.a=new A()),o=a.createOscillator(),g=a.createGain(),t=a.currentTime;a.resume();o.type='triangle';o.frequency.setValueAtTime(capture?190:280,t);o.frequency.exponentialRampToValueAtTime(capture?70:150,t+.11);g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g);g.connect(a.destination);o.start();o.stop(t+.13)}catch(e){}}
function statusText(pub,priv){if(pub.finished)return pub.winner==='draw'?'تعادل':pub.finishReason==='resignation'?'فاز '+pub.winner+' بالاستسلام':'فاز '+pub.winner;return(pub.check?'كش — ':'')+(priv.turn?'دورك':'دور اللاعب الآخر')}
function show(text,bad){var e=document.querySelector('.chess-notice');if(e){e.textContent=text;e.className='chess-notice '+(bad?'bad':'')}}
async function act(action){if(busy)return;busy=true;try{await SocialAPI.request('/api/game-rooms/'+encodeURIComponent(ctx.roomId)+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)});sound(false);selected=null;if(window.reloadKahwaRoom)await window.reloadKahwaRoom()}catch(e){show(e.message||'تعذرت الحركة',true)}finally{busy=false}}
function captured(pub,color){return(pub.moveHistory||[]).filter(function(m){return m.captured&&m.color===color}).map(function(m){return glyph[color==='white'?'black':'white'][m.captured]||''}).join(' ')}
function render(c,x){
 ctx=x;var pub=x.state&&x.state.public||{},priv=x.state&&x.state.private||{},board=pub.board||[],flip=priv.myColor==='black',players=x.room&&x.room.players||[],cells=[];
 for(var vr=0;vr<8;vr++)for(var vf=0;vf<8;vf++){var file=flip?7-vf:vf,rank=flip?vr:7-vr,sq=square(file,rank),idx=(7-rank)*8+file,piece=board[idx],from=actions().some(function(a){return a.type==='move'&&a.from===sq}),to=selected&&actions().some(function(a){return a.type==='move'&&a.from===selected&&a.to===sq});cells.push('<button type="button" class="chess-square '+(((file+rank)%2)?'dark':'light')+(selected===sq?' selected':'')+(to?' target':'')+'" data-square="'+sq+'" '+(from||to?'':'disabled')+'><span>'+(piece?glyph[piece.color][piece.type]:'')+'</span><small>'+sq+'</small></button>')}
 var history=(pub.moveHistory||[]).slice(-12).reverse().map(function(m){return'<li><b>'+esc(m.san||m.from+'-'+m.to)+'</b>'+(m.captured?' · أخذ '+pieceName[m.captured]:'')+'</li>'}).join('');
 var names=players.map(function(p,i){return'<div><b>'+(i?'⚫ ':'⚪ ')+esc(p.name||p.displayName||p.username||'لاعب')+'</b><small>'+(i?'الأسود':'الأبيض')+'</small></div>'}).join('');
 c.innerHTML='<section class="chess-table"><header><strong>♟ شطرنج شنو منو</strong><span>'+statusText(pub,priv)+'</span></header><div class="chess-players">'+names+'</div><div class="chess-layout"><div><div class="chess-captured">أخذ الأبيض: '+captured(pub,'white')+'</div><div class="chess-board">'+cells.join('')+'</div><div class="chess-captured">أخذ الأسود: '+captured(pub,'black')+'</div></div><aside><h3>سجل النقلات</h3><ol>'+history+'</ol><button type="button" data-resign '+(pub.finished?'disabled':'')+'>استسلام</button></aside></div><p class="chess-notice">'+statusText(pub,priv)+'</p></section>';
 c.querySelectorAll('[data-square]').forEach(function(btn){btn.onclick=function(){var sq=btn.dataset.square,own=actions().some(function(a){return a.type==='move'&&a.from===sq});if(!selected&&own){selected=sq;return render(c,x)}if(selected){var move=actions().find(function(a){return a.type==='move'&&a.from===selected&&a.to===sq});if(move)return act(move);selected=own?sq:null;render(c,x)}}});
 var resign=c.querySelector('[data-resign]');if(resign)resign.onclick=function(){if(confirm('هل تريد الاستسلام وإنهاء المباراة؟'))act({type:'resign'})};
}
window.kahwaChessUI={mount:render,render:render,bindActions:function(){},setLegalActions:function(){},setLoading:function(v){busy=!!v},showSuccess:function(m){show('✓ '+m)},showError:function(m){show(m,true)},destroy:function(){ctx=null;selected=null}};
})();
