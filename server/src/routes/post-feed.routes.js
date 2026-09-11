const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Post = require('../models/Post');
const { friendIds, followingIds } = require('../lib/social-audience');

const router = express.Router();
const OWN_HOME_WINDOW_MS = 2 * 60 * 60 * 1000;
router.use(requireAuth);

function userView(user) {
  return user
    ? { id:user._id, fullName:user.displayName||user.fullName, username:user.username, avatarUrl:user.profile?.avatarUrl||'' }
    : { id:'', fullName:'حساب محذوف', username:'', avatarUrl:'' };
}
function postView(post,user){
  const authorId=post.author?._id||post.author;
  const canManage=String(authorId)===String(user._id)||['admin','developer'].includes(user.role);
  return {id:post._id,author:userView(post.author),text:post.text,media:post.media,type:post.type,visibility:post.visibility,adStatus:post.adStatus,adTitle:post.adTitle||'',adContact:post.adContact||'',adCategory:post.adCategory||'',adReviewNote:post.adReviewNote||'',likesCount:post.likes.length,liked:post.likes.some(id=>String(id)===String(user._id)),commentsCount:post.commentsCount,createdAt:post.createdAt,updatedAt:post.updatedAt,canEdit:canManage,canDelete:canManage};
}
async function relationSets(userId){
  const [friends,following]=await Promise.all([friendIds(userId),followingIds(userId)]);
  return {friends,following,combined:[...new Map([...friends,...following].map(id=>[String(id),id])).values()]};
}
router.get('/',async(req,res)=>{
  try{
    const {friends,following,combined}=await relationSets(req.user._id);
    const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(30,Math.max(1,Number(req.query.limit)||15));
    const freshSince=new Date(Date.now()-OWN_HOME_WINDOW_MS);
    const query={active:true,$and:[
      {$or:[{type:'post'},{type:'ad',adStatus:'approved'}]},
      {$or:[
        {visibility:'everyone'},
        {author:req.user._id},
        {visibility:'friends',author:{$in:friends}},
        {visibility:'followers',author:{$in:following}},
        {visibility:'friends_followers',author:{$in:combined}}
      ]},
      {$or:[
        {author:{$ne:req.user._id}},
        {author:req.user._id,type:'post',createdAt:{$gte:freshSince}},
        {author:req.user._id,type:'ad',adStatus:'approved'}
      ]}
    ]};
    const posts=await Post.find(query).populate('author','fullName displayName username profile').sort({createdAt:-1}).skip((page-1)*limit).limit(limit);
    res.json({ok:true,posts:posts.map(p=>postView(p,req.user)),ownHomeWindowMinutes:OWN_HOME_WINDOW_MS/60000});
  }catch(e){res.status(500).json({ok:false,message:e.message});}
});
router.get('/user/:id',async(req,res)=>{
  try{
    if(req.params.id!=='me'&&!mongoose.isValidObjectId(req.params.id))return res.status(400).json({ok:false,message:'مستخدم غير صالح'});
    const targetId=req.params.id==='me'?req.user._id:req.params.id,self=String(targetId)===String(req.user._id);
    const {friends,following}=await relationSets(req.user._id);
    const isFriend=friends.some(id=>String(id)===String(targetId));
    const isFollowing=following.some(id=>String(id)===String(targetId));
    const allowed=self?{}:{$or:[{visibility:'everyone'},...(isFriend?[{visibility:'friends'},{visibility:'friends_followers'}]:[]),...(isFollowing?[{visibility:'followers'},{visibility:'friends_followers'}]:[])]};
    const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(30,Math.max(1,Number(req.query.limit)||20));
    const query={active:true,author:targetId,type:'post',...allowed};
    const [posts,total]=await Promise.all([Post.find(query).populate('author','fullName displayName username profile').sort({createdAt:-1}).skip((page-1)*limit).limit(limit),Post.countDocuments(query)]);
    res.json({ok:true,posts:posts.map(p=>postView(p,req.user)),total,page});
  }catch(e){res.status(500).json({ok:false,message:e.message});}
});
module.exports=router;
