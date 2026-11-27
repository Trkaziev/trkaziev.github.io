// Server-side password gate. Game assets are encrypted in the source repository.
import registry from './registry.js';
import assets from './assets.js';
import { loginPage } from './login.js';
const CAMPAIGN='sasha-jokes-2026-11';
const enc=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async text=>hex(await crypto.subtle.digest('SHA-256',enc.encode(text)));
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
async function hmac(secret,text){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,enc.encode(text)));}
const tokenBody=p=>btoa(String.fromCharCode(...enc.encode(JSON.stringify(p)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function verify(request,env){const token=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sasha_session='))?.slice(14)||'';const [body,sig,...rest]=token.split('.');if(!body||!sig||rest.length||!equal(sig,await hmac(env.SESSION_SECRET,body)))fail(401,'Войди с логином и паролем');let p;try{p=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body.replaceAll('-','+').replaceAll('_','/')),x=>x.charCodeAt(0))));}catch{fail(401,'Неверная сессия');}if(p.exp<Date.now()||p.campaign!==CAMPAIGN||!/^[-a-zA-Z0-9]{16,64}$/.test(p.voter_id))fail(401,'Сессия истекла');return p;}
async function passwordHash(password,salt){const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},material,256));}
const decrypted=new Map();
async function asset(path,env,headers){if(!decrypted.has(path)){const value=assets[path];const bytes=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('raw',Uint8Array.from((env.CONTENT_KEY_V3||env.CONTENT_KEY_V2||env.CONTENT_KEY).match(/../g),x=>parseInt(x,16)),{name:'AES-GCM'},false,['decrypt']);decrypted.set(path,await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(value.iv)},key,bytes(value.data)));}return new Response(decrypted.get(path).slice(0),{headers:{...headers,'Content-Type':assets[path].type}});}
async function json(request){const declared=Number(request.headers.get('Content-Length')||0);if(declared>4096)fail(413,'Слишком большой запрос');const reader=request.body?.getReader();if(!reader)fail(400,'Ожидается JSON');let size=0,chunks=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();fail(413,'Слишком большой запрос');}chunks.push(value);}const bytes=new Uint8Array(size);let i=0;for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'Неверный JSON');}}
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin');
    const allowed=origin===new URL(request.url).origin;
    const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie'};
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    try{
      if(origin&&!allowed)fail(403,'Этот источник не разрешён');
      if(request.method==='POST'&&!origin)fail(403,'Отсутствует источник запроса');
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      const path=new URL(request.url).pathname;
      if(request.method==='GET'&&path==='/api/health')return reply({ok:true,service:'invitation-only-rating-api'});
      if(!env.DB||!env.LOGIN_PASSWORD_HASH||!env.LOGIN_SALT||!env.SESSION_SECRET||!env.ADMIN_SHA256||!env.CONTENT_KEY)fail(503,'Сервис ещё настраивается');
      if(request.method==='POST'&&path==='/api/login'){
        const p=await json(request);
        const client=await digest((request.headers.get('CF-Connecting-IP')||request.headers.get('X-Real-IP')||'unknown')+env.LOGIN_SALT);
        const window=Math.floor(Date.now()/600000);
        const attempts=await env.DB.prepare('INSERT INTO login_limits(client,window,attempts) VALUES (?,?,1) ON CONFLICT(client) DO UPDATE SET window=excluded.window,attempts=CASE WHEN login_limits.window=excluded.window THEN login_limits.attempts+1 ELSE 1 END RETURNING attempts').bind(client,window).first();
        if(attempts.attempts>15)fail(429,'Слишком много попыток. Попробуй через 10 минут.');
        if(typeof p.password!=='string'||p.password.length>128||!equal(await passwordHash(p.password,env.LOGIN_SALT),env.LOGIN_PASSWORD_HASH)||p.username!==env.LOGIN_USERNAME)fail(401,'Неверный логин или пароль');
        if(!/^[-a-zA-Z0-9]{16,64}$/.test(p.voter_id||''))fail(400,'Неверные параметры');
        const name=typeof p.name==='string'?p.name.trim().slice(0,40):'';
        const body=tokenBody({voter_id:p.voter_id,name,campaign:CAMPAIGN,exp:Date.now()+7*86400000});
        await env.DB.prepare('DELETE FROM login_limits WHERE client=? OR window<?').bind(client,window-2).run();
        return new Response(JSON.stringify({ok:true}),{headers:{...headers,'Set-Cookie':'sasha_session='+body+'.'+await hmac(env.SESSION_SECRET,body)+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800'}});
      }
      if(request.method==='POST'&&path==='/api/logout')return new Response(JSON.stringify({ok:true}),{headers:{...headers,'Set-Cookie':'sasha_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'}});
      if(request.method==='GET'&&(path==='/'||path==='/sasha-est-minutka.html')){try{await verify(request,env);}catch{return new Response(loginPage,{headers:{...headers,'Content-Type':'text/html;charset=utf-8'}});}return asset('/',env,headers);}
      const user=await verify(request,env);
      if(request.method==='GET'&&path==='/api/session')return reply({ok:true,name:user.name,voter_id:user.voter_id});
      if(request.method==='GET'&&Object.hasOwn(assets,path))return asset(path,env,headers);
      if(request.method==='POST'&&path==='/api/vote'){
        const p=await json(request);
        if(p.campaign!==CAMPAIGN||!Object.hasOwn(registry,p.question_id)||registry[p.question_id]!==p.revision||(p.vote!==0&&p.vote!==1)||typeof p.comment!=='string'||p.comment.length>500)fail(400,'Вопрос изменился или оценка некорректна. Обнови страницу.');
        // One record per browser, question and exact revision; retry/change replaces it.
        const now=new Date().toISOString();
        const recent=await env.DB.prepare('SELECT updated_at FROM votes WHERE campaign = ? AND voter_id = ? ORDER BY updated_at DESC LIMIT 1').bind(CAMPAIGN,user.voter_id).first();
        if(recent&&Date.now()-Date.parse(recent.updated_at)<500)fail(429,'Подожди секунду и попробуй снова');
        await env.DB.prepare('INSERT INTO votes (campaign,voter_id,question_id,revision,vote,name,comment,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign,voter_id,question_id,revision) DO UPDATE SET vote=excluded.vote,name=excluded.name,comment=excluded.comment,updated_at=excluded.updated_at').bind(CAMPAIGN,user.voter_id,p.question_id,p.revision,p.vote,user.name,p.comment.trim(),now,now).run();
        return reply({saved:true,updated_at:now});
      }
      if(request.method==='GET'&&path==='/api/admin/export'){
        const key=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
        if(!key||!equal(await digest(key),env.ADMIN_SHA256))fail(401,'Неверный ключ владельца');
        const {results}=await env.DB.prepare('SELECT campaign,voter_id,question_id,revision,vote,name,comment,created_at,updated_at FROM votes WHERE campaign = ? ORDER BY updated_at LIMIT 20001').bind(CAMPAIGN).all();
        if(results.length>20000)fail(413,'Для большого экспорта используйте доступ владельца к БД');
        return reply({campaign:CAMPAIGN,votes:results});
      }
      if(request.method==='POST'&&path==='/api/admin/clear-my-votes'){
        const key=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
        if(!key||!equal(await digest(key),env.ADMIN_SHA256))fail(401,'Неверный ключ владельца');
        await env.DB.prepare('DELETE FROM votes WHERE campaign=? AND voter_id=?').bind(CAMPAIGN,user.voter_id).run();
        return reply({cleared:true});
      }
      return reply({error:'Not found'},404);
    }catch(e){return reply({error:e.status?e.message:'Сбой сохранения. Попробуй ещё раз.'},e.status||500);}
  }
};
