const mongoose=require('mongoose');
const SmartFriendSchema=new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  slot:{type:Number,min:1,max:10,default:1},
  name:{type:String,trim:true,maxlength:40,default:'صديقي'},
  gender:{type:String,enum:['male','female'],required:true},
  age:{type:Number,min:18,max:80,required:true},
  avatar:{type:String,default:'male-1'},
  personality:{type:String,enum:['friendly','calm','funny','serious','listener','educated'],default:'friendly'},
  interests:[{type:String,trim:true,maxlength:40}],
  dialect:{type:String,enum:['iraqi'],default:'iraqi'},
  conversationStyle:{type:String,enum:['casual','balanced','advice'],default:'balanced'}
},{timestamps:true});
SmartFriendSchema.index({user:1,slot:1},{unique:true});
module.exports=mongoose.model('SmartFriend',SmartFriendSchema);