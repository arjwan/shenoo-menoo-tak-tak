import {test} from 'node:test';
import assert from 'node:assert/strict';
import {privateMediaType,savePrivateAttachment,signedPrivateMediaUrl,readPrivateMedia} from '../cloudflare/private-message-media.js';

const mp4=new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0,0,0,0,0]);
const webm=new Uint8Array([26,69,223,163,0,0,0,0,0,0,0,0]);
test('Phone AAC .m4a, MP4 video and browser WebM pass signature validation',()=>{
 assert.equal(privateMediaType('audio/mp4','voice.m4a',mp4).kind,'audio');
 assert.equal(privateMediaType('video/mp4','camera.mp4',mp4).kind,'video');
 assert.equal(privateMediaType('audio/webm;codecs=opus','voice.webm',webm).kind,'audio');
 assert.equal(privateMediaType('video/webm','video.webm',webm).kind,'video');
 assert.equal(privateMediaType('video/mp4','video.mp4',webm),null);
 assert.equal(privateMediaType('application/octet-stream','record.mp4',mp4),null);
 assert.equal(privateMediaType('audio/mp4','../../secret.sh',mp4),null);
});
test('Multipart voice and video are stored as private chat messages and playable with expiring signed range URLs',async()=>{
 let records=[],media=new Map();
 const env={
  AUTH_SECRET:'private-test-signing-secret-with-more-than-32-characters',
  MEDIA:{
   async put(key,body){media.set(key,body)},
   async delete(key){media.delete(key)},
   async head(key){return media.has(key)?{size:media.get(key).byteLength}:null},
   async get(key,opts){
    if(!media.has(key))return null;
    let bytes=media.get(key);
    if(opts?.range)bytes=bytes.slice(opts.range.offset,opts.range.offset+opts.range.length);
    return {body:bytes};
   }
  },
  DB:{
   batch:async cmds=>{records.push(cmds);return [{meta:{changes:1}},{meta:{changes:1}}]},
   prepare(query){return {bind(id){return {first:async()=>({r2_key:[...media.keys()][0],mime_type:'audio/mp4',file_size:20})}}}}
  }
 };
 const form=new FormData();form.append('attachment',new File([mp4],'voice.m4a',{type:'audio/mp4'}));form.append('text','صوت');
 const request=new Request('https://shinomino.com/api/conversations/00000000-0000-4000-8000-000000000000/messages',{method:'POST',body:form});
 const result=await savePrivateAttachment(request,env,{id:'user'},'00000000-0000-4000-8000-000000000000');
 assert.equal(result.status,201);
 const saved=await result.json();
 assert.equal(saved.message.type,'audio');
 assert.equal(saved.message.attachment.mimeType,'audio/mp4');
 assert.equal(records.length,1);
 assert.equal(media.size,1);
 const uri='https://shinomino.com'+saved.message.attachment.url;
 const fetched=await readPrivateMedia(new Request(uri,{headers:{Range:'bytes=0-7'}}),env,saved.message.id);
 assert.equal(fetched.status,206);
 assert.equal(fetched.headers.get('content-range'),'bytes 0-7/20');
 assert.deepEqual([...new Uint8Array(await fetched.arrayBuffer())],[...mp4.slice(0,8)]);
 const forged=new URL(uri);forged.searchParams.set('expires','9999999999');
 assert.equal((await readPrivateMedia(new Request(forged),env,saved.message.id)).status,403);
});
test('Bad multipart media is rejected without writing to R2',async()=>{
 let wrote=false;
 const env={MEDIA:{put:async()=>{wrote=true}}};
 const form=new FormData();form.append('attachment',new File([webm],'fake.mp4',{type:'video/mp4'}));
 const response=await savePrivateAttachment(new Request('https://shinomino.com/api/test',{method:'POST',body:form}),env,{id:'user'},'conversation');
 assert.equal(response.status,415);assert.equal(wrote,false);
});
