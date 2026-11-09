import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('every signed-in page loads a global call watcher after session validation',()=>{
 const guard=read('auth-guard.js');
 assert.match(guard,/incoming-call-global\.js\?v=20261109-1/);
 assert.match(guard,/window\.shnoSessionReady=/);
 const watcher=read('incoming-call-global.js');
 assert.match(watcher,/Promise\.resolve\(global\.shnoSessionReady\|\|true\)/);
 assert.match(watcher,/\/api\/call-signals\?after=/);
});
test('call notification is available away from chat and has accept/reject controls',()=>{
 const code=read('incoming-call-global.js');
 assert.match(code,/مكالمة صوتية واردة/);
 assert.match(code,/مكالمة فيديو واردة/);
 assert.match(code,/location\.assign\(url\)/);
 assert.match(code,/call:reject/);
 assert.match(code,/startSound\(\)/);
 assert.match(code,/stopSound\(\)/);
});
test('message call window triggers ringing and clears sound when call finishes',()=>{
 const code=read('private-messages.js');
 assert.match(code,/window\.ShnoIncomingCalls\.incoming/);
 assert.match(code,/window\.ShnoIncomingCalls\.end/);
 assert.match(code,/socket\.on\("call:invite", receiveIncomingCall\)/);
});
test('notifications use native Android bridge when present',()=>{
 const code=read('incoming-call-global.js');
 assert.match(code,/ShnoManoNative\.showIncomingCallAlert/);
 assert.match(code,/ShnoManoNative\.stopIncomingCallAlert/);
});

test('desktop notification appears alongside existing call UI, including messages, and closes on end',()=>{
 const code=read('incoming-call-global.js');
 assert.match(code,/function showDesktopNotification\(/);
 assert.match(code,/if\(inMessages\)\{startSound\(\);showDesktopNotification\(\);return;\}/);
 assert.match(code,/document\.body\.appendChild\(bell\);startSound\(\);\s*showDesktopNotification\(\)/);
 assert.match(code,/desktopNotice\.close\(\)/);
 assert.doesNotMatch(code,/Notification\.permission==='granted'&&document\.hidden/);
});
