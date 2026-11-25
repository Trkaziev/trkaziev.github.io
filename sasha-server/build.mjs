import fs from 'node:fs/promises';
const manifest=JSON.parse(await fs.readFile('.openai/hosting.json','utf8'));
// A D1 logical binding is provisioned by Sites. No runtime schema creation.
manifest.d1='DB';manifest.r2=null;
await fs.writeFile('.openai/hosting.json',JSON.stringify(manifest,null,2));
let registry; try { registry=JSON.parse(await fs.readFile('../sasha-game/registry.json','utf8')); } catch { registry=(await import('./worker/registry.js')).default; }
await fs.writeFile('worker/registry.js','export default '+JSON.stringify(registry)+';\n');
const source=await fs.readFile('worker/index.js','utf8');
const assets=await fs.readFile('worker/assets.js','utf8');
const login=await fs.readFile('worker/login.js','utf8');
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
// Bundle this dependency-free worker deterministically.
await fs.writeFile('dist/server/index.js',source.replace("import registry from './registry.js';",'const registry = '+JSON.stringify(registry)+';').replace("import assets from './assets.js';",assets.replace('export default','const assets =')).replace("import { loginPage } from './login.js';",login.replace('export const','const')));
await fs.writeFile('dist/.openai/hosting.json',JSON.stringify(manifest,null,2));
console.log('Built invitation-only voting API');
