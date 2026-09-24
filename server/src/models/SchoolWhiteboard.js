'use strict';
const mongoose=require('mongoose');
const SchoolWhiteboardSchema=new mongoose.Schema({
  owner:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  ownerType:{type:String,enum:['REAL_TEACHER','VIRTUAL_TEACHER'],default:'REAL_TEACHER'},
  title:{type:String,required:true,trim:true,maxlength:160},
  stage:{type:String,required:true,index:true},grade:{type:String,required:true,index:true},
  section:{type:String,default:'أ',index:true},subject:{type:String,required:true,index:true},
  lesson:{type:String,default:''},visibility:{type:String,enum:['PRIVATE','STUDENTS'],default:'PRIVATE'},
  strokes:{type:mongoose.Schema.Types.Mixed,default:[]},notes:{type:String,default:'',maxlength:12000},
  sharedWithVirtualTeacher:{type:Boolean,default:false},archived:{type:Boolean,default:false}
},{timestamps:true});
SchoolWhiteboardSchema.index({owner:1,stage:1,grade:1,section:1,subject:1});
module.exports=mongoose.model('SchoolWhiteboard',SchoolWhiteboardSchema);
