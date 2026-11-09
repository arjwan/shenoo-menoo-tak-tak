const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const java=fs.readFileSync(path.join(__dirname,'../app/src/main/java/com/shinomeno/taktak/MainActivity.java'),'utf8');
test('Android exposes real ringing to the WebView caller',()=>{
 assert.match(java,/public void startCallTone\(String mode\)/);
 assert.match(java,/ToneGenerator\.TONE_SUP_RINGTONE/);
 assert.match(java,/AudioManager\.STREAM_MUSIC/);
 assert.match(java,/public void stopCallTone\(\)/);
 assert.match(java,/stopCallToneNative\(\)/);
});
test('incoming call retains system ringtone and stops when dismissed',()=>{
 assert.match(java,/public void showIncomingCallAlert\(/);
 assert.match(java,/incomingRingtone\.play\(\)/);
 assert.match(java,/stopIncomingCallAlertNative\(\)/);
});
