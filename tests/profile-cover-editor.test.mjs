import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {handleProfile} from '../cloudflare/profile-api.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const origin='https://shenoo-main-cloudflare.pages.dev';
const me={id:'11111111-1111-4111-8111-111111111111'};
function mock(){
 const data={bio:'نص محفوظ',coverKey:'profiles/old-cover.jpg',coverPositionX:30,coverPositionY:50,coverZoom:100};
 return {data,env:{DB:{prepare(sql){return{
  bind(...args){this.args=args;return this},
  async first(){if(sql.includes('SELECT profile_json'))return {profile_json:JSON.stringify(data)};return null},
  async run(){if(sql.includes('INSERT INTO user_profiles')){Object.assign(data,JSON.parse(this.args[1]));}return {meta:{changes:1}}}
 }}},MEDIA:{}}};
}
function request(body){return new Request(origin+'/api/users/me/profile',{method:'PATCH',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
test('cover frame crop and zoom is stored numerically without replacing existing R2 image',async()=>{
 const {data,env}=mock();
 const r=await handleProfile(request({coverPositionX:0,coverPositionY:100,coverZoom:175}),env,me);
 assert.equal(r.status,200);assert.equal(data.coverPositionX,0);assert.equal(data.coverPositionY,100);
 assert.equal(data.coverZoom,175);assert.equal(data.coverKey,'profiles/old-cover.jpg');
 assert.equal(data.bio,'نص محفوظ');
});
test('cover crop rejects invalid scale and coordinates without mutating profile',async()=>{
 const {data,env}=mock();
 for(const body of [{coverZoom:99},{coverZoom:251},{coverPositionX:-1},{coverPositionY:101},{coverZoom:'175'},{coverPositionX:null},{coverPositionX:1.5}]){
  const r=await handleProfile(request(body),env,me);
  assert.equal(r.status,400,JSON.stringify(body));
  assert.equal(data.coverPositionX,30);assert.equal(data.coverZoom,100);
 }
});
test('cover editor has touch/mouse dragging, arrow-key access, zoom and reset',async()=>{
 const [page,editor,profile,css]=await Promise.all([read('profile.html'),read('profile-cover-editor.js'),read('profile.js'),read('profile-cover-editor.css')]);
 for(const item of ['data-cover-crop','data-cover-zoom','data-cover-zoom-in','data-cover-zoom-out','data-cover-reset','data-cover-preview','data-cover-placeholder'])assert.ok(page.includes(item),'missing '+item);
 assert.ok(page.indexOf('profile-cover-editor.js')<page.indexOf('profile.js'), 'Editor must initialize before profile');
 for(const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','ArrowRight','ArrowLeft','ArrowUp','ArrowDown','setPointerCapture','getBoundingClientRect','objectPosition','transformOrigin'])assert.ok(editor.includes(name),'missing '+name);
 assert.match(editor,/coverZoom.*??100/);
 assert.match(editor,/state\.zoom=clamp/);
 assert.match(profile,/ProfileCoverEditor\?\.open\(currentUser\|\|\{\}\)/);
 assert.match(profile,/ProfileCoverEditor\?\.getState\(\)/);
 assert.match(profile,/ProfileCoverEditor\?\.setFile/);
 assert.match(profile,/u\.coverPositionX\?\?50/);
 assert.match(profile,/u\.coverZoom\?\?100/);
 assert.match(css,/touch-action:none/);
 assert.match(css,/@media\(max-width:740px\)/);
});
test('Cloudflare Pages includes cover editor assets without changing Sumer School',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 for(const path of ['dist/profile.html','dist/profile.js','dist/profile-cover-editor.js','dist/profile-cover-editor.css'])assert.ok((await read(path)).length>300);
 assert.doesNotMatch(await read('dist/school/index.html'),/profile-cover-editor/);
});
