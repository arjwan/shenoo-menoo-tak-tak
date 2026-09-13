(function(){
  'use strict';
  var grid,active=0,startX=0,dragging=false;
  function cards(){return grid?Array.from(grid.querySelectorAll('.story-card')):[];}
  function clamp(i,total){return total?((i%total)+total)%total:0;}
  function distance(i,total){var d=i-active;if(d>total/2)d-=total;if(d<-total/2)d+=total;return d;}
  function sync(){
    var list=cards(),total=list.length;if(!total)return;
    active=clamp(active,total);
    list.forEach(function(card,i){var d=distance(i,total),pos=Math.max(-3,Math.min(3,d));card.dataset.deckPosition=String(pos);card.classList.toggle('is-active',d===0);card.setAttribute('aria-hidden',d===0?'false':'true');card.querySelectorAll('video,audio').forEach(function(media){if(d!==0&&!media.paused)media.pause();});});
    var label=grid.parentElement.querySelector('[data-story-deck-count]');if(label)label.textContent=(active+1)+' / '+total;
  }
  function go(delta){active+=delta;sync();}
  function enhance(){
    grid=document.getElementById('storyGrid');if(!grid)return;
    var list=cards();if(!list.length){grid.classList.remove('is-story-deck');return;}
    grid.classList.add('is-story-deck');
    if(!grid.dataset.deckReady){
      grid.dataset.deckReady='1';
      var controls=document.createElement('div');controls.className='story-deck-controls';controls.innerHTML='<button type="button" data-story-deck-prev aria-label="القصة السابقة">‹</button><span data-story-deck-count></span><button type="button" data-story-deck-next aria-label="القصة التالية">›</button><small>اسحب يمينًا أو يسارًا</small>';
      grid.after(controls);
      controls.querySelector('[data-story-deck-prev]').onclick=function(){go(-1);};
      controls.querySelector('[data-story-deck-next]').onclick=function(){go(1);};
      grid.addEventListener('click',function(e){var card=e.target.closest('.story-card');if(!card||card.classList.contains('is-active')||e.target.closest('button,a,input,video,audio'))return;active=cards().indexOf(card);sync();});
      grid.addEventListener('pointerdown',function(e){if(e.target.closest('button,a,input,video,audio'))return;startX=e.clientX;dragging=true;grid.setPointerCapture?.(e.pointerId);});
      grid.addEventListener('pointerup',function(e){if(!dragging)return;dragging=false;var dx=e.clientX-startX;if(Math.abs(dx)>45)go(dx<0?1:-1);});
      document.addEventListener('keydown',function(e){if(e.key==='ArrowLeft')go(1);else if(e.key==='ArrowRight')go(-1);});
    }
    var wanted=new URLSearchParams(location.search).get('id'),idx=wanted?list.findIndex(function(card){return String(card.dataset.id)===String(wanted);}):-1;if(idx>=0)active=idx;sync();
  }
  function start(){var target=document.getElementById('storyGrid');if(!target)return;new MutationObserver(enhance).observe(target,{childList:true});enhance();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}());
