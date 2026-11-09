const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=file=>fs.readFileSync(path.join(__dirname,'../app/src/main/java/com/shinomeno/taktak/',file),'utf8');
test('native app exposes incoming call ringtone and notification bridge',()=>{
 const s=src('MainActivity.java');
 assert.match(s,/public void showIncomingCallAlert\(/);
 assert.match(s,/RingtoneManager\.getRingtone/);
 assert.match(s,/INCOMING_CALL_NOTIFICATION_ID/);
 assert.match(s,/public void stopIncomingCallAlert\(/);
 assert.match(s,/incoming_conversation/);
});
test('foreground service receives WebRTC signals via cookie-authenticated D1, not Socket.IO',()=>{
 const s=src('BackgroundRealtimeService.java'),p=src('CallSignalPoller.java');
 assert.match(s,/callPoller\.start\(\)/);
 assert.match(s,/KEY_ACTIVITY_VISIBLE/);
 assert.doesNotMatch(s,/^\s*connectSocket\(\);/m);
 assert.match(p,/__Host-shino_session=/);
 assert.match(p,/\/api\/call-signals/);
 assert.match(p,/call:invite/);
 assert.match(p,/call:reject/);
});
test('background call preference is not gated on removed bearer token',()=>{
 const s=src('MainActivity.java'),service=src('BackgroundRealtimeService.java');
 assert.doesNotMatch(s,/token == null \|\| token\.isEmpty\(\) \|\| !enabled/);
 assert.doesNotMatch(service,/token\(\)\.isEmpty\(\)/);
});
