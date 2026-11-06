import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const pages=["signup.html","taktak.html","services.html","calls.html","ads.html","messages.html","profile.html","reels.html","stories.html","notifications.html","friends.html","groups.html","settings.html","mall.html","stores.html","store.html","store-create.html","store-dashboard.html","create-ad.html","my-service-requests.html","transport.html","tv.html","live-create.html","support.html","privacy.html","phone-privacy.html","security-password.html","pending.html","consultations.html","community-guidelines.html","download.html","challenges.html","game-room.html","group-room.html","invite-friends.html","friend-qr.html","smart-friend-chat.html","smart-friend.html","islamic.html","taal-nsolf.html","umm-abbas.html","developer-setup.html","developer/index.html"];
const school=["school.html","school-admin.html","school-reader.html","school-curriculum.html","school-live.html","school-virtual-classroom.html"];
test('shared white-purple theme is applied to each main platform page exactly once',async()=>{
 for(const path of pages){
  const content=await read(path);
  const doc=content.match(/<html\b[^>]*>/i)?.[0]||'';
  assert.equal((doc.match(/\bclass=/g)||[]).length,1,'single class attribute '+path);
  assert.match(doc,/\bshinomino-ui\b/,'opted in '+path);
  assert.equal((content.match(/shinomino-shared-visual\.css\?v=20261106-1/g)||[]).length,1,'one shared stylesheet '+path);
  assert.match(content,/<\/head>/i,'valid head '+path);
 }
});
test('Sumer School pages are untouched and cannot import shared style',async()=>{
 for(const path of school)assert.doesNotMatch(await read(path),/shinomino-shared-visual\.css|shinomino-ui/,'school untouched '+path);
 const schoolHome=await read('school/index.html');assert.doesNotMatch(schoolHome,/shinomino-shared-visual\.css/);
});
test('auth, media and social logic remain in place on visually themed screens',async()=>{
 const signin=await read('signin.html');assert.match(signin,/\/api\/auth\/session/);
 const signup=await read('signup.html');assert.match(signup,/signupForm/);assert.match(signup,/shinomino-signup/);
 const feed=await read('taktak.html');assert.match(feed,/home-colors-scope/);
 const reels=await read('reels.html');assert.match(reels,/reels/);
 const stories=await read('stories.html');assert.match(stories,/stories/);
 const dev=await read('developer/index.html');assert.match(dev,/\/developer\/app\.css/);
});
test('CSS respects explicit dark mode and accessible controls',async()=>{
 const css=await read('shinomino-shared-visual.css');
 assert.match(css,/not\(\[data-theme="dark"\]\)/);
 assert.match(css,/focus-visible/);assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/shinomino-signup/);
 assert.doesNotMatch(css,/\/school\/|\.sumer-|\.school-/);
});
test('Pages distribution contains shared stylesheet and upgraded pages',async()=>{
 execFileSync('bash',['scripts/build-cloudflare-pages.sh'],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:45000});
 const css=await read('dist/shinomino-shared-visual.css');assert.match(css,/\.shinomino-ui/);
 for(const path of ['signup.html','taktak.html','calls.html','services.html','developer/index.html'])assert.match(await read('dist/'+path),/shinomino-shared-visual\.css/);
});
