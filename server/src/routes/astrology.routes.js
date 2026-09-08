const express = require('express');
const AstrologyProvider = require('../models/AstrologyProvider');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const clean=(v,max=500)=>String(v||'').trim().slice(0,max);

router.get('/', async(req,res)=>{
  const providers=await AstrologyProvider.find({status:'approved'}).sort({createdAt:-1}).populate('user','fullName username avatarUrl').lean();
  res.json({ok:true,providers:providers.map(p=>({id:p._id,displayTitle:p.displayTitle,bio:p.bio,serviceType:p.serviceType,fee:p.fee,currency:p.currency,user:p.user}))});
});
router.get('/mine',requireAuth,async(req,res)=>{
  const provider=await AstrologyProvider.findOne({user:req.user._id}).lean();
  res.json({ok:true,provider});
});
router.post('/providers',requireAuth,async(req,res)=>{
  try{
    const displayTitle=clean(req.body.displayTitle,120),bio=clean(req.body.bio,1200),serviceType=clean(req.body.serviceType,20),fee=Number(req.body.fee||0);
    if(!displayTitle||!bio) return res.status(400).json({ok:false,message:'أكمل بيانات مقدم الأبراج'});
    if(!['free','paid'].includes(serviceType)) return res.status(400).json({ok:false,message:'حدد الخدمة مجانية أو مدفوعة'});
    if(serviceType==='paid'&&(!Number.isFinite(fee)||fee<=0)) return res.status(400).json({ok:false,message:'أدخل سعراً صحيحاً'});
    const provider=await AstrologyProvider.create({user:req.user._id,displayTitle,bio,serviceType,fee:serviceType==='paid'?fee:0,status:'pending'});
    res.status(201).json({ok:true,message:'تم إرسال طلب مقدم الأبراج للمراجعة',provider:{id:provider._id,status:provider.status}});
  }catch(error){
    if(error?.code===11000) return res.status(409).json({ok:false,message:'لديك طلب تسجيل في ركن أم عباس بالفعل'});
    res.status(500).json({ok:false,message:'تعذر إرسال الطلب'});
  }
});
module.exports=router;
