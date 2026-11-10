/* Site themes cannot cross this boundary and restyle live call controls. */
(function(global){
 'use strict';
 global.ShnoCallSurface={mount:function(stage){
  if(!stage)throw new Error('Call stage missing');
  var host=document.createElement('shno-call-surface');
  var root=host.attachShadow({mode:'open'});
  var reset=document.createElement('style');
  reset.textContent=':host{position:fixed;inset:0;z-index:2147482000;display:block;font-family:Arial,Tahoma,sans-serif;font-size:16px;color:#fff;color-scheme:dark;direction:rtl}:host([hidden]){display:none}*,*::before,*::after{box-sizing:border-box}button,input{font:inherit}button{color:inherit;cursor:pointer}h2,h3,p{margin:0}';
  root.appendChild(reset);
  var sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='call-screen.css?v=20261110-isolated-1';
  var ready=false;
  function sync(){host.hidden=!ready||stage.hidden;document.body.classList.toggle('shno-call-open',!host.hidden);}
  sheet.onload=function(){ready=true;sync();};
  sheet.onerror=function(){
   // Keep an operable end/answer surface if a browser cannot fetch its CSS.
   reset.textContent+=' .call-modal{position:fixed;inset:0;background:#15151b;color:#fff;padding:24px;overflow:auto}.call-modal[hidden]{display:none}.call-controls{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.call-control{background:#303039;border:1px solid #777;border-radius:50%;padding:12px;color:white}.call-control svg{width:30px;height:30px}.call-video{max-width:100%}.call-control.end{background:#f43}.call-control-label{display:block}.call-dock{margin-top:32px}';ready=true;sync();
  };
  root.appendChild(sheet);root.appendChild(stage);host.hidden=true;document.body.appendChild(host);
  new MutationObserver(sync).observe(stage,{attributes:true,attributeFilter:['hidden']});
  sync();return root;
 }};
})(window);
