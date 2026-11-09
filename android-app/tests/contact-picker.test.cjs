const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../app/src/main/java/com/shinomeno/taktak/MainActivity.java'),'utf8');
test('system pick is user-initiated and limited to official calls page',()=>{
 assert.match(src,/public void pickPhoneContact\(\)/);
 assert.match(src,/webView\.getUrl\(\)\.startsWith\(SITE_ORIGIN \+ "\/calls\.html"\)/);
 assert.match(src,/Intent\.ACTION_PICK/);
 assert.match(src,/ContactsContract\.CommonDataKinds\.Phone\.CONTENT_URI/);
});
test('returns only selected phone via shnomano:contacts event',()=>{
 assert.match(src,/if \(requestCode == CONTACT_PICKER\)/);
 assert.match(src,/ContactsContract\.CommonDataKinds\.Phone\.NUMBER/);
 assert.match(src,/CustomEvent\('shnomano:contacts'/);
 assert.doesNotMatch(src,/READ_CONTACTS/);
});
