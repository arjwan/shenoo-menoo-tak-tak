'use strict';
const {app,BrowserWindow,Menu,Tray,nativeImage,dialog,shell,session,desktopCapturer}=require('electron');
const path=require('node:path');
const {HOME,trusted,external,isAllowedMedia}=require('./security.cjs');

const gotLock=app.requestSingleInstanceLock();
if(!gotLock){app.quit();}
else {
  let win=null,tray=null,quitting=false;
  app.setAppUserModelId('com.shnomano.messenger');
  function icon(){
    // Built-in vector Windows tray icon: does not rely on an external image.
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="17" fill="#0e766e"/><path d="M13 19h38v27H27L15 54v-8h-2z" fill="#fff"/><path d="M22 28h22M22 36h15" stroke="#0e766e" stroke-width="4" stroke-linecap="round"/></svg>';
    return nativeImage.createFromDataURL('data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'));
  }
  function setupPermissions(){
    const s=session.defaultSession;
    s.setPermissionCheckHandler((webContents,permission,requestingOrigin)=>{
      if(!trusted(requestingOrigin))return false;
      return isAllowedMedia(permission);
    });
    s.setPermissionRequestHandler((webContents,permission,callback,details)=>{
      if(!trusted(details.requestingUrl||webContents.getURL())||!isAllowedMedia(permission))return callback(false);
      if(permission==='notifications')return callback(true);
      if(permission==='display-capture')return callback(true);
      const type=permission==='media'?'الميكروفون والكاميرا':'الوسائط';
      dialog.showMessageBox(win||undefined,{
        type:'question',title:'صلاحيات شنو منو ماسنجر',
        message:'السماح باستخدام '+type+' في المكالمات؟',
        buttons:['سماح','رفض'],defaultId:0,cancelId:1,noLink:true
      }).then(r=>callback(r.response===0)).catch(()=>callback(false));
    });
    s.setDisplayMediaRequestHandler(async(request,callback)=>{
      if(!trusted(request.securityOrigin))return;
      try{
        const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:160,height:90}});
        if(!sources.length)return;
        const choices=sources.slice(0,12);
        const result=await dialog.showMessageBox(win||undefined,{
          type:'question',
          title:'مشاركة الشاشة — شنو منو ماسنجر',
          message:'اختر النافذة أو الشاشة التي تريد مشاركتها',
          buttons:[...choices.map((x,i)=>(i+1)+'. '+x.name),'إلغاء'],
          cancelId:choices.length,defaultId:choices.length,noLink:true
        });
        if(result.response<choices.length)callback({video:choices[result.response]});
      }catch(e){console.error('Screen capture unavailable:',e.message);}
    });
  }
  function desktopCSS(){
    return `
      @media (min-width:700px) {
        .social-page{max-width:none!important;width:100%!important;margin:0!important;padding:10px!important}
        .site-header{display:none!important}
        .chat-shell{height:calc(100vh - 36px)!important;min-height:500px!important;display:grid!important;grid-template-columns:minmax(290px,340px) minmax(0,1fr)!important;direction:rtl;overflow:hidden!important}
        .conversation-list{grid-column:1;overflow:auto!important;min-width:0}
        .chat-window{grid-column:2;min-width:0;height:100%!important}
      }
      body{overflow:hidden}
    `;
  }
  function createWindow(){
    win=new BrowserWindow({
      width:1220,height:810,minWidth:800,minHeight:540,title:'شنو منو ماسنجر',
      backgroundColor:'#0b1020',show:false,autoHideMenuBar:true,icon:icon(),
      webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,
        webSecurity:true,allowRunningInsecureContent:false,
        spellcheck:true}
    });
    const wc=win.webContents;
    wc.setWindowOpenHandler(({url})=>{
      if(trusted(url))return {action:'allow',overrideBrowserWindowOptions:{width:900,height:700,
        webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}}};
      if(external(url))shell.openExternal(url).catch(()=>{});
      return {action:'deny'};
    });
    wc.on('will-navigate',(event,url)=>{
      if(!trusted(url)){event.preventDefault();if(external(url))shell.openExternal(url).catch(()=>{});}
    });
    wc.on('will-redirect',(event,url)=>{if(!trusted(url))event.preventDefault();});
    wc.on('did-finish-load',()=>{
      if(/\/messages(?:\.html)?(?:[?#]|$)/.test(wc.getURL()))wc.insertCSS(desktopCSS()).catch(()=>{});
    });
    wc.on('render-process-gone',()=>{if(!quitting)dialog.showErrorBox('شنو منو ماسنجر','تعذر عرض المحادثات. أعد تشغيل البرنامج.');});
    win.once('ready-to-show',()=>win.show());
    win.on('close',event=>{
      if(!quitting){event.preventDefault();win.hide();}
    });
    win.loadURL(HOME).catch(()=>{
      dialog.showMessageBox(win,{type:'warning',message:'تعذر الاتصال بموقع شنو منو. تأكد من اتصال الإنترنت.',buttons:['إعادة المحاولة','إغلاق']})
        .then(r=>{if(r.response===0)win.loadURL(HOME);else win.hide();});
    });
  }
  function createTray(){
    tray=new Tray(icon());
    tray.setToolTip('شنو منو ماسنجر');
    const menu=Menu.buildFromTemplate([
      {label:'فتح شنو منو ماسنجر',click:()=>{win?.show();win?.focus();}},
      {label:'المحادثات',click:()=>{win?.show();win?.loadURL(HOME);}},
      {type:'separator'},
      {label:'خروج نهائي',click:()=>{quitting=true;app.quit();}}
    ]);
    tray.setContextMenu(menu);
    tray.on('double-click',()=>{win?.show();win?.focus();});
  }
  app.on('second-instance',()=>{win?.show();win?.focus();});
  app.whenReady().then(()=>{
    setupPermissions();
    createWindow();
    createTray();
  });
  app.on('before-quit',()=>{quitting=true;});
  app.on('window-all-closed',()=>{/* keep messenger active in the system tray */});
  app.on('activate',()=>{win?.show();});
}
