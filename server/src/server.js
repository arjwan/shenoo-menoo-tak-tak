require('dotenv').config();

const express = require('express');
const multer = require('multer');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const GameRoom = require('./models/GameRoom');
const SmartFriend = require('./models/SmartFriend');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const developerRoutes = require('./routes/developer.routes');
const userRoutes = require('./routes/user.routes');
const friendsRoutes = require('./routes/friends.routes');
const socialRoutes = require('./routes/social.routes');
const conversationRoutes = require('./routes/conversations.routes');
const phoneContactsRoutes = require('./routes/phone-contacts.routes');
const gameRoomRoutes = require('./routes/game-rooms.routes');
const gameActionRoutes = require('./routes/game-actions.routes');
const postFeedRoutes = require('./routes/post-feed.routes');
const postRoutes = require('./routes/posts.routes');
const storyRoutes = require('./routes/stories.routes');
const reelRoutes = require('./routes/reels.routes');
const supportRoutes = require('./routes/support.routes');
const groupRoutes = require('./routes/groups.routes');
const islamicRoutes = require('./routes/islamic.routes');
const storesRoutes = require('./routes/stores.routes');
const consultationRoutes = require('./routes/consultations.routes');
const astrologyRoutes = require('./routes/astrology.routes');
const serviceApprovalsRoutes = require('./routes/service-approvals.routes');
const smartFriendRoutes = require('./routes/smart-friend.routes');
const smartFriendToolsRoutes = require('./routes/smart-friend-tools.routes');
const { attachSocket } = require('./socket');

const app = express();
const httpServer = http.createServer(app);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'shno-mano-tech-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/developer', developerRoutes);
app.use('/api/service-approvals', serviceApprovalsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendsRoutes.router);
app.use('/api/social', socialRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/phone-contacts', phoneContactsRoutes);
app.use('/api/game-rooms', gameRoomRoutes.router);
app.use('/api/game-actions', gameActionRoutes);
app.use('/api/posts', postFeedRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/islamic', islamicRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/astrology', astrologyRoutes);
app.use('/api/smart-friend/tools', smartFriendToolsRoutes);
app.use('/api/smart-friend', smartFriendRoutes);
app.use('/uploads', express.static(require('path').resolve(__dirname, '../../uploads')));
app.use((error, req, res, next) => { if (error instanceof multer.MulterError) return res.status(400).json({ ok:false, message:error.code==='LIMIT_FILE_SIZE'?'حجم الملف أكبر من الحد المسموح':'نوع أو عدد الملفات غير مسموح' }); if(error)return res.status(500).json({ok:false,message:error.message||'حدث خطأ في الخادم'}); next(); });
app.use((req,res)=>res.status(404).json({ok:false,message:'المسار غير موجود'}));
const port=Number(process.env.PORT||3000);
async function migrateSmartFriendIndexes(){
  try{
    const indexes=await SmartFriend.collection.indexes();
    const legacy=indexes.find(i=>i.unique&&i.key&&i.key.user===1&&!('slot' in i.key));
    if(legacy){
      await SmartFriend.collection.dropIndex(legacy.name);
      console.log('Removed legacy SmartFriend unique user index:',legacy.name);
    }
    await SmartFriend.collection.createIndex({user:1,slot:1},{unique:true,name:'user_1_slot_1'});
  }catch(error){
    console.error('SmartFriend index migration failed:',error.message);
  }
}
connectDB().then(async()=>{await migrateSmartFriendIndexes();const expireRooms=()=>GameRoom.updateMany({isActive:{$ne:false},expiresAt:{$ne:null,$lte:new Date()}},{$set:{isActive:false,'gameState.status':'finished','gameState.updatedAt':new Date()}}).catch(error=>console.error('Game room cleanup failed:',error.message));expireRooms();const cleanupTimer=setInterval(expireRooms,15*60*1000);cleanupTimer.unref();app.set('io',attachSocket(httpServer));httpServer.listen(port,()=>console.log(`Server running on http://localhost:${port}`));}).catch(error=>{console.error('Server startup failed:',error.message);process.exit(1);});