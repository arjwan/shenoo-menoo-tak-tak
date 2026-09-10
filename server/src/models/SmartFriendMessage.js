const mongoose=require('mongoose');
const SmartFriendMessageSchema=new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  role:{type:String,enum:['user','assistant'],required:true},
  text:{type:String,trim:true,maxlength:12000,default:''},
  media:{
    url:{type:String,trim:true,default:''},
    type:{type:String,enum:['','audio','video'],default:''},
    mimeType:{type:String,trim:true,default:''},
    size:{type:Number,default:0}
  }
},{timestamps:true});
SmartFriendMessageSchema.index({user:1,createdAt:-1});
module.exports=mongoose.model('SmartFriendMessage',SmartFriendMessageSchema);
