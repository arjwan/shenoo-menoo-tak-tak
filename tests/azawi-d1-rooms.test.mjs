import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGameRooms } from '../cloudflare/kahwa-rooms.js';
const origin='https://shinomino.com';
function database(){
 const rooms=new Map(),seats=new Map(),people=new Map([['a',{id:'a',username:'alpha',full_name:'أحمد'}],['b',{id:'b',username:'bravo',full_name:'باسم'}]]);
 const execute=(sql,values,kind)=>{
  const getSeats=id=>seats.get(id)||[];
  if(sql.startsWith('INSERT INTO game_rooms')){const [id,code,owner,name,type,visibility,max,mode]=values;rooms.set(id,{id,room_code:code,owner_id:owner,name,game_type:type,visibility,max_players:max,team_mode:mode,status:'waiting',is_active:1,updated_at:'2026-11-07'});return {}}
  if(sql.startsWith('INSERT INTO game_room_players')){const [id,uid,seat]=values;const rows=getSeats(id);if(rows.some(x=>x.user_id===uid||x.seat_index===seat))throw Error('duplicate');rows.push({user_id:uid,seat_index:seat});seats.set(id,rows);return {}}
  if(sql.startsWith('SELECT * FROM game_rooms WHERE is_active=1'))return {results:[...rooms.values()].filter(r=>r.is_active&&(!sql.includes('game_type=?')||r.game_type===values[0]))};
  if(sql.startsWith('SELECT * FROM game_rooms WHERE id=?'))return rooms.get(values[0])||null;
  if(sql.startsWith('SELECT u.id'))return {results:getSeats(values[0]).map(p=>({...people.get(p.user_id),seat_index:p.seat_index}))};
  if(sql.startsWith('SELECT 1'))return getSeats(values[0]).some(x=>x.user_id===values[1])?{present:1}:null;
  if(sql.startsWith('SELECT seat_index'))return {results:getSeats(values[0]).map(p=>({seat_index:p.seat_index}))};
  if(sql.startsWith('DELETE FROM game_room_players')){seats.set(values[0],getSeats(values[0]).filter(p=>p.user_id!==values[1]));return {}}
  if(sql.startsWith('UPDATE game_rooms')){const row=rooms.get(values[0]);if(row&&row.owner_id===values[1])row.is_active=0;return {}}
  throw Error('Unexpected SQL '+sql);
 };
 const db={prepare(sql){return {bind(...v){return{all:()=>execute(sql,v,'all'),first:()=>execute(sql,v,'first'),run:()=>execute(sql,v,'run')}} ,all:()=>execute(sql,[],'all')}} ,async batch(queries){for(const q of queries)await q.run()}};
 return db;
}
function call(db,user,method,path,body){return handleGameRooms(new Request(origin+path,{method,headers:body?{'Content-Type':'application/json','Origin':origin}:{},body:body?JSON.stringify(body):undefined}),{DB:db},{id:user});}
test('create, list, join, restrict deletion and close safely',async()=>{
 const db=database();
 const created=await call(db,'a','POST','/api/game-rooms/',{name:'دومنة بغداد',gameType:'domino',maxPlayers:'2',visibility:'public'});
 assert.equal(created.status,201);
 const room=(await created.json()).room;
 assert.equal(room.players.length,1);
 assert.equal((await (await call(db,'a','GET','/api/game-rooms/')).json()).rooms.length,1);
 const joined=await call(db,'b','POST','/api/game-rooms/'+room.id+'/join',{});
 assert.equal(joined.status,200);
 assert.equal((await joined.json()).room.players.length,2);
 assert.equal((await call(db,'b','DELETE','/api/game-rooms/'+room.id)).status,403);
 assert.equal((await call(db,'a','POST','/api/game-rooms/'+room.id+'/start',{})).status,503);
 assert.equal((await call(db,'a','DELETE','/api/game-rooms/'+room.id)).status,200);
 assert.equal((await (await call(db,'a','GET','/api/game-rooms/')).json()).rooms.length,0);
});
test('private rooms do not leak to strangers',async()=>{
 const db=database();
 const created=await call(db,'a','POST','/api/game-rooms/',{gameType:'chess',visibility:'private',maxPlayers:2});
 const room=(await created.json()).room;
 const l=await (await call(db,'b','GET','/api/game-rooms/')).json();
 assert.deepEqual(l.rooms,[]);
 assert.equal((await call(db,'b','POST','/api/game-rooms/'+room.id+'/join',{})).status,403);
});
test('invalid games, seats, and cross-site mutation are rejected',async()=>{
 const db=database();
 assert.equal((await call(db,'a','POST','/api/game-rooms/',{gameType:'unknown',visibility:'public'})).status,400);
 assert.equal((await call(db,'a','POST','/api/game-rooms/',{gameType:'chess',maxPlayers:6,visibility:'public'})).status,400);
 const r=await handleGameRooms(new Request(origin+'/api/game-rooms/',{method:'POST',headers:{Origin:'https://attacker.test', 'Content-Type':'application/json'},body:JSON.stringify({gameType:'chess'})}),{DB:db},{id:'a'});
 assert.equal(r.status,403);
});
