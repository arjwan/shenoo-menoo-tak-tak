import domino from './game-engines/domino-engine.js';
import tawla from './game-engines/tawla-engine.js';
import chess from './game-engines/chess-engine.js';
import cards from './game-engines/cards-engine.js';

const engines={domino,tawla,chess,cards};
export function engineFor(type){if(!Object.hasOwn(engines,type))throw new Error('Unsupported game engine');return engines[type]}
export function freshGame(type,ids){const engine=engineFor(type);const state=engine.createGame({playerIds:ids,players:ids.length});state.status='active';return state}
export function publicGame(type,state,userId){
 const engine=engineFor(type),copy=structuredClone(state);
 const visible=engine.getPublicState(copy)||{};
 const privateState=userId&&engine.getPrivateState?engine.getPrivateState(structuredClone(state),String(userId)):null;
 const legalActions=userId&&engine.getLegalActions?engine.getLegalActions(structuredClone(state),String(userId)):[];
 return {public:visible,private:privateState,legalActions};
}
export function moveGame(type,oldState,userId,action){
 const engine=engineFor(type);
 const moveId=String(action?.moveId||'').slice(0,80);
 const state=structuredClone(oldState);
 const prior=Array.isArray(state.appliedMoveIds)?state.appliedMoveIds:[];
 if(moveId&&prior.includes(moveId))return {ok:true,duplicate:true,state};
 const result=engine.applyAction(state,String(userId),action);
 if(!result||result.error||result.ok===false)return {ok:false,error:result?.error||'حركة غير صالحة'};
 const next=result.state||state;
 if(moveId){
   const ids=Array.isArray(next.appliedMoveIds)?next.appliedMoveIds:[];
   ids.push(moveId);next.appliedMoveIds=ids.slice(-50);
 }
 return {ok:true,duplicate:false,state:next};
}
