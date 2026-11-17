import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerCallPush,wakeCallDevices} from '../cloudflare/call-push.js';
const id='11111111-1111-4111-8111-111111111111';
const req=(body,extra={})=>new Request('https://shinomino.com/api/call-push/devices',{method:'POST',headers:{Cookie:'__Host-shino_session=test-session',...extra},body:JSON.stringify(body)});
test('Push registration is session bound, validates tokens and rejects cross-site requests',async()=>{
 const queries=[];const env={DB:{prepare(sql){return {bind(...args){queries.push({sql,args});return this},async first(){return {n:0}},async run(){return {}}}}}};
 assert.equal((await registerCallPush(req({installationId:id,token:'x'.repeat(40)},{Origin:'https://evil.example'}),env,{id:'user'})).status,403);
 assert.equal((await registerCallPush(req({installationId:id,token:'<bad>'}),env,{id:'user'})).status,400);
 const result=await registerCallPush(req({installationId:id,token:'x'.repeat(40)}),env,{id:'user'});
 assert.equal(result.status,200);assert.equal((await result.json()).pushConfigured,false);
 const entry=queries.find(x=>x.sql.startsWith('INSERT'));assert.equal(entry.args[1],'user');assert.match(entry.args[2],/^[A-Za-z0-9_-]{43}$/);assert.notEqual(entry.args[2],'test-session');
});
test('No provider configuration makes no delivery attempt',async()=>{assert.deepEqual(await wakeCallDevices({},'user',id,()=>{throw Error('must not fetch')}),{configured:false,sent:0})});
test('FCM wake-up uses high priority, short TTL and minimal data; revoked sessions excluded',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const der=await crypto.subtle.exportKey('pkcs8',keys.privateKey);
 const account={project_id:'unit-test-project',client_email:'unit@test.example',private_key:'-----BEGIN PRIVATE KEY-----\n'+Buffer.from(der).toString('base64')+'\n-----END PRIVATE KEY-----'};
 const env={SHNO_FCM_SERVICE_ACCOUNT:JSON.stringify(account),DB:{prepare(sql){assert.match(sql,/revoked_at IS NULL/);assert.match(sql,/a.user_id=d.user_id/);return {bind(){return this},async all(){return {results:[{installation_id:id,token:'device-token'}]}}}}}};
 const calls=[];const result=await wakeCallDevices(env,'recipient',id,async(url,opts)=>{calls.push({url,opts});return Response.json(url.includes('oauth2')?{access_token:'test-oauth-token',expires_in:3600}:{name:'accepted'})});
 assert.equal(result.sent,1);const msg=JSON.parse(calls[1].opts.body).message;
 assert.equal(msg.android.priority,'HIGH');assert.equal(msg.android.ttl,'30s');assert.deepEqual(Object.keys(msg.data).sort(),['callId','event','recipient']);assert.equal(msg.data.event,'call:wake');
});
