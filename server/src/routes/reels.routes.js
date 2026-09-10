const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const Reel = require('../models/Reel');
const { normalizeVisibility, friendIds, followingIds, createPublishNotifications } = require('../lib/social-audience');
const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../../uploads/reels');
fs.mkdirSync(uploadDir, { recursive: true });
const allowed = new Map([['video/mp4','.mp4'],['video/webm','.webm'],['video/quicktime','.mov']]);
const upload = multer({storage:multer.diskStorage({destination:(_req,_file,cb)=>cb(null,uploadDir),filename:(_req,file,cb)=>cb(null,`${Date.now()}-${Math.random().toString(36).slice(2)}${allowed.get(file.mimetype)||''}`)}),limits:{fileSize:100*1024*1024,files:1},fileFilter:(_req,file,cb)=>allowed.has(file.mimetype)?cb(null,true):cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE',file.fieldname))});
router.use(requireAuth);
function view(r){return {id:r._id,author:r.author?{id:r.author._id,fullName:r.author.displayName||r.author.fullName,username:r.author.username,avatarUrl:r.author.profile?.avatarUrl||''}:null,text:r.text,media:r.media,visibility:r.visibility,likes:r.likes?r.likes.length:0,createdAt:r.createdAt};}
router.get('/',async(req,res)=>{try{const [friends,following]=await Promise.all([friendIds(req.user._id),followingIds(req.user._id)]);const combined=[...new Map([...friends,...following].map(id=>[String(id),id])).values()];const reels=await Reel.find({active:true,$or:[{visibility:'everyone'},{author:req.user._id},{visibility:'friends',author:{$in:friends}},{visibility:'followers',author:{$in:following}},{visibility:'friends_followers',author:{$in:combined}}]}).populate('author','fullName displayName username profile').sort({createdAt:-1}).limit(30);res.json({ok:true,reels:reels.map(view)});}catch(e){res.status(500).json({ok:false,message:e.message});}});
router.post('/',upload.single('media'),async(req,res)=>{try{const text=String(req.body.text||'').trim();if(!text&&!req.file)return res.status(400).json({ok:false,message:'أضف نصاً أو فيديو'});const visibility=normalizeVisibility(req.body.visibility);const media=req.file?[{url:`/uploads/reels/${req.file.filename}`,type:'video',mimeType:req.file.mimetype,size:req.file.size}]:[];const reel=await Reel.create({author:req.user._id,text,media,visibility,likes:[]});await reel.populate('author','fullName displayName username profile');await createPublishNotifications({authorId:req.user._id,type:'reel',targetId:reel._id,visibility,text:`${req.user.displayName||req.user.fullName||'صديقك'} نشر ريل جديداً`}).catch(()=>{});res.status(201).json({ok:true,reel:view(reel)});}catch(e){res.status(500).json({ok:false,message:e.message});}});
router.post('/:id/like',async(req,res)=>{try{const reel=await Reel.findOne({_id:req.params.id,active:true});if(!reel)return res.status(404).json({ok:false,message:'الريل غير موجود'});const idx=reel.likes.findIndex(id=>String(id)===String(req.user._id));if(idx>=0)reel.likes.splice(idx,1);else reel.likes.push(req.user._id);await reel.save();res.json({ok:true,liked:idx<0,likesCount:reel.likes.length});}catch(e){res.status(500).json({ok:false,message:e.message});}});
module.exports=router;
