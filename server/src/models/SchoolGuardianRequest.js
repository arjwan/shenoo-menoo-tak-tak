'use strict';
const mongoose=require('mongoose');
const SchoolGuardianRequestSchema=new mongoose.Schema({
 guardian:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 student:{type:mongoose.Schema.Types.ObjectId,ref:'SchoolStudent',required:true,index:true},
 type:{type:String,enum:['GENERAL','MEETING','ACADEMIC_REVIEW','ABSENCE_EXCUSE','SUPPORT'],default:'GENERAL'},
 title:{type:String,required:true,trim:true,maxlength:180},message:{type:String,required:true,maxlength:3000},
 status:{type:String,enum:['OPEN','IN_REVIEW','RESOLVED','REJECTED'],default:'OPEN',index:true},
 response:{type:String,default:'',maxlength:3000},resolvedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null}
},{timestamps:true});
module.exports=mongoose.model('SchoolGuardianRequest',SchoolGuardianRequestSchema);
