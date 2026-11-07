import {freshGame,publicGame,moveGame} from './kahwa-engine.js';
// Authenticated Azawi lobby; D1 stores real rooms, never dummy games.
// Gameplay engines remain unavailable until the original engines are adapted and verified.
const TYPES = { domino:['دومنة','🁫'], tawla:['طاولي','🎲'], cards:['ورق','🃏'], chess:['شطرنج','♟'] };
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const bad = (message,status=400) => json({ok:false,message},status);
const clean = value => String(value??'').trim();
const profile = row => ({id:row.id,name:row.full_name||row.username||'لاعب',username:row.username||''});
async function prepare(db,row,viewerId=null) {
  const members = await db.prepare('SELECT u.id,u.full_name,u.username,p.seat_index FROM game_room_players p JOIN users u ON u.id=p.user_id WHERE p.room_id=? ORDER BY p.seat_index').bind(row.id).all();
  const players = members.results.map(profile);
  const owner = players.find(p=>p.id===row.owner_id)||{id:row.owner_id,name:'المالك'};
  const stored=await db.prepare('SELECT state_json,version FROM game_room_state WHERE room_id=?').bind(row.id).first();
  const state=stored?JSON.parse(stored.state_json):null;
  const engine=state?publicGame(row.game_type,state,players.some(p=>p.id===viewerId)?viewerId:null):null;
  const gameState={status:state?.status||row.status,turn:state?.turn?(players.find(p=>p.id===state.turn)||state.turn):null,teamScores:{A:0,B:0},...(engine?.public||{})};
  return {id:row.id,roomCode:row.room_code,name:row.name,gameType:row.game_type,gameName:TYPES[row.game_type][0],gameIcon:TYPES[row.game_type][1],visibility:row.visibility,maxPlayers:row.max_players,teamMode:row.team_mode,owner,players,reservations:[],spectators:[],isActive:!!row.is_active,gameState,engineState:engine||undefined};
}
async function canSee(db,row,user) {
  if(row.visibility==='public'||row.owner_id===user.id)return true;
  const member=await db.prepare('SELECT 1 AS present FROM game_room_players WHERE room_id=? AND user_id=?').bind(row.id,user.id).first();
  // Private and friends rooms are invitation-only until friendship access checks are implemented.
  return !!member;
}
function permitted(req) {
  const origin=req.headers.get('Origin');
  if(origin&&origin!==new URL(req.url).origin)return false;
  return req.headers.get('Sec-Fetch-Site')!=='cross-site';
}
export async function handleGameRooms(req,env,user) {
  const path=new URL(req.url).pathname;
  const sub=path.replace(/^\/api\/game-rooms\/?/,'').split('/').filter(Boolean);
  const db=env.DB,method=req.method;
  if(!['GET','HEAD'].includes(method)&&!permitted(req))return bad('مصدر الطلب غير موثوق',403);
  if(sub.length===0&&method==='GET') {
    const type=new URL(req.url).searchParams.get('gameType');
    if(type&&!TYPES[type])return bad('نوع لعبة غير صالح');
    const q=type?db.prepare('SELECT * FROM game_rooms WHERE is_active=1 AND game_type=? ORDER BY updated_at DESC LIMIT 100').bind(type):db.prepare('SELECT * FROM game_rooms WHERE is_active=1 ORDER BY updated_at DESC LIMIT 100');
    const rows=(await q.all()).results;
    const visible=[];
    for(const row of rows)if(await canSee(db,row,user))visible.push(await prepare(db,row));
    return json({ok:true,rooms:visible,maxListed:100,gameTypes:Object.entries(TYPES).map(([id,[name,icon]])=>({id,name,icon}))});
  }
  if(sub.length===0&&method==='POST') {
    const body=await req.json().catch(()=>null);
    if(!body||typeof body!=='object'||Array.isArray(body))return bad('بيانات الطاولة غير صالحة');
    const type=clean(body.gameType),visibility=clean(body.visibility)||'public';
    if(!TYPES[type]||!['public','friends','private'].includes(visibility))return bad('إعدادات اللعبة غير صحيحة');
    const max=Number(body.maxPlayers||(type==='cards'?4:2));
    if(!Number.isInteger(max)||!(type==='cards'?[2,3,4,5,6].includes(max):type==='domino'?[2,4].includes(max):max===2))return bad('عدد اللاعبين غير صالح');
    const teamMode=clean(body.teamMode)==='2v2'?'2v2':'solo';
    if(teamMode==='2v2'&&(max!==4||!['domino','cards'].includes(type)))return bad('الفِرق غير مدعومة لهذه اللعبة');
    const name=clean(body.name)||'طاولة '+TYPES[type][0];
    if(name.length>100)return bad('اسم الغرفة طويل');
    const id=crypto.randomUUID(),code=String(100000+Math.floor(Math.random()*900000));
    try {
      await db.batch([
        db.prepare('INSERT INTO game_rooms(id,room_code,owner_id,name,game_type,visibility,max_players,team_mode) VALUES(?,?,?,?,?,?,?,?)').bind(id,code,user.id,name,type,visibility,max,teamMode),
        db.prepare('INSERT INTO game_room_players(room_id,user_id,seat_index) VALUES(?,?,0)').bind(id,user.id)
      ]);
    }catch(e){return bad('تعذر حفظ الغرفة. حاول مرة أخرى.',503)}
    const row=await db.prepare('SELECT * FROM game_rooms WHERE id=?').bind(id).first();
    return json({ok:true,room:await prepare(db,row)},201);
  }
  const roomId=sub[0];
  if(!roomId||!/^[-0-9a-f]{36}$/i.test(roomId))return bad('الغرفة غير موجودة',404);
  const row=await db.prepare('SELECT * FROM game_rooms WHERE id=? AND is_active=1').bind(roomId).first();
  if(!row)return bad('الغرفة غير موجودة',404);
  const allowed=await canSee(db,row,user);
  if(sub.length===1&&method==='GET') {
    if(!allowed)return bad('الغرفة خاصة',403);
    return json({ok:true,viewerId:user.id,room:await prepare(db,row,user.id)});
  }
  if(sub.length===1&&method==='DELETE') {
    if(row.owner_id!==user.id)return bad('حذف الغرفة متاح للمالك فقط',403);
    await db.prepare('UPDATE game_rooms SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?').bind(roomId,user.id).run();
    return json({ok:true,message:'تم إغلاق الغرفة'});
  }
  if(sub.length===2&&sub[1]==='join'&&method==='POST') {
    if(!allowed)return bad('الغرفة خاصة ولا يمكنك الانضمام',403);
    if(row.status!=='waiting')return bad('اللعبة بدأت بالفعل',409);
    const old=await db.prepare('SELECT 1 FROM game_room_players WHERE room_id=? AND user_id=?').bind(roomId,user.id).first();
    if(!old){
      const members=await db.prepare('SELECT seat_index FROM game_room_players WHERE room_id=? ORDER BY seat_index').bind(roomId).all();
      const used=new Set(members.results.map(r=>r.seat_index));
      let seat=0;while(used.has(seat)&&seat<row.max_players)seat++;
      if(seat>=row.max_players)return bad('الطاولة ممتلئة',409);
      try{await db.prepare('INSERT INTO game_room_players(room_id,user_id,seat_index) VALUES(?,?,?)').bind(roomId,user.id,seat).run()}catch{return bad('حاول الانضمام مجددًا',409)}
    }
    return json({ok:true,room:await prepare(db,row,user.id)});
  }
  if(sub.length===2&&sub[1]==='join'&&method==='DELETE') {
    if(row.owner_id===user.id)return bad('مالك الطاولة يغلقها بدل المغادرة',403);
    if(row.status!=='waiting')return bad('لا يمكن المغادرة أثناء المباراة',409);
    await db.prepare('DELETE FROM game_room_players WHERE room_id=? AND user_id=?').bind(roomId,user.id).run();
    return json({ok:true});
  }
  if(sub.length===2&&sub[1]==='start'&&method==='POST'){
    if(row.owner_id!==user.id)return bad('مالك الطاولة فقط يبدأ اللعبة',403);
    if(row.status!=='waiting')return bad('اللعبة بدأت بالفعل',409);
    const players=(await db.prepare('SELECT user_id FROM game_room_players WHERE room_id=? ORDER BY seat_index').bind(roomId).all()).results.map(p=>p.user_id);
    if(players.length!==row.max_players)return bad('يجب اكتمال اللاعبين قبل بدء المباراة',409);
    const game=freshGame(row.game_type,players);
    try{
      const inserted=await db.prepare("INSERT INTO game_room_state(room_id,state_json,version) SELECT id,?,0 FROM game_rooms WHERE id=? AND is_active=1 AND status='waiting' AND NOT EXISTS(SELECT 1 FROM game_room_state WHERE room_id=?)").bind(JSON.stringify(game),roomId,roomId).run();
      if(!inserted.meta?.changes)return bad('تم بدء المباراة من جلسة أخرى',409);
      const updated=await db.prepare("UPDATE game_rooms SET status='active',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='waiting' AND is_active=1").bind(roomId).run();
      if(!updated.meta?.changes)return bad('تعذر تغيير حالة المباراة',409);
      return json({ok:true,room:await prepare(db,{...row,status:'active'},user.id)});
    }catch{return bad('تعذر حفظ بداية المباراة',503)}
  }
  if(sub.length===2&&sub[1]==='action'&&method==='POST'){
    if(row.status!=='active')return bad('اللعبة غير نشطة',409);
    const member=await db.prepare('SELECT 1 AS present FROM game_room_players WHERE room_id=? AND user_id=?').bind(roomId,user.id).first();
    if(!member)return bad('هذه الحركة للاعبين فقط',403);
    const action=await req.json().catch(()=>null);
    if(!action||typeof action!=='object'||Array.isArray(action)||JSON.stringify(action).length>4096)return bad('بيانات الحركة غير صحيحة',400);
    const latest=await db.prepare('SELECT state_json,version FROM game_room_state WHERE room_id=?').bind(roomId).first();
    if(!latest)return bad('حالة اللعبة غير موجودة',503);
    const result=moveGame(row.game_type,JSON.parse(latest.state_json),user.id,action);
    if(!result.ok)return bad(result.error||'الحركة غير قانونية',400);
    if(!result.duplicate){
      const updated=await db.prepare("UPDATE game_room_state SET state_json=?,version=version+1,saved_at=CURRENT_TIMESTAMP WHERE room_id=? AND version=?").bind(JSON.stringify(result.state),roomId,latest.version).run();
      if(!updated.meta?.changes)return bad('تغيرت حالة الطاولة. حدّث الصفحة وأعد الحركة',409);
      if(result.state.status==='finished')await db.prepare("UPDATE game_rooms SET status='finished',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").bind(roomId).run();
    }
    const updatedRow={...row,status:result.state.status};
    return json({ok:true,duplicate:result.duplicate,room:await prepare(db,updatedRow,user.id)});
  }
  return bad('خدمة اللعبة غير متاحة بعد',501);
}
