import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const base = 'https://shenoo-cloudflare-clean.arjwan307.workers.dev';
const username = 'cfsmoke_' + randomBytes(6).toString('hex');
const password = randomBytes(24).toString('hex');
async function call(path, options) {
  const response = await fetch(base + path, options);
  const data = await response.json();
  if (!response.ok) throw Error(path + ': HTTP ' + response.status + ' ' + JSON.stringify(data));
  return data;
}
const signup=await call('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,fullName:'Cloudflare Smoke Test',email:username+'@example.invalid',password,confirmPassword:password})});
assert.equal(signup.ok,true);
const signin=await call('/api/auth/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:username,password})});
assert.equal(signin.ok,true);
assert.ok(signin.token);
const headers={Authorization:'Bearer '+signin.token};
const me=await call('/api/users/me',{headers});
assert.equal(me.user.username,username);
const form=new FormData();
const marker='clean-stage-'+randomBytes(8).toString('hex');
form.set('text',marker);
form.set('visibility','everyone');
const posted=await call('/api/posts',{method:'POST',headers,body:form});
assert.equal(posted.ok,true);
const feed=await call('/api/posts',{headers});
assert.ok(feed.posts.some(x=>x.id===posted.post.id&&x.text===marker));
console.log('PASS: signup, signin, authenticated profile, text post, feed');
console.log('Temporary test account for cleanup: '+username);
