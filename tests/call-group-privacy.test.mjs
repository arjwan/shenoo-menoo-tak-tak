import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {handleCallGroups} from '../cloudflare/call-groups.js';
const owner={id:'11111111-1111-4111-8111-111111111111'},other={id:'22222222-2222-4222-8222-222222222222'};
function setup(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,full_name TEXT,username TEXT,status TEXT);');for(const f of ['20261110_call_groups.sql','20261118_call_group_settings.sql'])db.exec(readFileSync(new URL('../cloudflare/migrations/'+f,import.meta.url),'utf8'));for(const u of [owner,other])db.prepare("INSERT INTO users VALUES(?,'Test','test','active')").run(u.id);return {DB:{prepare(sql){let v=[];return{bind(...values){v=values;return this},async first(){return db.prepare(sql).get(...v)},async all(){return{results:db.prepare(sql).all(...v)}},async run(){return db.prepare(sql).run(...v)}}},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}}}}
function req(path='',body){return new Request('https://shinomino.com/api/call-groups'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://shinomino.com'},body:JSON.stringify(body)})}
test('Private groups stay private, public join grants membership, and channels restrict publishing',async()=>{
 const env=setup();const privateGroup=(await(await handleCallGroups(req('',{name:'Private',members:[]}),env,owner)).json()).group;
 assert.equal((await handleCallGroups(req('/'+privateGroup.id),env,other)).status,403);
 assert.equal((await handleCallGroups(req('/'+privateGroup.id+'/join',{}),env,other)).status,403);
 assert.equal((await(await handleCallGroups(req('/public'),env,other)).json()).groups.length,0);
 const channel=(await(await handleCallGroups(req('',{name:'Public',members:[],visibility:'public',kind:'channel'}),env,owner)).json()).group;
 assert.equal((await handleCallGroups(req('/'+channel.id+'/messages'),env,other)).status,403);
 assert.equal((await handleCallGroups(req('/'+channel.id+'/join',{}),env,other)).status,200);
 assert.equal((await handleCallGroups(req('/'+channel.id+'/messages',{text:'Unauthorized broadcast'}),env,other)).status,403);
 assert.equal((await handleCallGroups(req('/'+channel.id+'/messages',{text:'Owner broadcast'}),env,owner)).status,201);
 assert.equal((await(await handleCallGroups(req('/'+channel.id+'/messages'),env,other)).json()).messages.length,1);
});
