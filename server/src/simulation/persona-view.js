'use strict';
module.exports=function personaView(user,viewer){
 if(!user)return {id:'',fullName:'حساب محذوف',username:'',avatarUrl:''};
 const view={id:user._id,fullName:user.displayName||user.fullName,username:user.username,avatarUrl:user.profile?.avatarUrl||''};
 if(['developer','admin'].includes(viewer?.role))Object.assign(view,{digitalPersona:user.isSynthetic===true,digitalPersonaLabel:user.isSynthetic===true?'حساب اختبار':'',syntheticBatch:user.syntheticBatch||''});
 return view;
};
