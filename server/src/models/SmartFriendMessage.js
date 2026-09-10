const mongoose=require('mongoose');
const SmartFriendMessageSchema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},role:{type:String,enum:['user','assistant'],required:true},text:{type:String,required:true,trim:true,maxlength:12000}},{timestamps:true});
SmartFriendMessageSchema.index({user:1,createdAt:-1});
module.exports=mongoose.model('SmartFriendMessage',SmartFriendMessageSchema);