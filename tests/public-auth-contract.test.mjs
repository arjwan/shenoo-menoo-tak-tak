import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async file => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('public sign-in names only identifiers supported by the D1 worker', async () => {
  const [page, worker] = await Promise.all([source('signin.html'), source('cloudflare/worker.js')]);
  assert.match(page, /اسم المستخدم أو البريد الإلكتروني/);
  assert.doesNotMatch(page, /رقم الهاتف أو اسم المستخدم/);
  assert.match(worker, /WHERE username=\? OR email=\?/);
});

test('signup browser validation matches worker minimum password and required email', async () => {
  const [page, worker] = await Promise.all([source('signup.html'), source('cloudflare/worker.js')]);
  assert.match(page, /if\(password\.length<10\)/);
  assert.match(page, /if\(!\/\^\[\^\\s@\]\+@/);
  assert.match(worker, /password\.length<10/);
  assert.match(worker, /!email\.match/);
});

test('public sign-in verifies its server-issued session before redirecting', async () => {
  const page = await source('signin.html');
  assert.match(page, /credentials: 'same-origin'/);
  assert.match(page, /\/api\/auth\/session/);
  assert.match(page, /session\.user\?\.id/);
});
