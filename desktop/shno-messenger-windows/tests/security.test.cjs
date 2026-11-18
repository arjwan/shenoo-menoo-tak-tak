'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {HOME,trusted,external,isAllowedMedia}=require('../src/security.cjs');
test('desktop opens only the first-party HTTPS origin for authenticated conversations',()=>{
 assert.equal(HOME,'https://shinomino.com/messages.html');
 for(const url of ['https://shinomino.com/messages.html','https://shinomino.com/call-history.html','https://shinomino.com:443/messages.html'])
  assert.equal(trusted(url),true,url);
 for(const url of ['http://shinomino.com/messages.html','https://evil.com/','https://shinomino.com.evil.com/','file:///etc/passwd','javascript:alert(1)','https://user:secret@shinomino.com/','https://shinomino.com:444/messages.html'])
  assert.equal(trusted(url),false,url);
});
test('external navigation cannot execute javascript or open non-web protocols',()=>{
 assert.equal(external('https://example.org/'),true);
 for(const url of ['javascript:alert(1)','file:///c:/windows','tel:123','http://example.org/'])
  assert.equal(external(url),false,url);
});
test('desktop permissions are restricted to calling and notifications',()=>{
 for(const name of ['media','notifications','display-capture'])assert.equal(isAllowedMedia(name),true);
 for(const name of ['geolocation','midi','serial','usb','clipboard-read'])assert.equal(isAllowedMedia(name),false);
});
