import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const key=process.env.CONTENT_KEY;
if(!key)throw Error('CONTENT_KEY required');
const assets={};
for(const [route,file,type] of [['/','../sasha-game/sasha-est-minutka.html','text/html;charset=utf-8'],['/sasha-assets/voting.js','../sasha-game/sasha-assets/voting.js','text/javascript;charset=utf-8'],['/sasha-assets/voting.css','../sasha-game/sasha-assets/voting.css','text/css;charset=utf-8']]) {
 const bytes=await fs.readFile(file);const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);const encrypted=Buffer.concat([cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);assets[route]={type,iv:iv.toString('base64'),data:encrypted.toString('base64')};
}
await fs.writeFile('worker/assets.js','export default '+JSON.stringify(assets)+';\n');
console.log('Encrypted game assets');
