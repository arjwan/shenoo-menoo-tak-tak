const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function handleGameActions(req,env,user){
 const pathname=new URL(req.url).pathname;
 const found=pathname.match(/^\/api\/game-actions\/([0-9a-f-]{36})\/(state|match-settings|score|save|players|request-player)$/i);
 if(!found)return response({ok:false,message:'المسار غير موجود'},404);
 const [,roomId,operation]=found;
 const room=await env.DB.prepare('SELECT * FROM game_rooms WHERE id=? AND is_active=1').bind(roomId).first();
 if(!room)return response({ok:false,message:'الغرفة غير موجودة'},404);
 const player=await env.DB.prepare('SELECT 1 AS present FROM game_room_players WHERE room_id=? AND user_id=?').bind(roomId,user.id).first();
 if(!player)return response({ok:false,message:'اللاعبون فقط يستطيعون استعمال هذه الخدمة'},403);
 if(operation==='state'&&req.method==='GET')return response({ok:true,teamMode:room.team_mode,scoreTarget:100,teamScores:{A:0,B:0},savedAt:null});
 const origin=req.headers.get('Origin');
 if(origin&&origin!==new URL(req.url).origin)return response({ok:false,message:'مصدر الطلب غير موثوق'},403);
 if(operation==='match-settings'&&req.method==='PATCH'){
   if(room.owner_id!==user.id)return response({ok:false,message:'مالك الغرفة فقط'},403);
   const body=await req.json().catch(()=>({}));
   const mode=body.teamMode||room.team_mode;
   if(mode!==room.team_mode||body.scoreTarget!==undefined&&Number(body.scoreTarget)!==100)return response({ok:false,message:'لا يمكن تغيير إعدادات هذه الطاولة بعد إنشائها'},409);
   return response({ok:true,teamMode:room.team_mode,maxPlayers:room.max_players,scoreTarget:100});
 }
 if(operation==='save'&&req.method==='POST'){
   const state=await env.DB.prepare('SELECT saved_at FROM game_room_state WHERE room_id=?').bind(roomId).first();
   if(!state)return response({ok:false,message:'لم تبدأ المباراة بعد'},409);
   return response({ok:true,savedAt:state.saved_at,message:'المباراة محفوظة بالفعل تلقائيًا'});
 }
 return response({ok:false,message:'هذه الوظيفة قيد النقل ولا يمكن تنفيذها بأمان بعد'},501);
}
