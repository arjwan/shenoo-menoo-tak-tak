const FriendRequest = require('../models/FriendRequest');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');

const VISIBILITIES = new Set(['everyone','friends','followers','friends_followers']);
function normalizeVisibility(value){ return VISIBILITIES.has(value) ? value : 'everyone'; }
async function friendIds(userId){
  const rows = await FriendRequest.find({ $or:[{sender:userId},{receiver:userId}], status:'accepted' }).select('sender receiver');
  return rows.map(r => String(r.sender) === String(userId) ? r.receiver : r.sender);
}
async function followerIds(userId){
  const rows = await Follow.find({ following:userId }).select('follower');
  return rows.map(r => r.follower);
}
async function followingIds(userId){
  const rows = await Follow.find({ follower:userId }).select('following');
  return rows.map(r => r.following);
}
async function allowedAudience(authorId, visibility){
  const v = normalizeVisibility(visibility);
  const [friends, followers] = await Promise.all([friendIds(authorId), followerIds(authorId)]);
  const friendSet = new Map(friends.map(id=>[String(id),id]));
  const followerSet = new Map(followers.map(id=>[String(id),id]));
  if(v === 'friends') return [...friendSet.values()];
  if(v === 'followers') return [...followerSet.values()];
  if(v === 'friends_followers') return [...new Map([...friendSet,...followerSet]).values()];
  return [...new Map([...friendSet,...followerSet]).values()];
}
async function createPublishNotifications({authorId,type,targetId,visibility,text}){
  const recipients = (await allowedAudience(authorId, visibility)).filter(id=>String(id)!==String(authorId));
  if(!recipients.length) return 0;
  const href = type === 'post' ? `taktak.html?post=${targetId}` : type === 'story' ? `taktak.html?story=${targetId}` : `taktak.html?reel=${targetId}`;
  const now = new Date();
  if(type === 'story'){
    const groupKey = `story:${authorId}`;
    const recentSince = new Date(Date.now()-30*60*1000);
    let count = 0;
    for(const recipient of recipients){
      const existing = await Notification.findOne({recipient, actor:authorId, type:'story', groupKey, createdAt:{$gte:recentSince}}).sort({createdAt:-1});
      if(existing){ existing.targetId=targetId; existing.href=href; existing.text=text; existing.readAt=null; existing.createdAt=now; await existing.save(); }
      else { await Notification.create({recipient,actor:authorId,type,targetId,href,text,groupKey}); }
      count++;
    }
    return count;
  }
  await Notification.insertMany(recipients.map(recipient=>({recipient,actor:authorId,type,targetId,href,text,groupKey:`${type}:${targetId}`})),{ordered:false}).catch(()=>{});
  return recipients.length;
}
module.exports = { normalizeVisibility, friendIds, followerIds, followingIds, allowedAudience, createPublishNotifications };
