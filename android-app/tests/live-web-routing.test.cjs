const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../app/src/main/java/com/shinomeno/taktak/MainActivity.java'), 'utf8');
const manifest = fs.readFileSync(path.join(__dirname,'../app/src/main/AndroidManifest.xml'), 'utf8');

test('loads real website sign-in instead of stale bundled HTML', () => {
  assert.match(source, /webView\.loadUrl\(SITE_ORIGIN \+ "\/signin\.html"\)/);
  assert.doesNotMatch(source, /loadAuthPage\("signin\.html"\);/);
});
test('does not intercept server sign-in, sign-up or community navigation', () => {
  const start = source.indexOf('public boolean shouldOverrideUrlLoading');
  const end = source.indexOf('@Override',start+12);
  assert.ok(start>=0 && end>start);
  const handler = source.slice(start,end);
  assert.match(handler,/return false;/);
  assert.doesNotMatch(handler,/loadAuthPage\(/);
});
test('retains same-origin WebView session cookies and existing Android bridges', () => {
  assert.match(source, /setAcceptCookie\(true\)/);
  assert.match(source, /setJavaScriptEnabled\(true\)/);
  assert.match(source, /setDomStorageEnabled\(true\)/);
  assert.match(source, /addJavascriptInterface\(new NativeBridge\(\), "ShnoManoNative"\)/);
  assert.match(manifest,/android:name="android.permission.CAMERA"/);
  assert.match(manifest,/android:name="android.permission.RECORD_AUDIO"/);
});
test('uses the official production hostname only', () => {
  assert.match(source, /SITE_ORIGIN = "https:\/\/shinomino\.com"/);
});
