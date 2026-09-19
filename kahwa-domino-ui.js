(function(){
'use strict';
var current=null,busy=false,nativeFullscreen=false,lastBox=null,rszOn=false,rszQ=false;
function id(x){return String(x&&x.id||x&&x._id||x||'')}
function moveId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,10)}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function pip(n){var h='<span class="dom-pips p'+n+'">';for(var i=0;i<n;i++)h+='<i></i>';return h+'</span>'}
function tile(t,cls,attrs){return '<button type="button" class="dom-tile '+(t.a===t.b?'is-double ':'')+(cls||'')+'" '+(attrs||'')+' aria-label="حجر '+t.a+' '+t.b+'"><span>'+pip(t.a)+'</span><em></em><span>'+pip(t.b)+'</span></button>'}
function legalFor(t,state){return(state.legalActions||[]).filter(function(a){return a.type==='place'&&a.tile&&a.tile.id===t.id})}
function notice(s,error){var e=document.getElementById('domino-status');if(e){e.textContent=s;e.className='dom-notice '+(error?'bad':'good')}}
// Pure snake-path geometry: the logical chain (order + orientation) is NEVER
// modified here; this only assigns each tile a true rect {x,y,w,h,rot}.
// Right side of the anchor snakes right→down→left→down→right, the left side
// left→up→right→up→left. Turn columns are derived from the measured width W:
// no fixed pixel constants decide where turns happen. Orientation is derived
// from true chain-neighbor geometry: every tile's a-half faces its
// chain-previous neighbor and its b-half its chain-next neighbor (data tiles
// 0/180 by run direction, doubles immune, corners ±90 by neighbor rows), so
// touching halves always show equal pips.
function snakeLayout(chain,W,tileW,tileH,gap,anchorId){
 var n=(chain||[]).length,out={rects:[],cells:[],boardW:0,boardH:0,rows:0,cols:0,anchorIndex:-1};
 if(!n||!(W>0)||!(tileW>0)||!(tileH>0))return out;
 // Domino geometry: cells touch.  A turn/double is vertical and spans exactly
 // two half-rows; it must not inflate a whole row and create empty lanes.
 gap=0;
 var sx=tileW, rowH=tileH, cols=Math.max(3,Math.floor(W/sx)),lo=1,hi=cols-2;
 var anchor=Math.floor(n/2),k;
 if(anchorId!=null){for(k=0;k<n;k++){if(String(chain[k].id)===String(anchorId)){anchor=k;break}}}
 out.anchorIndex=anchor;
 var ax=Math.floor((cols-1)/2);if(ax<lo)ax=lo;if(ax>hi)ax=hi;
 var cells=new Array(n),i,x,y,dx,nx,ccx;
 cells[anchor]={cx:ax,cy:0,corner:false};
 x=ax;y=0;dx=1;
 for(i=anchor+1;i<n;i++){nx=x+dx;
  if(nx>=lo&&nx<=hi){x=nx;cells[i]={cx:x,cy:y,corner:false}}
  else{ccx=dx>0?cols-1:0;cells[i]={cx:ccx,r1:y,r2:y+1,corner:true};y=y+1;x=ccx;dx=-dx}}
 x=ax;y=0;dx=-1;
 for(i=anchor-1;i>=0;i--){nx=x+dx;
  if(nx>=lo&&nx<=hi){x=nx;cells[i]={cx:x,cy:y,corner:false}}
  else{ccx=dx>0?cols-1:0;cells[i]={cx:ccx,r1:y-1,r2:y,corner:true};y=y-1;x=ccx;dx=-dx}}
 var minR=0,maxR=0,c;
 for(i=0;i<n;i++){c=cells[i];
  if(c.corner){if(c.r1<minR)minR=c.r1;if(c.r2>maxR)maxR=c.r2}
  else{if(c.cy<minR)minR=c.cy;if(c.cy>maxR)maxR=c.cy}}
 // Normal packed mode uses rowH=tileH, so turns touch exactly. If a double
 // is boxed in by occupied cells in the same column above AND below (possible
 // only in very long cramped snakes), use the safe pitch to prevent overlap.
 for(i=0;i<n;i++){c=cells[i];if(c.corner||chain[i].a!==chain[i].b)continue;var ub=false,db=false;
  for(var qi=0;qi<n;qi++){if(qi===i)continue;var qc=cells[qi];
   if(qc.corner){if(qc.cx===c.cx&&(qc.r1===c.cy-1||qc.r2===c.cy-1))ub=true;if(qc.cx===c.cx&&(qc.r1===c.cy+1||qc.r2===c.cy+1))db=true}
   else if(qc.cx===c.cx){if(qc.cy===c.cy-1)ub=true;if(qc.cy===c.cy+1)db=true}
  }
  if(ub&&db){rowH=tileW;break}
 }
 var sh=-minR,raw=[],minX=0,minY=0,maxX=cols*sx,maxY=(maxR-minR+1)*rowH;
 function rowOf(j){var c=cells[j];return c.corner?c.r1:c.cy}
 for(i=0;i<n;i++){var t=chain[i],cc=cells[i],dbl=t.a===t.b,fw,fh,rx,ry,rot=0;
  if(cc.corner){fw=tileH;fh=tileW;
   rx=cc.cx*sx+(tileW-fw)/2;
   ry=(Math.min(cc.r1,cc.r2)+sh)*rowH;
   if(i>0&&i+1<n){rot=(rowOf(i-1)<rowOf(i+1))?90:-90}
   else if(i>0){rot=(rowOf(i-1)===cc.r1)?90:-90}
   else{rot=(rowOf(i+1)===cc.r1)?-90:90}
  }else if(dbl){fw=tileH;fh=tileW;
   rx=cc.cx*sx+(tileW-fw)/2;
   var rowTop=(cc.cy+sh)*rowH, upBusy=false, downBusy=false;
   for(var jj=0;jj<n;jj++){if(jj===i)continue;var oc=cells[jj];
    if(oc.corner){if(oc.cx===cc.cx&&(oc.r1===cc.cy-1||oc.r2===cc.cy-1))upBusy=true;if(oc.cx===cc.cx&&(oc.r1===cc.cy+1||oc.r2===cc.cy+1))downBusy=true}
    else if(oc.cx===cc.cx){if(oc.cy===cc.cy-1)upBusy=true;if(oc.cy===cc.cy+1)downBusy=true}
   }
   // A perpendicular double is allowed to overhang into the empty side only;
   // this keeps packed snake rows from colliding while preserving no cell gaps.
   if(downBusy&&!upBusy)ry=rowTop+rowH-tileW;
   else if(upBusy&&!downBusy)ry=rowTop;
   else ry=rowTop-(tileW-rowH)/2;
  }else{fw=tileW;fh=tileH;
   rx=cc.cx*sx;
   ry=(cc.cy+sh)*rowH;
   if(i>0){var pc=cells[i-1];rot=((pc.corner?pc.cx:pc.cx)<cc.cx)?0:180}
   else if(i+1<n){var nc=cells[i+1];rot=((nc.corner?nc.cx:nc.cx)>cc.cx)?0:180}
  }
  raw.push({x:rx,y:ry,w:fw,h:fh,rot:rot,corner:!!cc.corner,row:(cc.corner?cc.r1:cc.cy)+sh,col:cc.cx,id:t.id});
  out.cells.push(cc.corner?{cx:cc.cx,r1:cc.r1+sh,r2:cc.r2+sh,corner:true}:{cx:cc.cx,cy:cc.cy+sh,corner:false})}
 // Physical packing: cells decide where the snake turns, but actual x positions
 // are edge-to-edge. A vertical double/turn is narrow, so a fixed-width grid
 // would visibly leave holes; this pass removes those holes.
 raw[anchor].x=0;
 function cxOf(z){return cells[z].cx}
 for(i=anchor+1;i<n;i++){raw[i].x=(cxOf(i)>cxOf(i-1))?raw[i-1].x+raw[i-1].w:raw[i-1].x-raw[i].w}
 for(i=anchor-1;i>=0;i--){raw[i].x=(cxOf(i)>cxOf(i+1))?raw[i+1].x+raw[i+1].w:raw[i+1].x-raw[i].w}
 minX=0;minY=0;maxX=0;maxY=0;
 for(i=0;i<raw.length;i++){var rrw=raw[i];if(i===0){minX=rrw.x;minY=rrw.y;maxX=rrw.x+rrw.w;maxY=rrw.y+rrw.h}
  else{if(rrw.x<minX)minX=rrw.x;if(rrw.y<minY)minY=rrw.y;if(rrw.x+rrw.w>maxX)maxX=rrw.x+rrw.w;if(rrw.y+rrw.h>maxY)maxY=rrw.y+rrw.h}}
 for(i=0;i<raw.length;i++){raw[i].x-=minX;raw[i].y-=minY}
 out.rects=raw;out.boardW=maxX-minX;out.boardH=maxY-minY;
 out.rows=maxR-minR+1;out.cols=cols;
 return out;
}
function snakeScale(bW,bH,aW,aH){
 if(!(bW>0)||!(bH>0)||!(aW>0)||!(aH>0))return 1;
 var s=Math.min(1,aW/bW,aH/bH);return s>0?s:1;
}
function snakeTileSize(W){
 var w=Math.max(40,Math.min(86,Math.round(W/8)));
 return {w:w,h:Math.max(24,Math.round(w/2))};
}
function renderChain(chainEl,chain,anchorId,W,availW,availH){
 if(!chain.length){chainEl.innerHTML='<span class="dom-empty">ابدأ بالحجر المضيء</span>';return}
 var ts=snakeTileSize(W),lay=snakeLayout(chain,W,ts.w,ts.h,0,anchorId);
 var sc=snakeScale(lay.boardW,lay.boardH,availW,availH);
 var pipPx=Math.max(3,Math.round(ts.w/12)),h='',i;
 for(i=0;i<lay.rects.length;i++){var r=lay.rects[i],t=chain[i],style;
  if(r.corner){var cx=r.x+r.w/2,cy=r.y+r.h/2;
   style='left:'+Math.round(cx-ts.w/2)+'px;top:'+Math.round(cy-ts.h/2)+'px;width:'+ts.w+'px;height:'+ts.h+'px;--pip:'+pipPx+'px;transform:rotate('+r.rot+'deg)'}
  else{style='left:'+Math.round(r.x)+'px;top:'+Math.round(r.y)+'px;width:'+Math.round(r.w)+'px;height:'+Math.round(r.h)+'px;--pip:'+pipPx+'px'+(r.rot?';transform:rotate('+r.rot+'deg)':'')}
  h+=tile(t,'chain-tile'+(r.corner?' is-turn':(r.rot?' is-rev':'')),'disabled style="'+style+'"')}
 chainEl.innerHTML='<div class="dom-snake-view" style="width:'+Math.max(1,Math.round(lay.boardW*sc))+'px;height:'+Math.max(1,Math.round(lay.boardH*sc))+'px"><div class="dom-snake-board" style="width:'+lay.boardW+'px;height:'+lay.boardH+'px;transform:scale('+sc.toFixed(3)+')">'+h+'</div></div>';
}
async function act(action){
 if(busy)return;busy=true;notice('جارٍ تنفيذ الحركة…');
 try{action.moveId=action.moveId||moveId();var d=await SocialAPI.request('/api/game-rooms/'+current.roomId+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)});notice('تمت الحركة');if(d&&d.room&&window.kahwaApplyActionResponse)window.kahwaApplyActionResponse(d.room);else if(window.reloadKahwaRoom)await window.reloadKahwaRoom()}
 catch(e){notice(e.message||'تعذرت الحركة',true);try{if(window.reloadKahwaRoom)window.reloadKahwaRoom()}catch(_){}}
 finally{busy=false}
}
function choose(t){
 var s=current.state||{},chain=((s.public||{}).chain||(s.private||{}).chain||[]);
 var a=legalFor(t,s);
 if(!a.length){
  if(!(s.private&&s.private.turn))return notice('انتظر دورك',true);
  if(!chain.length)return notice('ابدأ بالدبل المطلوب — الحجر المضيء',true);
  return notice('هذا الحجر لا يطابق طرف السلسلة',true);
 }
 if(a.length===1)return act(a[0]);
 var bar=document.getElementById('dom-side-choice');bar.hidden=false;
 bar.innerHTML='<button data-side="left">ضع يسارًا</button><button data-side="right">ضع يمينًا</button>';
 bar.onclick=function(e){var side=e.target.dataset.side;if(side){bar.hidden=true;act(a.find(function(x){return x.direction===side})||a[0])}}
}
function onResize(){if(rszQ||!current||!lastBox)return;rszQ=true;var raf=window.requestAnimationFrame||function(f){f()};raf(function(){rszQ=false;if(current&&lastBox)render(lastBox,current)})}
function destroy(){if(rszOn&&window.removeEventListener){try{window.removeEventListener('resize',onResize)}catch(_){}rszOn=false}current=null;lastBox=null;document.body.classList.remove('domino-active')}
function render(container,ctx){
 current=ctx;lastBox=container;var s=ctx.state||{},priv=s.private||{},pub=s.public||{},hand=priv.hand||[],chain=pub.chain||priv.chain||[],room=ctx.room||{},players=room.players||[];
 document.body.classList.add('domino-active');
 if(!rszOn&&window.addEventListener){window.addEventListener('resize',onResize);rszOn=true}
 var opponents=players.filter(function(p){return id(p)!==ctx.me}).map(function(p,i){var ep=(pub.players||[]).find(function(x){return id(x)===id(p)});return '<div class="dom-player opponent pos-'+i+'"><b><span class="seat-number">'+(players.indexOf(p)+1)+'</span>'+esc(p.name||p.displayName||p.username||'لاعب')+'</b><small>'+(ep?ep.handCount:'—')+' أحجار</small><div class="dom-backs">'+Array.from({length:Math.min(7,ep?ep.handCount:7)},function(){return'<i></i>'}).join('')+'</div></div>'}).join('');
 var scores=pub.scores||{},last=pub.lastRound||null;
 var scoreHtml=players.map(function(p){return '<div class="dom-score-card"><b>'+esc(p.name||p.displayName||p.username||'لاعب')+'</b><strong>'+Number(scores[id(p)]||0)+'</strong><small>نقطة</small></div>'}).join('');
 var winner=last&&players.find(function(p){return id(p)===id(last.winner)});
 var endHtml=pub.status==='finished'&&last?'<div class="dom-round-end"><b>انتهت الجولة</b><span>الفائز: '+esc(winner&&(winner.name||winner.displayName||winner.username)||'اللاعب')+'</span><strong>+'+Number(last.points||0)+' نقطة</strong></div>':'';
 var handHtml=hand.map(function(t){var ok=legalFor(t,s).length>0;return tile(t,(ok?'is-legal ':'')+'hand-tile','draggable="true" data-id="'+esc(t.id)+'"')}).join('');
 container.innerHTML='<section class="domino-table"><div class="dom-topbar"><strong>دومنة</strong><span>'+(pub.status==='finished'?'انتهت الجولة':priv.turn?'دورك الآن':'انتظر دور اللاعب الآخر')+'</span><button id="dom-menu" aria-label="القائمة">⋮</button></div><div class="dom-hud"><aside class="dom-scores"><small>الجولة '+Number(pub.roundNumber||1)+'</small><div>'+scoreHtml+'</div></aside><button type="button" class="dom-stock" data-stock><b>سحب</b><strong>'+Number(pub.stockCount||0)+'</strong><small>حجر</small></button></div>'+endHtml+opponents+'<div class="dom-chain-drop left" data-drop="left">يسار</div><div class="dom-chain dom-snake" id="dom-chain"></div><div class="dom-chain-drop right" data-drop="right">يمين</div><div id="dom-side-choice" class="dom-side-choice" hidden></div><div class="dom-self"><small>أحجارك</small><div class="dom-hand">'+handHtml+'</div></div><div class="dom-tools" hidden><button data-tool="draw">سحب</button><button data-tool="pass">مرور</button><button data-tool="newround">جولة جديدة</button><button data-tool="fullscreen">ملء الشاشة</button></div><p id="domino-status" class="dom-notice"></p></section>';
 container.querySelectorAll('.hand-tile').forEach(function(el){
   el.onclick=function(){var t=hand.find(function(x){return x.id===el.dataset.id});if(t)choose(t)};
   el.ondragstart=function(e){e.dataTransfer.setData('text/plain',el.dataset.id);container.classList.add('drag-active')};
   el.ondragend=function(){container.classList.remove('drag-active')};
 });
 container.querySelectorAll('[data-drop]').forEach(function(z){z.ondragover=function(e){e.preventDefault()};z.ondrop=function(e){e.preventDefault();var tid=e.dataTransfer.getData('text/plain'),t=hand.find(function(x){return x.id===tid}),a=t&&legalFor(t,s).find(function(x){return x.direction===z.dataset.drop});container.classList.remove('drag-active');if(a)act(a);else notice('لا يمكن وضع الحجر في هذا الطرف',true)}});
 var chainEl=container.querySelector('#dom-chain');
 var availW=chainEl.clientWidth||container.clientWidth||window.innerWidth||320;
 var selfEl=container.querySelector('.dom-self'),availH=0;
 if(chainEl.getBoundingClientRect&&selfEl&&selfEl.getBoundingClientRect){try{availH=selfEl.getBoundingClientRect().top-chainEl.getBoundingClientRect().top-14}catch(_){availH=0}}
 if(!(availH>0))availH=(window.innerHeight||600)*0.35;
 if(availH<120)availH=120;
 renderChain(chainEl,chain,pub.openingTileId||null,availW,availW,availH);
 var stockButton=container.querySelector('[data-stock]'),canDraw=(s.legalActions||[]).some(function(a){return a.type==='draw'});
 stockButton.disabled=!canDraw;stockButton.onclick=function(){if(canDraw)act({type:'draw'});else notice(priv.turn?'لديك حجر صالح للعب':'انتظر دورك',true)};
 var tools=container.querySelector('.dom-tools');container.querySelector('#dom-menu').onclick=function(){tools.hidden=!tools.hidden};
 tools.onclick=function(e){var k=e.target.dataset.tool;if(k==='fullscreen'){if(window.ShnoManoNative&&window.ShnoManoNative.setFullscreen){nativeFullscreen=!nativeFullscreen;window.ShnoManoNative.setFullscreen(nativeFullscreen);document.body.classList.toggle('native-game-fullscreen',nativeFullscreen)}else if(!document.fullscreenElement)container.requestFullscreen&&container.requestFullscreen();else document.exitFullscreen&&document.exitFullscreen()}if(k==='draw')act({type:'draw'});if(k==='pass')act({type:'pass'});if(k==='newround'){SocialAPI.request('/api/game-rooms/'+current.roomId+'/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(){return window.reloadKahwaRoom&&window.reloadKahwaRoom()}).catch(function(x){notice(x.message||'تعذر بدء جولة جديدة',true)})}};
 var draw=(s.legalActions||[]).some(function(a){return a.type==='draw'}),pass=(s.legalActions||[]).some(function(a){return a.type==='pass'});
 tools.querySelector('[data-tool="draw"]').hidden=!draw;tools.querySelector('[data-tool="pass"]').hidden=!pass;tools.querySelector('[data-tool="newround"]').hidden=!(pub.status==='finished'&&id(room.owner)===ctx.me);
 var target=Number(room.scoreTarget||100),topScore=Math.max.apply(null,[0].concat(Object.keys(scores).map(function(k){return Number(scores[k]||0)}))),matchFinished=topScore>=target;
 if(pub.status==='finished'&&matchFinished){notice('انتهت المباراة — تم بلوغ '+target+' نقطة')}
 if(pub.status==='finished'&&!matchFinished&&id(room.owner)===ctx.me){setTimeout(function(){if(current===ctx){SocialAPI.request('/api/game-rooms/'+ctx.roomId+'/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(){return window.reloadKahwaRoom&&window.reloadKahwaRoom()}).catch(function(e){notice(e.message||'تعذر بدء الجولة التالية',true)})}},5000)}
}
if(typeof window!=='undefined')window.kahwaDominoUI={mount:render,render:render,bindActions:function(){},setLegalActions:function(){},showSuccess:function(s){notice(s)},showError:function(s){notice(s,true)},destroy:destroy};
if(typeof module!=='undefined'&&module.exports)module.exports={snakeLayout:snakeLayout,snakeScale:snakeScale,snakeTileSize:snakeTileSize};
})();
