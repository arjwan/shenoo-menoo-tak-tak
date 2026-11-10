// Run with Node >=22.13 and Playwright installed (Chromium with fake media).
// Uses real WebRTC in separate browser contexts and the production API handlers
// against SQLite. It does not establish Android or physical-device readiness.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const artifacts=process.env.CALL_TEST_ARTIFACTS||path.join(require('node:os').tmpdir(),'shno-call-tests');
fs.mkdirSync(artifacts,{recursive:true});
const {createHash,randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const users=['Alice','Bob','Carol'].map((name,i)=>({id:`${i+1}${'1'.repeat(7)}-1111-4111-8111-${'1'.repeat(12)}`,name,secret:randomUUID()}));
function database(){
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT,full_name TEXT,role TEXT DEFAULT 'user',status TEXT DEFAULT 'active');
 CREATE TABLE conversations(id TEXT PRIMARY KEY);
 CREATE TABLE conversation_members(conversation_id TEXT REFERENCES conversations(id),user_id TEXT REFERENCES users(id));
 CREATE TABLE follows(follower_id TEXT,followed_id TEXT);
 CREATE TABLE messages(id TEXT PRIMARY KEY,conversation_id TEXT REFERENCES conversations(id),sender_id TEXT REFERENCES users(id),text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
 for(const file of ['0007_revocable_sessions.sql','0011_private_message_read_state.sql','20261109_private_call_signaling.sql','20261110_call_groups.sql'])db.exec(fs.readFileSync(path.join(root,'cloudflare/migrations',file),'utf8'));
 for(const u of users){
  db.prepare('INSERT INTO users(id,username,full_name) VALUES(?,?,?)').run(u.id,u.name.toLowerCase(),u.name);
  db.prepare("INSERT INTO auth_sessions(id,user_id,secret_hash,expires_at) VALUES(?,?,?,datetime('now','+1 day'))").run(randomUUID(),u.id,createHash('sha256').update(u.secret).digest('base64url'));
  for(const v of users)if(v!==u)db.prepare('INSERT INTO follows VALUES(?,?)').run(u.id,v.id);
 }
 const adapter={prepare(sql){let values=[];return {bind(...v){values=v;return this},async first(){return db.prepare(sql).get(...values)||null},async all(){return {results:db.prepare(sql).all(...values)}},async run(){const r=db.prepare(sql).run(...values);return {meta:{last_row_id:Number(r.lastInsertRowid),changes:r.changes}}}}},async batch(statements){db.exec('BEGIN');try{const r=await Promise.all(statements.map(s=>s.run()));db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
 return {db,adapter};
}
async function until(fn,label,timeout=20000){const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+label)}
test('real browser WebRTC: text, reject, audio/video, group upgrade and three-way mesh', {timeout:180000},async t=>{
 const {default:worker}=await import('../cloudflare/worker.js');
 const {onRequest}=await import('../functions/api/[[path]].js');
 const {db,adapter}=database();
 const env={DB:adapter,MEDIA:{},AUTH_SECRET:'local-test-secret-only'};
 env.API={fetch:r=>worker.fetch(r,env)};
 const errors=[];
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1:'+server.address().port);
   if(url.pathname.startsWith('/api/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const r=await onRequest({request:new Request(url,{method:req.method,headers:{...req.headers,cookie:'__Host-shino_session='+req.headers['x-test-session']},...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env});
    const result=Buffer.from(await r.arrayBuffer());if(r.status>=400)console.error('API',url.pathname,r.status,result.toString());res.writeHead(r.status,Object.fromEntries(r.headers));res.end(result);return;
   }
   if(url.pathname==='/sw.js'){res.writeHead(404);res.end();return;}
   const file=path.resolve(root,'.'+url.pathname);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
   let content=fs.readFileSync(file);
   if(file.endsWith('.html')&&!process.env.TEST_EMBEDDED_UI)content=content.toString().replace(/<script src="(?:auth-guard|mall|call-permission-guard)\.js[^"\n]*"><\/script>/g,'');
   res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(content);
  }catch(e){console.error(e);errors.push(e.stack);res.writeHead(500);res.end(String(e));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 t.after(async()=>{console.log('diagnostic',db.prepare('SELECT event_type,payload FROM private_call_signals').all().map(x=>({event:x.event_type,type:JSON.parse(x.payload).data?.type})));for(const page of pages)if(!page.isClosed())console.log('peer states',await page.evaluate(()=>({peers:window.testPeers.map(p=>({state:p.connectionState,ice:p.iceConnectionState,signaling:p.signalingState,local:p.localDescription?.type,remote:p.remoteDescription?.type,senders:p.getSenders().map(s=>({kind:s.track?.kind,state:s.track?.readyState}))})),feedback:document.querySelector('[data-message-feedback]')?.textContent})));await browser.close();await new Promise(resolve=>server.close(resolve));db.close()});
 const pages=[];
 for(const u of users){const context=await browser.newContext({permissions:['microphone','camera'],viewport:{width:412,height:915}});const page=await context.newPage();await page.addInitScript(turn=>{window.__testTurn=turn;window.testPeers=[];const Native=RTCPeerConnection;window.RTCPeerConnection=function(...args){const config=window.__testTurn?{iceServers:[{urls:window.__testTurn,username:'test',credential:'local-test-only'}],iceTransportPolicy:'relay'}:args[0];const pc=new Native(config);window.testPeers.push(pc);return pc;};},process.env.TEST_TURN_URL||null);if(process.env.TEST_EMBEDDED_UI)await page.addInitScript(()=>{window.ShnoAndroidCall={getBuildInfo:()=> '1.3.5 (18)',onCallState(){},setSpeaker(){}};});page.on('pageerror',e=>{console.error('PAGE',e);errors.push(e.stack)});pages.push(page)}
 // HTTP localhost rejects __Host- cookies by design; inject only the test session
 // header at the boundary, keeping production handlers/authentication unchanged.
 for(let i=0;i<pages.length;i++)await pages[i].route('**/api/**',route=>route.continue({headers:{...route.request().headers(),'x-test-session':users[i].secret}}));
 const [a,b,c]=pages;
 await a.goto(base+'/messages.html?user='+users[1].id);
 await b.goto(base+'/messages.html?user='+users[0].id);
 await c.goto(base+'/messages.html?user='+users[0].id);
 console.log('loaded',await a.locator('[data-message-feedback]').textContent());
 const conversation=new URL(a.url()).searchParams.get('conversation');
 const invalid=await worker.fetch(new Request(base+'/api/conversations/'+conversation+'/messages',{method:'POST',headers:{Cookie:'__Host-shino_session='+users[0].secret,'Content-Type':'application/json'},body:JSON.stringify({text:'missing type'})}),env);
 assert.equal(invalid.status,400);assert.equal((await invalid.json()).message,'الرسالة النصية غير صالحة');
 if(process.env.TEST_EMBEDDED_UI)assert.equal(await a.locator('[data-call-build]').textContent(),'اتصال 1.3.5 (18)');
 await a.locator('[data-message-input]').fill('رسالة اختبار Android JSON');
 await a.locator('[data-composer]').evaluate(form=>form.requestSubmit());
 await b.locator('[data-chat-messages]').getByText('رسالة اختبار Android JSON').waitFor();console.log('text passed');
 assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n,1);
 await a.locator('[data-start-call="audio"]').click();
 await b.locator('[data-call-accept]').waitFor({state:'visible'});
 await b.locator('[data-call-reject]').click();
 await a.locator('[data-call-modal]').waitFor({state:'hidden'});console.log('reject passed');
 await a.locator('[data-start-call="audio"]').click();
 await b.locator('[data-call-accept]').click();
 for(const page of [a,b])await until(()=>page.locator('[data-call-status]').textContent().then(s=>s.includes('متصل الآن')),'audio connection');
 for(const page of [a,b])assert.equal(await page.locator('[data-remote-video]').evaluate(v=>v.srcObject.getAudioTracks().length),1);
 console.log('audio passed');
 await a.screenshot({path:path.join(artifacts,'call-audio-preview.png')});
 await a.evaluate(()=>{window.sentTones=[];window.testPeers[0].getSenders().find(s=>s.track.kind==='audio').dtmf.ontonechange=e=>window.sentTones.push(e.tone);});
 await a.locator('[data-call-keypad]').click();await a.locator('.call-keypad-grid').getByRole('button',{name:'1',exact:true}).click();
 await until(()=>a.evaluate(()=>window.sentTones.includes('1')),'DTMF tone');await a.locator('.call-keypad-close').click();

 for(let cycle=0;cycle<2;cycle++){
  const previousFrames=await b.evaluate(async()=>{let n=0;for(const pc of window.testPeers)for(const r of (await pc.getStats()).values())if(r.type==='inbound-rtp'&&r.kind==='video')n+=r.framesDecoded||0;return n;});
  await a.locator('[data-call-switch-mode]').click();
  await until(()=>b.evaluate(async before=>{let n=0;for(const pc of window.testPeers)for(const r of (await pc.getStats()).values())if(r.type==='inbound-rtp'&&r.kind==='video')n+=r.framesDecoded||0;return n>before+2;},previousFrames),'remote video frames');
  if(cycle===0)await a.locator('[data-call-expand]').click();
  await a.locator('[data-call-split]').click();
  assert.equal(await a.locator('[data-call-modal]').evaluate(m=>m.classList.contains('shno-split')),cycle===0);
  await a.locator('[data-call-switch-mode]').click();
  await until(()=>a.evaluate(()=>window.shnoGetCallMediaType()==='audio'&&window.testPeers.every(p=>p.signalingState==='stable')),'return to audio');
 }
 console.log('video cycles passed');
 await a.evaluate(()=>{
  window.ShnoAndroidCall={onCallState(){},setSpeaker(){},startScreenShare(){
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');
   window.fakeScreen=setInterval(()=>{ctx.fillStyle='#1968ba';ctx.fillRect(0,0,320,180);ctx.fillStyle='white';ctx.font='22px sans-serif';ctx.fillText('Shared screen '+Date.now()%10000,10,90);window.ShnoScreenShare.onNativeFrame(canvas.toDataURL('image/jpeg').split(',')[1],320,180);},125);
  },stopScreenShare(){clearInterval(window.fakeScreen);}};
 });
 await a.locator('[data-call-share]').click();
 await until(()=>b.locator('[data-remote-video]').evaluate(v=>v.videoWidth===320),'shared screen RTP');
 await a.screenshot({path:path.join(artifacts,'call-video-preview.png')});
 await a.locator('[data-call-share]').click();
 await until(()=>a.evaluate(()=>window.shnoGetCallMediaType()==='audio'),'stop sharing returns to audio');

 await a.locator('[data-call-add]').click();
 await a.getByRole('button',{name:'Carol',exact:true}).click();
 await a.waitForURL('**/call-groups.html?**');await b.waitForURL('**/call-groups.html?**');
 const groupUrl=new URL(a.url());
 await c.goto(base+'/call-groups.html?group='+groupUrl.searchParams.get('group'));
 await c.locator('#group-accept').click();
 for(const page of [a,b,c])await until(()=>page.evaluate(()=>window.testPeers.length===2&&window.testPeers.every(p=>p.connectionState==='connected')),'three-way mesh');
 await a.locator('#group-send').evaluate(form=>{form.querySelector('input').value='رسالة المجموعة';form.requestSubmit()});
 await b.locator('#group-messages .group-msg').filter({hasText:'رسالة المجموعة'}).waitFor();
 await a.locator('#group-video').click();
 for(const page of [b,c])await until(()=>page.locator('#group-tiles video').evaluateAll(v=>v.some(x=>!x.muted&&x.videoWidth>0)),'group remote video');
 await a.locator('#group-video').click();
 await a.locator('#group-end').click();
 for(const page of [a,b,c])await page.locator('#group-stage').waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);
});
