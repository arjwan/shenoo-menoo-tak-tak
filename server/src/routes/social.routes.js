const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');

const router = express.Router();
router.use(requireAuth);

router.post('/follow/:id', async (req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ok:false,message:'مستخدم غير صالح'});
    if(String(req.params.id)===String(req.user._id)) return res.status(400).json({ok:false,message:'لا يمكنك متابعة نفسك'});
    const target = await User.findOne({_id:req.params.id,status:'active'}).select('_id');
    if(!target) return res.status(404).json({ok:false,message:'المستخدم غير موجود'});
    await Follow.updateOne({follower:req.user._id,following:target._id},{$setOnInsert:{follower:req.user._id,following:target._id}},{upsert:true});
    const followersCount = await Follow.countDocuments({following:target._id});
    res.json({ok:true,following:true,followersCount});
  }catch(e){res.status(500).json({ok:false,message:e.message});}
});

router.delete('/follow/:id', async (req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ok:false,message:'مستخدم غير صالح'});
    await Follow.deleteOne({follower:req.user._id,following:req.params.id});
    const followersCount = await Follow.countDocuments({following:req.params.id});
    res.json({ok:true,following:false,followersCount});
  }catch(e){res.status(500).json({ok:false,message:e.message});}
});

router.get('/follow-state/:id', async (req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ok:false,message:'مستخدم غير صالح'});
    const [following,followersCount,followingCount] = await Promise.all([
      Follow.exists({follower:req.user._id,following:req.params.id}),
      Follow.countDocuments({following:req.params.id}),
      Follow.countDocuments({follower:req.params.id})
    ]);
    res.json({ok:true,following:!!following,followersCount,followingCount});
  }catch(e){res.status(500).json({ok:false,message:e.message});}
});

router.get('/notifications', async (req,res)=>{
  try{
    const limit=Math.min(50,Math.max(1,Number(req.query.limit)||30));
    const items=await Notification.find({recipient:req.user._id}).populate('actor','fullName displayName username profile').sort({createdAt:-1}).limit(limit);
    const unread=await Notification.countDocuments({recipient:req.user._id,readAt:null});
    res.json({ok:true,unread,notifications:items.map(n=>({id:n._id,type:n.type,text:n.text,href:n.href,targetId:n.targetId,createdAt:n.createdAt,readAt:n.readAt,actor:n.actor?{id:n.actor._id,fullName:n.actor.displayName||n.actor.fullName,username:n.actor.username,avatarUrl:n.actor.profile?.avatarUrl||''}:null}))});
  }catch(e){res.status(500).json({ok:false,message:e.message});}
});

router.patch('/notifications/:id/read', async (req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ok:false,message:'إشعار غير صالح'});
    const n=await Notification.findOneAndUpdate({_id:req.params.id,recipient:req.user._id},{$set:{readAt:new Date()}},{new:true});
    if(!n) return res.status(404).json({ok:false,message:'الإشعار غير موجود'});
    res.json({ok:true});
  }catch(e){res.status(500).json({ok:false,message:e.message});}
});

router.patch('/notifications/read-all', async (req,res)=>{
  try{await Notification.updateMany({recipient:req.user._id,readAt:null},{$set:{readAt:new Date()}});res.json({ok:true});}
  catch(e){res.status(500).json({ok:false,message:e.message});}
});

module.exports=router;
