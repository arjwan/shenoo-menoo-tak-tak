const express = require('express');
const ConsultationProvider = require('../models/ConsultationProvider');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const categories = ['medical','legal','psychological','social'];
const clean=(v,max=500)=>String(v||'').trim().slice(0,max);

router.get('/', async (req,res)=>{
  const category=clean(req.query.category,30);
  const query={status:'approved'};
  if(categories.includes(category)) query.category=category;
  const providers=await ConsultationProvider.find(query).sort({createdAt:-1}).populate('user','fullName username avatarUrl').lean();
  res.json({ok:true,providers:providers.map(p=>({id:p._id,category:p.category,title:p.title,specialty:p.specialty,bio:p.bio,serviceType:p.serviceType,fee:p.fee,currency:p.currency,user:p.user}))});
});

router.get('/mine', requireAuth, async(req,res)=>{
  const providers=await ConsultationProvider.find({user:req.user._id}).sort({createdAt:-1}).lean();
  res.json({ok:true,providers});
});

router.post('/providers', requireAuth, async(req,res)=>{
  try{
    const category=clean(req.body.category,30), serviceType=clean(req.body.serviceType,20);
    const title=clean(req.body.title,120), specialty=clean(req.body.specialty,120), bio=clean(req.body.bio,1200);
    const fee=Number(req.body.fee||0);
    if(!categories.includes(category)||!title||!specialty||!bio) return res.status(400).json({ok:false,message:'أكمل بيانات مقدم الاستشارة'});
    if(!['free','paid'].includes(serviceType)) return res.status(400).json({ok:false,message:'حدد الاستشارة مجانية أو مدفوعة'});
    if(serviceType==='paid' && (!Number.isFinite(fee)||fee<=0)) return res.status(400).json({ok:false,message:'أدخل أجرة صحيحة للاستشارة المدفوعة'});
    const provider=await ConsultationProvider.create({user:req.user._id,category,title,specialty,bio,serviceType,fee:serviceType==='paid'?fee:0,status:'pending'});
    res.status(201).json({ok:true,message:'تم إرسال طلب تقديم الاستشارات للمراجعة',provider:{id:provider._id,status:provider.status}});
  }catch(error){
    if(error?.code===11000) return res.status(409).json({ok:false,message:'لديك طلب في هذا القسم بالفعل'});
    res.status(500).json({ok:false,message:'تعذر إرسال الطلب'});
  }
});
module.exports=router;
