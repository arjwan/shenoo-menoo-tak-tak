const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Store = require('../models/Store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../../uploads/stores');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({ destination: (req,file,cb)=>cb(null,uploadDir), filename:(req,file,cb)=>{ const ext=path.extname(file.originalname||'').toLowerCase(); const safe=['.png','.jpg','.jpeg','.webp'].includes(ext)?ext:'.jpg'; cb(null,`${Date.now()}-${Math.random().toString(36).slice(2,10)}${safe}`); } });
const upload = multer({ storage, limits:{fileSize:8*1024*1024,files:2}, fileFilter:(req,file,cb)=> /^image\/(png|jpe?g|webp)$/.test(file.mimetype||'') ? cb(null,true) : cb(Object.assign(new Error('نوع الصورة غير مدعوم'),{status:400})) });
const clean = (v,max=300) => String(v||'').trim().slice(0,max);

router.post('/', requireAuth, (req,res,next)=>upload.fields([{name:'logo',maxCount:1},{name:'cover',maxCount:1}])(req,res,err=>err?res.status(err.status||400).json({ok:false,message:err.message||'تعذر رفع الصور'}):next()), async (req,res)=>{
  try {
    const { name,category,description,governorate,area,address,phone,whatsapp,facebook,instagram,website,plan,template,spaceSize,delegate1Name,delegate1Phone,delegate2Name,delegate2Phone }=req.body;
    if(!name||!category||!description||!governorate||!area||!address||!phone||!plan) return res.status(400).json({ok:false,message:'أكمل الحقول المطلوبة لإنشاء المتجر'});
    if(!['basic','plus','featured'].includes(plan)) return res.status(400).json({ok:false,message:'الباقة المختارة غير صالحة'});
    if(!['elegant','tech','market'].includes(template))return res.status(400).json({ok:false,message:'قالب المتجر غير صالح'});
    if(!['small','medium','large'].includes(spaceSize))return res.status(400).json({ok:false,message:'حجم مساحة المتجر غير صالح'});
    const delegates=[];
    [[delegate1Name,delegate1Phone],[delegate2Name,delegate2Phone]].forEach(([n,p])=>{if(clean(n)||clean(p)) delegates.push({name:clean(n,120),phone:clean(p,30),role:'sales'});});
    if(delegates.some(d=>!d.name||!d.phone)) return res.status(400).json({ok:false,message:'أدخل اسم ورقم هاتف كل مندوب، أو اترك حقليه فارغين'});
    const files=req.files||{};
    const store=await Store.create({ owner:req.user._id,name:clean(name,120),category:clean(category,120),description:clean(description,1000),governorate:clean(governorate,80),area:clean(area,100),address:clean(address,240),phone:clean(phone,30),whatsapp:clean(whatsapp,30),facebook:clean(facebook,220),instagram:clean(instagram,220),website:clean(website,220),plan,template,spaceSize,logoUrl:files.logo?.[0]?`/uploads/stores/${files.logo?.[0].filename}`:'',coverUrl:files.cover?.[0]?`/uploads/stores/${files.cover?.[0].filename}`:'',delegates,status:'pending' });
    return res.status(201).json({ok:true,message:'تم استلام طلب إنشاء المتجر وهو بانتظار موافقة الإدارة',store:{id:store._id,name:store.name,status:store.status}});
  } catch(error){ if(error?.code===11000)return res.status(409).json({ok:false,message:'لديك متجر بهذا الاسم بالفعل'}); console.error('Store create failed:',error.message); return res.status(500).json({ok:false,message:'تعذر إنشاء المتجر'}); }
});

router.get('/mine',requireAuth,async(req,res)=>{const stores=await Store.find({owner:req.user._id}).sort({createdAt:-1}).lean();res.json({ok:true,stores:stores.map(s=>({id:s._id,name:s.name,category:s.category,plan:s.plan,template:s.template,spaceSize:s.spaceSize,status:s.status,createdAt:s.createdAt}))});});
router.get('/',async(req,res)=>{const stores=await Store.find({status:'approved'}).sort({createdAt:-1}).select('name category description governorate area logoUrl coverUrl plan template spaceSize').lean();res.json({ok:true,stores});});
router.get('/:id',async(req,res)=>{try{const store=await Store.findOne({_id:req.params.id,status:'approved'}).select('-delegates.user').lean();if(!store)return res.status(404).json({ok:false,message:'المتجر غير موجود'});res.json({ok:true,store});}catch{return res.status(404).json({ok:false,message:'المتجر غير موجود'});}});
module.exports=router;
