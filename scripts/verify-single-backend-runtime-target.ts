/**
 * Real Windows-only, short-lived SuperAgent Core staging acceptance through the
 * actual T-Line backend port/owner/auth probe. No second T-Line backend, no
 * public tunnel and no live Core/MCP listener is touched. Always cleans up.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import {resolveRuntimeTarget} from '../backend/src/superAgentRuntimeTarget';
import {probeSuperAgentPort} from '../backend/src/superAgentPortProbe';
import {readWindowsTcpListenerPid} from '../backend/src/superAgentCoreOwnership';

if(process.platform!=='win32')throw Error('Real owner proof requires Windows kernel TCP inventory');
const repo=path.resolve(import.meta.dir,'..');
const sa=path.resolve(process.env.SUPERAGENT_REPO || path.join(repo,'..','superagent'));
const cli=path.join(sa,'dist','cli.js');
if(!fs.existsSync(cli))throw Error('Build the independent SuperAgent CLI first');
const stageRoot=path.join(os.homedir(),'.superagent-local-staging');
fs.mkdirSync(stageRoot,{recursive:true,mode:0o700});
const profile=fs.mkdtempSync(path.join(stageRoot,'tline-single-backend-'));
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const legacy=[6759,6789,7888,9877] as const;
const baseline=legacy.map(port=>[port,readWindowsTcpListenerPid(port)] as const);
async function freePort():Promise<number>{
 const server=net.createServer();
 return await new Promise<number>((resolve,reject)=>{
   server.once('error',reject);
   server.listen(0,'127.0.0.1',()=>{
     const a=server.address();
     server.close(()=>a&&typeof a!=='string'?resolve(a.port):reject(Error('No port')));
   });
 });
}
let port=await freePort();
while(legacy.includes(port as (typeof legacy)[number])||port===7892)port=await freePort();
const saved:Record<string,string|undefined>={};
for(const key of ['TLINE_SUPERAGENT_RUNTIME','TLINE_SUPERAGENT_CORE_PORT',
 'TLINE_SUPERAGENT_OWNER_MODE','SUPERAGENT_CONFIG_DIR'])saved[key]=process.env[key];
process.env.TLINE_SUPERAGENT_RUNTIME='testing';
process.env.TLINE_SUPERAGENT_CORE_PORT=String(port);
process.env.TLINE_SUPERAGENT_OWNER_MODE='supervised-external';
process.env.SUPERAGENT_CONFIG_DIR=profile;
const env={...process.env,SUPERAGENT_CONFIG_DIR:profile,
 SUPERAGENT_CORE_STAGING:'1',SUPERAGENT_SENOPATI_AUTOSTART:'0'};
for(const key of Object.keys(env))if(/_KEY|_TOKEN|_PASSWORD|_SECRET|_CREDENTIAL|MUSE|TELEGRAM|CLOUDFLARE|OPENROUTER|OPENAI_MCP|TUNNEL/i.test(key))delete env[key];
let core:ChildProcess|undefined;
const checks:string[]=[];
const check=(name:string,ok:unknown)=>{
 if(!ok)throw Error('Single-backend stage failed: '+name);
 checks.push(name);
};
try{
  const target=resolveRuntimeTarget();
  check('one_existing_tline_backend_only',target.backendCount===1);
  check('testing_target_is_explicit_nonlegacy',target.selected==='testing'&&
   target.corePort===port&&target.autoStartCoreAllowed===false);
  check('testing_unavailable_never_spawns_core',await probeSuperAgentPort(port)==='occupied');
  core=spawn(process.execPath,[cli,'core','start','--port',String(port)],{
    cwd:sa,env,windowsHide:true,stdio:'ignore'
  });
  if(!core.pid)throw Error('Test-owned stage Core failed to spawn');
  let ready=false;
  for(let i=0;i<150;i++){
    if(core.exitCode!==null)break;
    if(readWindowsTcpListenerPid(port)===core.pid &&
       await probeSuperAgentPort(port)==='compatible'){ready=true;break;}
    await sleep(180);
  }
  check('tline_verified_real_stage_core_owner',ready);
  check('tline_auth_and_owner_unchanged_across_reprobe',
    await probeSuperAgentPort(port)==='compatible'&&
    readWindowsTcpListenerPid(port)===core.pid);
  process.env.SUPERAGENT_CONFIG_DIR=os.homedir();
  check('foreign_profile_not_adopted',await probeSuperAgentPort(port)==='occupied');
  process.env.SUPERAGENT_CONFIG_DIR=profile;
  check('verified_profile_restores_connectivity',
    await probeSuperAgentPort(port)==='compatible');
  check('staging_cannot_target_primary_core',
    await probeSuperAgentPort(7888,{})==='occupied');
  check('legacy_core_and_mcp_unchanged',
    baseline.every(([p,pid])=>readWindowsTcpListenerPid(p)===pid));
  console.log(JSON.stringify({
    ok:true,checks,verifiedChecks:checks.length,stagePort:port,
    testOwnedCorePid:core.pid,tlineBackendInstancesLaunched:0,
    productionTouched:false,publicTunnelCreated:false
  },null,2));
}catch(error){
 console.error('RUNTIME_TARGET_STAGE_FAILED',String(error));
 process.exitCode=1;
}finally{
 if(core?.pid&&core.exitCode===null){
   if(readWindowsTcpListenerPid(port)===core.pid){
     spawnSync('taskkill',['/T','/F','/PID',String(core.pid)],{
       windowsHide:true,timeout:8000,stdio:'ignore'
     });
   }else if(readWindowsTcpListenerPid(port)!==null){
     console.error('Refusing to stop unverified stage owner');
     process.exitCode=1;
   }
 }
 for(let i=0;i<30&&readWindowsTcpListenerPid(port)!==null;i++)await sleep(200);
 if(readWindowsTcpListenerPid(port)!==null){
   console.error('Stage port not released; manual ownership review required');
   process.exitCode=1;
 }
 for(const [key,value] of Object.entries(saved)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
 // Retain the private stage evidence on failure. Only remove fresh
 // test-controlled config when all listeners are gone and tests passed.
 if(!process.exitCode)fs.rmSync(profile,{recursive:true,force:true});
}
