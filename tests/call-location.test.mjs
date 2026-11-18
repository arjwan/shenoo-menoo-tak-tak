import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function install(){
 let requests=0;
 const win={};
 const navigator={geolocation:{getCurrentPosition(success){requests++;success({coords:{latitude:36.86,longitude:42.99,accuracy:12}});}}};
 win.ShnoAndroidCall={reverseLocation(lat,lon,id){
   assert.equal(lat,36.86);assert.equal(lon,42.99);
   win.ShnoCallLocation.onReverseLocation(id,'دهوك','دهوك');
 }};
 const context={window:win,navigator,setTimeout,clearTimeout,Map,Number,Error};
 vm.runInNewContext(fs.readFileSync(new URL('../call-location.js',import.meta.url),'utf8'),context);
 return {api:win.ShnoCallLocation,requests:()=>requests};
}
test('GPS never requests position on module load or call initialization',()=>{
 const {api,requests}=install();
 assert.equal(requests(),0);
 api.reset('call-id');
 assert.equal(requests(),0);
});
test('coarse city sharing sends administrative labels, not coordinates',async()=>{
 const {api,requests}=install();api.reset('call-id');
 const info=await api.city('call-id');
 assert.deepEqual(Object.keys(info).sort(),['city','kind','province']);
 assert.equal(info.city,'دهوك');assert.equal(info.province,'دهوك');
 assert.equal(requests(),1);
});
test('precise sharing is scoped to the call and never starts after it ends',async()=>{
 const {api,requests}=install();api.reset('call-id');
 const info=await api.precise('call-id');
 assert.equal(info.kind,'precise');assert.equal(info.latitude,36.86);
 assert.equal(requests(),1);
 api.reset('');
 await assert.rejects(api.precise('call-id'));
 assert.equal(requests(),1);
});

test('call UI requests consent only through modal and removes GPS toolbar',()=>{
 const html=fs.readFileSync(new URL('../messages.html',import.meta.url),'utf8');
 const script=fs.readFileSync(new URL('../private-messages.js',import.meta.url),'utf8');
 const settings=fs.readFileSync(new URL('../android/shno-mano-call/app/src/main/java/com/shnomano/call/SettingsStore.kt',import.meta.url),'utf8');
 assert.match(html,/data-call-location-consent/);
 assert.match(html,/data-call-location-allow/);
 assert.match(html,/data-call-location-deny/);
 assert.doesNotMatch(html,/data-call-location-city/);
 assert.doesNotMatch(html,/data-call-location-precise/);
 assert.match(script,/locationPromptedFor===call.callId/);
 assert.match(script,/locationDialog.hidden=false/);
 assert.match(script,/getLocationSharingMode/);
 assert.match(settings,/location_sharing_mode", "none"/);
});
