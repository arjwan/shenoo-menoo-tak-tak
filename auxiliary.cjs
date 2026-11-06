'use strict';
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
app.set('trust proxy', 1);
app.use(express.json({limit:'8mb'}));
app.use((req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});next();});
// No application migrations, seeding, cleanup jobs, or D1 social routes run here.
const readiness=()=>({ok:mongoose.connection.readyState===1,service:'shenoo-original-aux',reference:'d7818b1',mongoConnected:mongoose.connection.readyState===1,writeEnabled:process.env.AUXILIARY_WRITES_ENABLED==='true'});
app.get(['/health','/api/health'],(_req,res)=>res.status(mongoose.connection.readyState===1?200:503).json(readiness()));
app.use('/api',(req,res,next)=>{
 if(mongoose.connection.readyState!==1)return res.status(503).json({ok:false,message:'قاعدة المدرسة واللوحة غير متاحة'});
 // Require an explicitly configured least-privilege service before mutable flows.
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.path!=='/developer/login'&&process.env.AUXILIARY_WRITES_ENABLED!=='true')return res.status(503).json({ok:false,message:'يلزم تهيئة حساب خدمة MongoDB محدود الصلاحيات لعمليات الكتابة والتحقق الثنائي'});
 next();
});
const {requireAuth,requireRole}=require('./server/src/middleware/auth');
app.use('/api/developer/modules',requireAuth,requireRole('developer'));
app.use('/api/developer/modules/approvals',require('./server/src/routes/service-approvals.routes'));
app.use('/api/developer/modules/providers',require('./server/src/routes/service-providers.routes'));
app.use('/api/developer/modules/ticker',require('./server/src/routes/broadcast-ticker.routes'));
app.use('/api/developer',require('./server/src/routes/developer.routes'));
app.use('/api/developer-mfa',require('./server/src/routes/developer-mfa.routes'));
app.use('/api/school',require('./server/src/routes/school-indexed-curriculum.routes'));
const schoolMounts=[['/api/school','school-canva'],['/api/school','school-live'],['/api/school','school-sync'],['/api/school','school'],['/api/school','school-classroom'],['/api/school/management','school-management'],['/api/school/assignments','school-assignment'],['/api/school/management/assignments','school-assignment'],['/api/school/teachers/apply','school-teacher-apply'],['/api/school/portal','school-portal'],['/api/school/manage','school-management'],['/api/school/virtual','school-virtual']];
for(const [prefix,name] of schoolMounts)app.use(prefix,require('./server/src/routes/'+name+'.routes'));
// Files stay in their existing location; never copy the curriculum PDF corpus.
app.use('/uploads/school-curriculum',express.static(path.resolve(__dirname,'../uploads/school-curriculum')));
app.use('/developer',express.static(path.join(__dirname,'developer'),{index:'index.html',setHeaders:res=>res.set({'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",'Referrer-Policy':'no-referrer'})}));
app.use((error,req,res,next)=>{console.error('Auxiliary request failed:',error.name);res.status(500).json({ok:false,message:'تعذر إتمام الطلب على الخادم المساعد'});});
app.use((_req,res)=>res.status(404).json({ok:false,message:'المسار غير موجود في الخادم المساعد'}));
if(require.main===module){
 if(!process.env.MONGODB_URI||!process.env.JWT_SECRET)throw Error('MONGODB_URI and JWT_SECRET must be configured');
 // Existing cPanel service uses an 8 second connection selection budget.
 mongoose.connect(process.env.MONGODB_URI,{dbName:'shino_mino_tak_tak',autoIndex:false,serverSelectionTimeoutMS:8000}).then(()=>app.listen(process.env.PORT||3000,()=>console.log('Original auxiliary backend ready'))).catch(error=>{console.error('Auxiliary startup failed:',error.name);process.exitCode=1;});
}
module.exports=app;
