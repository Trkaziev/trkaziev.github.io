import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import worker from './dist/server/index.js';
let input='';for await(const chunk of process.stdin)input+=chunk;const secrets=JSON.parse(input);
const sql=new DatabaseSync(':memory:');sql.exec(await fs.readFile('drizzle/0000_votes.sql','utf8'));
const testPassword=crypto.randomBytes(24).toString('hex');
const testPasswordHash=crypto.pbkdf2Sync(testPassword,secrets.LOGIN_SALT,100000,32,'sha256').toString('hex');
const env={...secrets,LOGIN_USERNAME:'sasha',LOGIN_PASSWORD_HASH:testPasswordHash,DB:{prepare(query){return{bind(...args){const stmt=sql.prepare(query);return{first:async()=>stmt.get(...args)||null,all:async()=>({results:stmt.all(...args)}),run:async()=>stmt.run(...args)};}}}}};
const origin='https://example.test';
const call=(path,{method='GET',body,cookie,key,originOverride=origin}={})=>worker.fetch(new Request(origin+path,{method,headers:{...(method==='POST'?{'Content-Type':'application/json',Origin:originOverride}:{}),...(cookie?{Cookie:cookie}:{}),...(key?{Authorization:'Bearer '+key}:{})},body:body?JSON.stringify(body):undefined}),env);
assert.equal((await call('/')).status,200);assert.match(await (await call('/')).text(),/id="login"/);assert.doesNotMatch(await(await call('/')).text(),/Борминцева|катя-interview|gameContent/);
assert.equal((await call('/sasha-assets/voting.js')).status,401);
for(const path of ['/sasha-assets/prank-intro.js','/sasha-assets/prank-intro.css','/sasha-assets/bormintseva.jpg'])assert.equal((await call(path)).status,401);
const voter='test-voter-123456789';
const login={username:'sasha',password:testPassword,voter_id:voter,name:'Проверка'};
assert.equal((await call('/api/login',{method:'POST',body:{...login,password:'wrong'}})).status,401);
assert.equal((await call('/api/login',{method:'POST',body:login,originOverride:'https://evil.test'})).status,403);
const r=await call('/api/login',{method:'POST',body:login});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
assert.equal((await call('/api/session',{cookie})).status,200);assert.equal((await (await call('/api/session',{cookie})).json()).name,'Проверка');
const game=await(await call('/',{cookie})).text();assert.match(game,/gameContent/);assert.match(game,/casePools/);assert.doesNotMatch(game,/trader-signal|ios-simulator|head-mobile-platform/);
assert.equal((await call('/sasha-assets/voting.js',{cookie})).status,200);
assert.match(game,/sasha-assets\/prank-intro.js/);
const photo=await call('/sasha-assets/bormintseva.jpg',{cookie});assert.equal(photo.status,200);assert.equal(photo.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),await fs.readFile('../sasha-game/sasha-assets/bormintseva.jpg'));
const prank=await(await call('/sasha-assets/prank-intro.js',{cookie})).text();assert.match(prank,/Идите нахуй со своими настолками/);assert.match(prank,/Ха, пиздабол/);new vm.Script(prank);
assert.equal((await call('/',{cookie:cookie+'bad'})).status,200);assert.match(await(await call('/',{cookie:cookie+'bad'})).text(),/id="login"/);
const registry=JSON.parse(await fs.readFile('../sasha-game/registry.json','utf8'));const [question_id,revision]=Object.entries(registry)[0];const vote={campaign:'sasha-jokes-2026-11',question_id,revision,vote:1,comment:'Тест'};
assert.equal((await call('/api/vote',{method:'POST',body:vote})).status,401);
assert.equal((await call('/api/vote',{method:'POST',body:{...vote,revision:'stale'},cookie})).status,400);
assert.equal((await call('/api/vote',{method:'POST',body:vote,cookie})).status,200);
sql.prepare('UPDATE votes SET updated_at=?').run('2000-01-01T00:00:00.000Z');
assert.equal((await call('/api/vote',{method:'POST',body:{...vote,vote:0},cookie})).status,200);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM votes').get().n,1);assert.equal(sql.prepare('SELECT vote FROM votes').get().vote,0);
assert.equal((await call('/api/admin/export',{cookie})).status,401);
assert.equal((await call('/api/admin/export',{key:secrets.ADMIN_KEY})).status,401);
assert.equal((await call('/api/admin/export',{key:secrets.ADMIN_KEY,cookie})).status,200);
assert.match((await call('/api/logout',{method:'POST',body:{},cookie})).headers.get('set-cookie'),/Max-Age=0/);
const scripts=[...game.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let reached=new Set(),endings=new Set();
for(let trial=0;trial<500;trial++){
 const sandbox={Math,sessionStorage:{getItem(){return null},setItem(){}}};vm.createContext(sandbox);for(let i=0;i<3;i++)vm.runInContext(scripts[i],sandbox);
 const c=sandbox.gameContent,g=sandbox.createGame(c);assert.equal(Object.keys(c.scenes).length,21);assert.equal(c.rounds.length,11);let run=g.initial();
 for(const [id,s] of Object.entries(c.scenes)){const hash=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(registry[hash(id).slice(0,24)],hash(JSON.stringify({title:s.title,body:s.body,choices:s.choices.map(choice=>[choice.id,choice.text,choice.result]),fact:s.fact})).slice(0,16));assert(['slack','owner'].includes(s.source.kind));}
 while(g.current(run)){const scene=g.current(run);reached.add(scene.id);assert(scene.choices.length>=2);for(const choice of scene.choices){assert(choice.result);assert(choice.text);}const choice=scene.choices[Math.floor(Math.random()*scene.choices.length)];run=g.act(run,choice.id);for(const v of Object.values(run.stats))assert(v>=0&&v<=100);}
 assert.equal(run.moves.length,11);assert(g.finish(run));endings.add(g.finish(run).id);assert.equal(g.restore(g.encode(run)).moves.length,11);assert.equal(g.rewind(run,3).moves.length,3);
}
assert.equal(reached.size,21);console.log(JSON.stringify({backend:'passed',sessions:500,reachableScenes:reached.size,endings:[...endings]}));
