// Server-authoritative standard tawla (backgammon) engine.
function emptyBoard(){return Array.from({length:24},()=>({white:0,black:0}))}
function setupBoard(){
 const b=emptyBoard(),setup=[
  [0,'black',2],[11,'black',5],[16,'black',3],[18,'black',5],
  [23,'white',2],[12,'white',5],[7,'white',3],[5,'white',5]
 ];
 setup.forEach(([p,c,n])=>b[p][c]=n);return b
}
function other(c){return c==='white'?'black':'white'}
function colorOf(s,userId){return String(s.players[0])===String(userId)?'white':'black'}
function rollDie(){return 1+Math.floor(Math.random()*6)}
function direction(c){return c==='white'?-1:1}
function homeRange(c){return c==='white'?[0,5]:[18,23]}
function allInHome(s,c){
 if(s.bar[c])return false;const [lo,hi]=homeRange(c);
 return s.board.every((p,i)=>!p[c]||(i>=lo&&i<=hi))
}
function canBearOff(s,c,from,die){
 if(!allInHome(s,c))return false;
 const target=from+direction(c)*die;
 if(c==='white'){
  if(target===-1)return true;if(target>-1)return false;
  return !s.board.some((p,i)=>i>from&&i<=5&&p.white>0)
 }
 if(target===24)return true;if(target<24)return false;
 return !s.board.some((p,i)=>i<from&&i>=18&&p.black>0)
}
function entryPoint(c,die){return c==='white'?24-die:die-1}
function openPoint(s,c,to){return to>=0&&to<24&&s.board[to][other(c)]<2}
function movesForDie(s,c,die){
 const moves=[];
 if(s.bar[c]>0){
  const to=entryPoint(c,die);if(openPoint(s,c,to))moves.push({type:'move',from:'bar',to,die});return moves
 }
 for(let from=0;from<24;from++){
  if(!s.board[from][c])continue;const to=from+direction(c)*die;
  if(to>=0&&to<24){if(openPoint(s,c,to))moves.push({type:'move',from,to,die})}
  else if(canBearOff(s,c,from,die))moves.push({type:'move',from,to:'home',die})
 }
 return moves
}
function legalMoves(s,userId){
 if(s.status!=='active'||String(s.turn)!==String(userId)||!s.rolled)return[];
 const c=colorOf(s,userId),out=[];
 [...new Set(s.remainingMoves||[])].forEach(d=>out.push(...movesForDie(s,c,d)));
 return out
}
function advance(s){
 s.turn=s.players[(s.players.findIndex(p=>String(p)===String(s.turn))+1)%s.players.length];
 s.dice=[0,0];s.remainingMoves=[];s.rolled=false
}
function createGame(params={}){
 const players=(params.playerIds||['p1','p2']).map(String).slice(0,2);
 return{engine:'tawla',version:2,status:'waiting',turn:players[0],players,board:setupBoard(),
  bar:{white:0,black:0},home:{white:0,black:0},dice:[0,0],remainingMoves:[],rolled:false,
  finished:false,winner:null,moveCount:0,scores:params.scores||{},roundNumber:Number(params.roundNumber)||1,
  lastRound:params.lastRound||null,createdAt:new Date()}
}
function applyAction(s,userId,action={}){
 userId=String(userId);
 if(s.status!=='active')return{error:'اللعبة غير نشطة'};
 if(String(s.turn)!==userId)return{error:'ليس دورك'};
 const c=colorOf(s,userId),opp=other(c);
 if(action.type==='roll'){
  if(s.rolled)return{error:'تم رمي الزهر بالفعل'};
  s.dice=[rollDie(),rollDie()];s.remainingMoves=s.dice[0]===s.dice[1]?[s.dice[0],s.dice[0],s.dice[0],s.dice[0]]:[...s.dice];s.rolled=true;
  if(!legalMoves(s,userId).length)advance(s);return{ok:true}
 }
 if(action.type!=='move')return{error:'حركة غير معروفة'};
 const legal=legalMoves(s,userId),from=action.from==='bar'?'bar':Number(action.from),to=action.to==='home'?'home':Number(action.to),die=Number(action.die);
 const move=legal.find(m=>m.from===from&&m.to===to&&m.die===die);
 if(!move)return{error:'هذه الحركة لا تطابق الزهر'};
 if(from==='bar')s.bar[c]-=1;else s.board[from][c]-=1;
 if(to==='home')s.home[c]+=1;else{
  if(s.board[to][opp]===1){s.board[to][opp]=0;s.bar[opp]+=1}
  s.board[to][c]+=1
 }
 const di=s.remainingMoves.indexOf(die);if(di>=0)s.remainingMoves.splice(di,1);s.moveCount+=1;
 if(s.home[c]>=15){
  const points=s.home[opp]===0?2:1;s.finished=true;s.status='finished';s.winner=userId;s.scores=s.scores||{};
  s.scores[userId]=Number(s.scores[userId]||0)+points;s.lastRound={winner:userId,points,roundNumber:s.roundNumber};
  return{ok:true}
 }
 if(!s.remainingMoves.length||!legalMoves(s,userId).length)advance(s);
 return{ok:true}
}
function getLegalActions(s,userId){
 if(s.status!=='active'||String(s.turn)!==String(userId))return[];
 if(!s.rolled)return[{type:'roll'}];return legalMoves(s,String(userId))
}
function getPublicState(s){return{status:s.status,turn:s.turn,players:s.players,board:s.board,bar:s.bar,home:s.home,dice:s.dice,remainingMoves:s.remainingMoves||[],rolled:s.rolled,finished:s.finished,winner:s.winner,moveCount:s.moveCount||0,scores:s.scores||{},roundNumber:s.roundNumber||1,lastRound:s.lastRound||null}}
function getPrivateState(s,userId){return{myColor:colorOf(s,String(userId)),turn:String(s.turn)===String(userId),rolled:s.rolled,remainingMoves:s.remainingMoves||[]}}
function isFinished(s){return!!s.finished}
function getWinner(s){return s.winner||null}
function serialize(s){return JSON.stringify(getPublicState(s))}
module.exports={createGame,getPublicState,getPrivateState,getLegalActions,applyAction,isFinished,getWinner,serialize};
