'use strict';
// Private cPanel maintenance command. No HTTP endpoint and no password output.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
async function resetDeveloper(db, password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw Error('NEW_PASSWORD_MUST_BE_12_TO_128_CHARACTERS');
  const filter = {_id:new mongoose.Types.ObjectId('6a9dade84bed9554281fffbf'),username:'shinomino_app',role:'developer',status:'active'};
  const before = await db.collection('users').findOne(filter,{projection:{passwordHash:1}});
  if (!before) throw Error('ACTIVE_DEVELOPER_NOT_FOUND');
  const passwordHash = await bcrypt.hash(password,12);
  const result = await db.collection('users').updateOne({...filter,passwordHash:before.passwordHash},{$set:{passwordHash,updatedAt:new Date()},$inc:{credentialVersion:1}});
  if(result.modifiedCount!==1) throw Error('ACCOUNT_CHANGED_RETRY_REQUIRED');
  // MFA documents and the separate legacy password field are never changed.
  return {ok:true,username:'shinomino_app',mfaPreserved:true,oldSessionsRevoked:true};
}
if(require.main===module){
 const password=process.env.DEVELOPER_RESET_PASSWORD;
 const uri=process.env.MONGODB_URI;
 if(!uri||new URL(uri).username!=='shinomino_aux_service')throw Error('SCOPED_SERVICE_ACCOUNT_REQUIRED');
 mongoose.connect(uri,{dbName:'shino_mino_tak_tak',autoIndex:false,serverSelectionTimeoutMS:8000})
 .then(()=>resetDeveloper(mongoose.connection.db,password))
 .then(result=>console.log(JSON.stringify(result)))
 .catch(error=>{const known=['NEW_PASSWORD_MUST_BE_12_TO_128_CHARACTERS','ACTIVE_DEVELOPER_NOT_FOUND','ACCOUNT_CHANGED_RETRY_REQUIRED'];const reason=known.includes(error.message)?error.message:(error.code||error.name);console.error('Developer recovery failed:',reason);process.exitCode=1;})
 .finally(()=>mongoose.disconnect());
}
module.exports={resetDeveloper};
