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
const env={...secrets,CONTENT_KEY:crypto.randomBytes(32).toString('hex'),CONTENT_KEY_V2:crypto.randomBytes(32).toString('hex'),CONTENT_KEY_V3:secrets.CONTENT_KEY,LOGIN_USERNAME:'sasha',LOGIN_PASSWORD_HASH:testPasswordHash,DB:{prepare(query){return{bind(...args){const stmt=sql.prepare(query);return{first:async()=>stmt.get(...args)||null,all:async()=>({results:stmt.all(...args)}),run:async()=>stmt.run(...args)};}}}}};
const origin='https://example.test';
const call=(path,{method='GET',body,cookie,key,originOverride=origin}={})=>worker.fetch(new Request(origin+path,{method,headers:{...(method==='POST'?{'Content-Type':'application/json',Origin:originOverride}:{}),...(cookie?{Cookie:cookie}:{}),...(key?{Authorization:'Bearer '+key}:{})},body:body?JSON.stringify(body):undefined}),env);
assert.equal((await call('/')).status,200);assert.match(await (await call('/')).text(),/id="login"/);assert.doesNotMatch(await(await call('/')).text(),/Борминцева|катя-interview|gameContent/);
assert.equal((await call('/sasha-assets/voting.js')).status,401);
for(const path of ['/sasha-assets/prank-intro.js','/sasha-assets/prank-intro.css','/sasha-assets/bormintseva.jpg','/sasha-assets/hotels-not-banners.png','/sasha-assets/app-home.jpg'])assert.equal((await call(path)).status,401);
const voter='test-voter-123456789';
const login={username:'sasha',password:testPassword,voter_id:voter,name:'Проверка'};
assert.equal((await call('/api/login',{method:'POST',body:{...login,password:'wrong'}})).status,401);
assert.equal((await call('/api/login',{method:'POST',body:login,originOverride:'https://evil.test'})).status,403);
const r=await call('/api/login',{method:'POST',body:login});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
assert.equal((await call('/api/session',{cookie})).status,200);assert.equal((await (await call('/api/session',{cookie})).json()).name,'Проверка');
const game=await(await call('/',{cookie})).text();assert.match(game,/gameContent/);assert.match(game,/timeline/);assert.doesNotMatch(game,/trader-signal|ios-simulator|head-mobile-platform/);
assert.equal((await call('/sasha-assets/voting.js',{cookie})).status,404);
assert.equal((await call('/sasha-assets/voting.css',{cookie})).status,404);
assert.doesNotMatch(game,/SashaVoting|sasha-assets\/voting\.|Оценить вопросы|Оценить все вопросы|Сохранить комментарий|startQuestions/);
for(const query of ['?review=1','?results=1','?start=questions']){const redirect=await call('/'+query,{cookie});assert.equal(redirect.status,303);assert.equal(redirect.headers.get('Location'),origin+'/');}
assert.match(game,/sasha-assets\/prank-intro.js/);
const photo=await call('/sasha-assets/bormintseva.jpg',{cookie});assert.equal(photo.status,200);assert.equal(photo.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),await fs.readFile('../sasha-game/sasha-assets/bormintseva.jpg'));
const screenshot=await call('/sasha-assets/hotels-not-banners.png',{cookie});assert.equal(screenshot.status,200);assert.equal(screenshot.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await screenshot.arrayBuffer()),await fs.readFile('../sasha-game/sasha-assets/hotels-not-banners.png'));
const appScreen=await call('/sasha-assets/app-home.jpg',{cookie});assert.equal(appScreen.status,200);assert.equal(appScreen.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(Buffer.from(await appScreen.arrayBuffer()),await fs.readFile('../sasha-game/sasha-assets/app-home.jpg'));
const bannerCatalog={};vm.runInNewContext(await fs.readFile('../sasha-game/ad-art.js','utf8'),bannerCatalog);assert.equal(bannerCatalog.SashaAds.length,19);
for(const {src} of bannerCatalog.SashaAds){assert.equal((await call(src)).status,401);const image=await call(src,{cookie});assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(Buffer.from(await image.arrayBuffer()),await fs.readFile('../sasha-game'+src));}
const prank=await(await call('/sasha-assets/prank-intro.js',{cookie})).text();assert.match(prank,/Идите нахуй со своими настолками/);assert.doesNotMatch(prank,/пиздабол|Шорткат|prank-shortcut|startQuestions|start.*questions/i);new vm.Script(prank);
assert.equal((await call('/',{cookie:cookie+'bad'})).status,200);assert.match(await(await call('/',{cookie:cookie+'bad'})).text(),/id="login"/);
const registry=JSON.parse(await fs.readFile('../sasha-game/registry.json','utf8'));const [question_id,revision]=Object.entries(registry)[0];const vote={campaign:'sasha-jokes-2026-11',question_id,revision,vote:1,comment:'Тест'};
sql.prepare('INSERT INTO votes (campaign,voter_id,question_id,revision,vote,name,comment,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(vote.campaign,voter,question_id,revision,1,'Архив','Сохранённый комментарий','2026-11-26T10:00:00Z','2026-11-26T10:00:00Z');
assert.equal((await call('/api/vote',{method:'POST',body:vote})).status,410);
assert.equal((await call('/api/vote',{method:'POST',body:{...vote,revision:'stale'},cookie})).status,410);
assert.equal((await call('/api/vote',{method:'POST',body:{...vote,vote:0},cookie})).status,410);
assert.equal((await call('/api/admin/clear-my-votes',{method:'POST',body:{},cookie,key:secrets.ADMIN_KEY})).status,410);
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM votes').get().n,1);assert.equal(sql.prepare('SELECT vote FROM votes').get().vote,1);assert.equal(sql.prepare('SELECT comment FROM votes').get().comment,'Сохранённый комментарий');
assert.equal((await call('/api/admin/export',{cookie})).status,401);
assert.equal((await call('/api/admin/export',{key:secrets.ADMIN_KEY})).status,401);
assert.equal((await call('/api/admin/export',{key:secrets.ADMIN_KEY,cookie})).status,200);
const archived=await(await call('/api/admin/export',{key:secrets.ADMIN_KEY,cookie})).json();assert.equal(archived.votes[0].comment,'Сохранённый комментарий');
assert.match((await call('/api/logout',{method:'POST',body:{},cookie})).headers.get('set-cookie'),/Max-Age=0/);
const scripts=[...game.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let reached=new Set(),endings=new Set();
for(let trial=0;trial<500;trial++){
 const sandbox={Math,sessionStorage:{getItem(){return null},setItem(){}}};vm.createContext(sandbox);for(let i=0;i<3;i++)vm.runInContext(scripts[i],sandbox);
 const c=sandbox.gameContent,g=sandbox.createGame(c);assert.equal(Object.keys(c.scenes).length,35);assert.equal(c.rounds.length,35);let run=g.initial();
 for(const [id,s] of Object.entries(c.scenes)){const hash=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(registry[hash(id).slice(0,24)],hash(JSON.stringify({title:s.title,body:s.body,choices:s.choices.map(choice=>[choice.id,choice.text,choice.result]),fact:s.fact})).slice(0,16));assert(['slack','owner'].includes(s.source.kind));}
 while(g.current(run)){const scene=g.current(run);reached.add(scene.id);assert(scene.choices.length>=2);for(const choice of scene.choices){assert(choice.result);assert(choice.text);}const allowed=scene.choices.filter(choice=>g.canChoose(run,choice.id)&&!choice.specialEnding);assert(allowed.length);const choice=allowed[Math.floor(Math.random()*allowed.length)];run=g.act(run,choice.id);for(const v of Object.values(run.stats))assert(v>=0&&v<=100);}
 assert.equal(run.moves.length,35);assert(g.finish(run));endings.add(g.finish(run).id);assert.equal(g.restore(g.encode(run)).moves.length,35);assert.equal(g.rewind(run,3).moves.length,3);
}
assert.equal(reached.size,35);console.log(JSON.stringify({backend:'passed',sessions:500,reachableScenes:reached.size,endings:[...endings]}));
