'use strict';
const { URL } = require('node:url');
const HOST='shinomino.com';
const HOME='https://shinomino.com/messages.html';
function trusted(raw) {
  try {
    const u=new URL(raw);
    return u.protocol==='https:' && u.hostname===HOST && (!u.port || u.port==='443') &&
      !u.username && !u.password;
  } catch {return false;}
}
function external(raw){
  try{
    const u=new URL(raw);
    return u.protocol==='https:' && !u.username && !u.password;
  }catch{return false;}
}
function isAllowedMedia(permission){return ['media','mediaTypes','notifications','display-capture'].includes(permission);}
module.exports={HOME,trusted,external,isAllowedMedia};
