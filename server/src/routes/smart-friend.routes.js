const express=require('express');
const multer=require('multer');
const path=require('path');
const fs=require('fs');
const {requireAuth}=require('../middleware/auth');
const SmartFriend=require('../models/SmartFriend');
const Message=require('../models/SmartFriendMessage');
const router=express.Router();

const uploadDir=path.resolve(__dirname,'../../../uploads/smart-friend');
fs.mkdirSync(uploadDir,{recursive:true});
const allowed=new Map([
  ['audio/webm','.webm'],['audio/ogg','.ogg'],['audio/mpeg','.mp3'],['audio/mp4','.m4a'],['audio/wav','.wav'],
  ['video/webm','.webm'],['video/mp4','.mp4'],['video/quicktime','.mov']
]);
const upload=multer({
  storage:multer.diskStorage({
    destination:(_r,_f,cb)=>cb(null,uploadDir),
    filename:(_r,f,cb)=>cb(null,`${Date.now()}-${Math.random().toString(36).slice(2)}${allowed.get(f.mimetype)||''}`)
  }),
  limits:{fileSize:80*1024*1024,files:1},
  fileFilter:(_r,f,cb)=>allowed.has(f.mimetype)?cb(null,true):cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE',f.fieldname))
});

router.use(requireAuth);
const avatars={male:['male-1','male-2','male-3','male-4'],female:['female-1','female-2','female-3','female-4']};
const emotions=['idle','listening','thinking','happy','funny','serious','sad','supportive','surprised','talking'];
function view(p){return p?{id:p._id,name:p.name,gender:p.gender,age:p.age,avatar:p.avatar,personality:p.personality,interests:p.interests||[],dialect:p.dialect,conversationStyle:p.conversationStyle}:null;}
function inferEmotion(text){const t=String(text||'').toLowerCase();if(/هههه|😂|🤣|نكت|ضحك|مضحك/.test(t))return'funny';if(/حزين|زعلان|ضايج|تعبان|مكتئب|ابچي|بكاء|فقدت|وفاة|مات/.test(t))return'sad';if(/ساعدني|نصيحة|انصحني|محتاجك|احتاجك|مشكلة/.test(t))return'supportive';if(/واو|معقولة|صدگ|صدق|غريبة|ما توقعت/.test(t))return'surprised';if(/مبروك|نجحت|فرحان|حلو|ممتاز|تمام/.test(t))return'happy';if(/قانون|طبيب|دكتور|مرض|علاج|دواء|فلوس|دين|محكمة|قضية|خطر/.test(t))return'serious';return'talking';}
function messageView(m){return {id:m._id,role:m.role,text:m.text||'',media:m.media&&m.media.url?m.media:null,createdAt:m.createdAt};}
function mediaFromFile(f){if(!f)return null;return {url:`/uploads/smart-friend/${f.filename}`,type:f.mimetype.startsWith('video/')?'video':'audio',mimeType:f.mimetype,size:f.size};}

router.get('/options',(req,res)=>res.json({ok:true,ages:{min:18,max:80},avatars,personalities:['friendly','calm','funny','serious','listener','educated'],styles:['casual','balanced','advice'],dialect:'iraqi',emotions}));
router.get('/me',async(req,res)=>{const friend=await SmartFriend.findOne({user:req.user._id});res.json({ok:true,friend:view(friend)});});
router.put('/me',async(req,res)=>{const gender=req.body.gender==='female'?'female':'male',age=Math.max(18,Math.min(80,Number(req.body.age)||18)),allowedList=avatars[gender],avatar=allowedList.includes(req.body.avatar)?req.body.avatar:allowedList[0],personalities=['friendly','calm','funny','serious','listener','educated'],styles=['casual','balanced','advice'];const data={name:String(req.body.name||'صديقي').trim().slice(0,40),gender,age,avatar,personality:personalities.includes(req.body.personality)?req.body.personality:'friendly',interests:Array.isArray(req.body.interests)?req.body.interests.slice(0,8).map(x=>String(x).trim().slice(0,40)).filter(Boolean):[],dialect:'iraqi',conversationStyle:styles.includes(req.body.conversationStyle)?req.body.conversationStyle:'balanced'};const friend=await SmartFriend.findOneAndUpdate({user:req.user._id},{$set:data},{new:true,upsert:true,setDefaultsOnInsert:true});res.json({ok:true,friend:view(friend)});});
router.get('/messages',async(req,res)=>{const items=await Message.find({user:req.user._id}).sort({createdAt:-1}).limit(100).lean();res.json({ok:true,messages:items.reverse().map(messageView)});});
router.delete('/messages',async(req,res)=>{await Message.deleteMany({user:req.user._id});res.json({ok:true});});

router.post('/messages',upload.single('media'),async(req,res)=>{
  const text=String(req.body.text||'').trim();
  const media=mediaFromFile(req.file);
  if((!text&&!media)||text.length>4000)return res.status(400).json({ok:false,message:'اكتب رسالة أو أرسل تسجيلًا صوتيًا/فيديو'});
  const friend=await SmartFriend.findOne({user:req.user._id});
  if(!friend)return res.status(409).json({ok:false,message:'اختر صديقك الذكي أولاً'});
  const userMessage=await Message.create({user:req.user._id,role:'user',text,media:media||undefined});
  const provider=process.env.SMART_FRIEND_API_URL;
  if(!provider)return res.status(503).json({ok:false,saved:messageView(userMessage),message:'تم حفظ رسالتك، لكن خدمة الذكاء الاصطناعي لم تُربط بالخادم بعد. لن نعرض رداً وهمياً.'});
  try{
    const recent=await Message.find({user:req.user._id}).sort({createdAt:-1}).limit(20).lean();
    const response=await fetch(provider,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.SMART_FRIEND_API_KEY?{Authorization:'Bearer '+process.env.SMART_FRIEND_API_KEY}:{})},body:JSON.stringify({friend:view(friend),language:'ar-IQ',instructions:'تكلم باللهجة العراقية الطبيعية. أنت مساعد افتراضي واضح الهوية ولست إنساناً. قدم محادثة ومساعدة عامة، وفي الطب والقانون والمال وضّح حدودك ولا تدّعِ أنك مختص مرخّص. إذا وجدت رسالة صوتية أو فيديو ولم يكن المزود يدعم فهم الوسائط، صرّح بذلك ولا تخمّن محتواها. أعد أيضاً emotion واحدة من: '+emotions.join(', ')+' بما يناسب نبرة الرد.',messages:recent.reverse().map(m=>({role:m.role,content:m.text||'',media:m.media&&m.media.url?{type:m.media.type,url:m.media.url,mimeType:m.media.mimeType}:undefined}))})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.message||'تعذر الحصول على الرد');
    const answer=String(data.reply||data.message||data.output||'').trim();
    if(!answer)throw Error('لم يصل رد صالح من خدمة الذكاء الاصطناعي');
    const emotion=emotions.includes(data.emotion)?data.emotion:inferEmotion(answer);
    const saved=await Message.create({user:req.user._id,role:'assistant',text:answer.slice(0,12000)});
    res.status(201).json({ok:true,emotion,userMessage:messageView(userMessage),message:messageView(saved)});
  }catch(e){
    res.status(502).json({ok:false,saved:messageView(userMessage),message:'حُفظت رسالتك لكن تعذر الاتصال بخدمة الذكاء الاصطناعي: '+e.message});
  }
});

module.exports=router;
