const mongoose=require('mongoose');
const credentialSchema=new mongoose.Schema({id:{type:String,required:true},publicKey:{type:String,required:true},counter:{type:Number,default:0},transports:[String],deviceType:String,backedUp:Boolean},{_id:false});
const challengeSchema=new mongoose.Schema({challengeId:String,approved:{type:Boolean,default:false},expiresAt:Date},{_id:false});
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true,index:true},pairedPhone:String,phoneSecretHash:String,phonePairedAt:Date,credentials:{type:[credentialSchema],default:[]},registrationChallenge:String,authenticationChallenge:String,phoneChallenges:{type:[challengeSchema],default:[]}},{timestamps:true});
module.exports=mongoose.model('DeveloperMfa',schema);
