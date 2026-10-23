const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8').replace(/\r\n/g,'\n');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const tick=String.fromCharCode(96);
function check(value,message){if(!value)throw Error('T-Line README: '+message);}
function section(start,end){
 const a=readme.indexOf(start),b=readme.indexOf(end,a+start.length);
 check(a>=0&&b>=0,'missing section '+start);return readme.slice(a,b);
}
const install=section('## 🚀 Quick Start','## 📁 Repository Structure');
const structure=section('## 📁 Repository Structure','## 📝 Configuration & Integration Rules');
for(const key of ['dev','dev:backend','dev:frontend','dev:tauri','tauri','build:tauri']){
 check(typeof pkg.scripts?.[key]==='string','missing script '+key);
}
for(const cmd of [
 'https://github.com/RudyCity/t-line.git',
 'bun install --frozen-lockfile',
 'bun run dev:backend','bun run dev:frontend','bun run dev:tauri',
 'bun run tauri dev','bun run build:tauri',
 '1.4.2+',
 'dev.cjs'+tick+' forcibly terminates listeners'
]){
 check(install.includes(cmd),'install example missing: '+cmd);
}
check(!/github\.com\/your-username\/t-line|\bbun dev\b|\bsrc-tauri\/|Node\.js/.test(install+structure),'stale install and structure');
for(const d of ['desktop-tauri','backend','frontend']){
 check(fs.statSync(path.join(root,d)).isDirectory(),'missing workspace '+d);
}
check(structure.includes('desktop-tauri/'),'incorrect desktop directory');
const brain=section('## 🧠 SuperAgent Brain Explorer','## 🏗️ Architecture Overview');
for(const cmd of ['/brain','/scratch','Brain Explorer','CLI-only','bun scripts/check-brain-runtime.cjs','brainCommandSuggestions.json']){
 check(brain.includes(cmd),'missing Brain guidance '+cmd);
}
for(const m of brain.matchAll(/\]\(([^)]+)\)/g)){
 const dest=decodeURIComponent(m[1]).split('#')[0];
 if(!dest||/^(https?:|mailto:)/i.test(dest))continue;
 const f=path.resolve(root,dest);
 check(f.startsWith(root+path.sep)&&fs.existsSync(f),'broken Brain link '+dest);
}
check(fs.existsSync(path.join(root,'frontend/src/generated/brainCommandSuggestions.json')),'missing generated suggestions');
console.log('PASS T-Line README scripts, safe dev workflow, desktop paths and Brain links.');
