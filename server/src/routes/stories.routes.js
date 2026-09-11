const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const Story = require('../models/Story');
const { normalizeVisibility, friendIds, followingIds, createPublishNotifications } = require('../lib/social-audience');
const router = express.Router();

const uploadDir = path.resolve(__dirname, '../../../uploads/stories');
fs.mkdirSync(uploadDir, { recursive: true });
const allowed = new Map([
  ['image/jpeg','.jpg'],['image/png','.png'],['image/webp','.webp'],['image/gif','.gif'],
  ['video/mp4','.mp4'],['video/x-m4v','.m4v'],['video/webm','.webm'],['video/quicktime','.mov'],['video/ogg','.ogv'],
  ['video/3gpp','.3gp'],['video/3gpp2','.3g2'],['video/x-matroska','.mkv'],['video/x-msvideo','.avi'],
  ['audio/mpeg','.mp3'],['audio/mp3','.mp3'],['audio/mp4','.m4a'],['audio/x-m4a','.m4a'],['audio/wav','.wav'],['audio/x-wav','.wav']
]);
const storage = multer.diskStorage({ destination:(_r,_f,cb)=>cb(null,uploadDir), filename:(_r,f,cb)=>cb(null,`${Date.now()}-${Math.random().toString(36).slice(2)}${allowed.get(f.mimetype)||''}`) });
const upload = multer({ storage, limits:{fileSize:100*1024*1024,files:2}, fileFilter:(_r,f,cb)=>allowed.has(f.mimetype)?cb(null,true):cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE',f.fieldname)) });
router.use(requireAuth);
function authorView(u){return u?{id:u._id,fullName:u.displayName||u.fullName,username:u.username,avatarUrl:u.profile?.avatarUrl||''}:null;}
function storyView(s){return {id:s._id,author:authorView(s.author),text:s.text,media:s.media||[],overlays:s.overlays||[],music:s.music||{},visibility:s.visibility,createdAt:s.createdAt,expiresAt:s.expiresAt};}
function parseOverlays(raw){try{const a=JSON.parse(raw||'[]');if(!Array.isArray(a))return[];return a.slice(0,20).filter(o=>['text','emoji'].includes(o.kind)&&String(o.value||'').trim()).map(o=>({kind:o.kind,value:String(o.value).trim().slice(0,300),x:Math.min(100,Math.max(0,Number(o.x)||50)),y:Math.min(100,Math.max(0,Number(o.y)||50)),size:Math.min(96,Math.max(12,Number(o.size)||32))}));}catch{return[];}}
function removeFile(url){if(url&&url.startsWith('/uploads/stories/'))fs.unlink(path.join(uploadDir,path.basename(url)),()=>{});}
router.get('/',async(req,res)=>{try{const [friends,following]=await Promise.all([friendIds(req.user._id),followingIds(req.user._id)]);const combined=[...new Map([...friends,...following].map(id=>[String(id),id])).values()];const stories=await Story.find({active:true,expiresAt:{$gt:new Date()},$or:[{visibility:'everyone'},{author:req.user._id},{visibility:'friends',author:{$in:friends}},{visibility:'followers',author:{$in:following}},{visibility:'friends_followers',author:{$in:combined}}]}).populate('author','fullName displayName username profile').sort({createdAt:-1}).limit(50);res.json({ok:true,stories:stories.map(storyView)});}catch(e){res.status(500).json({ok:false,message:e.message});}});
router.get('/me',async(req,res)=>{try{const stories=await Story.find({author:req.user._id,active:true,expiresAt:{$gt:new Date()}}).populate('author','fullName displayName username profile').sort({createdAt:-1});res.json({ok:true,stories:stories.map(storyView)});}catch(e){res.status(500).json({ok:false,message:e.message});}});
router.post('/',upload.fields([{name:'media',maxCount:1},{name:'music',maxCount:1}]),async(req,res)=>{try{const text=String(req.body.text||'').trim().slice(0,1000),overlays=parseOverlays(req.body.overlays),visibility=normalizeVisibility(req.body.visibility);const mediaFile=req.files?.media?.[0],musicFile=req.files?.music?.[0];if(mediaFile&&mediaFile.mimetype.startsWith('audio/')){removeFile(`/uploads/stories/${mediaFile.filename}`);return res.status(400).json({ok:false,message:'الوسائط الرئيسية يجب أن تكون صورة أو فيديو'});}if(musicFile&&!musicFile.mimetype.startsWith('audio/')){removeFile(`/uploads/stories/${musicFile.filename}`);return res.status(400).json({ok:false,message:'ملف الموسيقى غير صالح'});}if(!text&&!mediaFile&&!overlays.length)return res.status(400).json({ok:false,message:'أضف نصاً أو صورة أو فيديو أو إيموجي'});const media=mediaFile?[{url:`/uploads/stories/${mediaFile.filename}`,type:mediaFile.mimetype.startsWith('video/')?'video':'image',mimeType:mediaFile.mimetype,size:mediaFile.size}]:[];const music=musicFile?{url:`/uploads/stories/${musicFile.filename}`,mimeType:musicFile.mimetype,size:musicFile.size,name:String(req.body.musicName||musicFile.originalname||'موسيقى').slice(0,180)}:{};const story=await Story.create({author:req.user._id,text,media,overlays,music,visibility,expiresAt:new Date(Date.now()+24*60*60*1000)});await story.populate('author','fullName displayName username profile');await createPublishNotifications({authorId:req.user._id,type:'story',targetId:story._id,visibility,text:`${req.user.displayName||req.user.fullName||'صديقك'} نشر قصة جديدة`}).catch(()=>{});res.status(201).json({ok:true,story:storyView(story)});}catch(e){for(const group of Object.values(req.files||{}))for(const f of group||[])removeFile(`/uploads/stories/${f.filename}`);res.status(500).json({ok:false,message:e.message});}});
router.delete('/:id',async(req,res)=>{try{const story=await Story.findOne({_id:req.params.id,author:req.user._id});if(!story)return res.status(404).json({ok:false,message:'القصة غير موجودة'});for(const item of story.media||[])removeFile(item.url);removeFile(story.music?.url);await Story.deleteOne({_id:story._id});res.json({ok:true,message:'تم حذف القصة'});}catch(e){res.status(500).json({ok:false,message:e.message});}});
module.exports=router;
