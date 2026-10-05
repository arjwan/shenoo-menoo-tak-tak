const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/entry-session.js'), 'utf8');
function storage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
async function run({ token, sessionToken, response, failure, timeout = false } = {}) {
  const localStorage = storage(token ? { token, user: 'old' } : {});
  const sessionStorage = storage(sessionToken ? { token: sessionToken, user: 'old' } : {});
  const button = { disabled: false };
  const message = {};
  const redirects = [], requests = [];
  let fireTimeout, cleared = false;
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (timeout) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout'))));
    if (failure) throw new Error('network');
    return response;
  };
  vm.runInNewContext(source, {
    localStorage, sessionStorage, AbortController, fetch,
    setTimeout: fn => { fireTimeout = fn; return 1; },
    clearTimeout: () => { cleared = true; },
    document: { querySelector: () => button, getElementById: () => message },
    window: { location: { replace: url => redirects.push(url) } }
  });
  if (timeout) fireTimeout();
  await new Promise(resolve => setImmediate(resolve));
  return { localStorage, sessionStorage, button, message, redirects, requests, cleared };
}
test('first install shows the login form without opening the feed or making an authenticated request', async () => {
  const r = await run();
  assert.equal(r.requests.length, 0);
  assert.deepEqual(r.redirects, []);
  assert.equal(r.button.disabled, false);
});
test('only a session accepted by Oracle opens the feed', async () => {
  const r = await run({ token: 'saved', response: { ok: true, status: 200, json: async () => ({ ok: true, user: { id: 'u1' } }) } });
  assert.equal(r.requests[0].url, 'https://shino-mino-tak-tak.duckdns.org/api/users/me');
  assert.equal(r.requests[0].options.headers.Authorization, 'Bearer saved');
  assert.deepEqual(r.redirects, ['https://shino-mino-tak-tak.duckdns.org/taktak.html']);
  assert.equal(JSON.parse(r.localStorage.getItem('user')).id, 'u1');
  assert.equal(r.cleared, true);
});
test('an expired or revoked session is removed from both stores and stays at login', async () => {
  const r = await run({ token: 'bad', sessionToken: 'also-bad', response: { ok: false, status: 401 } });
  assert.deepEqual(r.redirects, []);
  for (const store of [r.localStorage, r.sessionStorage]) {
    assert.equal(store.getItem('token'), null);
    assert.equal(store.getItem('user'), null);
  }
  assert.equal(r.button.disabled, false);
  assert.match(r.message.textContent, /انتهت/);
});
test('a server error never grants entry and does not erase a potentially valid session', async () => {
  const r = await run({ token: 'saved', response: { ok: false, status: 503, json: async () => ({}) } });
  assert.deepEqual(r.redirects, []);
  assert.equal(r.localStorage.getItem('token'), 'saved');
  assert.equal(r.button.disabled, false);
});
test('a network failure leaves a usable login form and a visible explanation', async () => {
  const r = await run({ token: 'saved', failure: true });
  assert.deepEqual(r.redirects, []);
  assert.equal(r.button.disabled, false);
  assert.match(r.message.textContent, /تعذر الاتصال/);
});
test('a stalled server request is aborted and releases the login form', async () => {
  const r = await run({ token: 'saved', timeout: true });
  assert.equal(r.requests[0].options.signal.aborted, true);
  assert.deepEqual(r.redirects, []);
  assert.equal(r.button.disabled, false);
  assert.equal(r.cleared, true);
});
test('an accepted session without a user cannot open the feed', async () => {
  const r = await run({ token: 'saved', response: { ok: true, status: 200, json: async () => ({ ok: true }) } });
  assert.deepEqual(r.redirects, []);
  assert.equal(r.button.disabled, false);
});
