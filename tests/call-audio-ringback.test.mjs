import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('caller gets real ringback on successful invite, stops on acceptance and termination',()=>{
 const s=read('private-messages.js');
 assert.match(s,/callStatus\("يرن…"\); if\(window\.ShnoCallAudio\)window\.ShnoCallAudio\.startRingback\(\)/);
 assert.match(s,/socket\.on\("call:accept"[\s\S]{0,220}ShnoCallAudio\.stop\(\)/);
 assert.match(s,/function endCall\([^)]*\) \{ if \(window\.ShnoCallAudio\) window\.ShnoCallAudio\.stop\(\)/);
});
test('incoming call rings on authenticated pages and stops on cancel',()=>{
 const s=read('incoming-call-global.js');
 assert.match(s,/ShnoCallAudio\.startIncoming\(\)/);
 assert.match(s,/ShnoCallAudio\.stop\(\)/);
 assert.match(s,/showIncomingCallAlert/);
});
test('audio engine is installed before incoming watcher, is user gesture unlocked',()=>{
 const guard=read('auth-guard.js'),audio=read('call-audio.js');
 assert.ok(guard.indexOf("sound.src='call-audio.js")<guard.indexOf("incoming.src='incoming-call-global.js"));
 assert.match(guard,/sound\.async=false/);
 assert.match(guard,/incoming\.async=false/);
 assert.match(audio,/pointerdown/);
 assert.match(audio,/startRingback/);
 assert.match(audio,/startIncoming/);
 assert.match(audio,/startTone/);
 assert.match(audio,/pagehide/);
});
