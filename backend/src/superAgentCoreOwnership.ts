import {resolveSuperAgentCorePort} from "./superAgentCorePort";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import http from "node:http";
export type CoreOwnershipMode="legacy"|"supervised-external";
export function resolveCoreOwnershipMode(
 raw=process.env.TLINE_SUPERAGENT_OWNER_MODE,
 port=resolveSuperAgentCorePort(),
):CoreOwnershipMode{
 if(!raw || raw==="legacy")return "legacy";
 if(raw!=="supervised-external"||port===7888)
  throw new Error("External supervised Core requires explicit separate non-legacy port");
 return "supervised-external";
}
export function readWindowsTcpListenerPid(port:number,output?:string):number|null{
 if(process.platform!=="win32")return null;
 try{
  const raw=output??execFileSync("netstat.exe",["-ano","-p","TCP"],{
    encoding:"utf8",timeout:3500,maxBuffer:2*1024*1024,windowsHide:true,
  });
  const matches=raw.split(/\r?\n/).map(s=>s.trim().split(/\s+/))
    .filter(c=>c[0]==="TCP"&&c[3]==="LISTENING"&&
      c[1]?.endsWith(":"+port));
  if(matches.length!==1)return null;
  const pid=Number(matches[0][4]);
  return Number.isSafeInteger(pid)&&pid>0?pid:null;
 }catch{return null;}
}
export function verifyExternalCoreOwner(
 port=resolveSuperAgentCorePort(),configRoot=process.env.SUPERAGENT_CONFIG_DIR?.trim()
  ?path.resolve(process.env.SUPERAGENT_CONFIG_DIR):path.join(os.homedir(),".superagent-r"),
 kernelPid=readWindowsTcpListenerPid(port),
):boolean{
 if(resolveCoreOwnershipMode(undefined,port)!=="supervised-external"||kernelPid===null)return false;
 try{
  const file=path.join(configRoot,"core-supervisor-"+port+".json");
  const s=fs.lstatSync(file);
  if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>8192)return false;
  const d=JSON.parse(fs.readFileSync(file,"utf8")) as {
    publicPort?:number;supervisorPid?:number;
  };
  return d.publicPort===port&&d.supervisorPid===kernelPid;
 }catch{return false;}
}

/**
 * R4: a matching PID file alone is not an authenticated supervisor.
 * Verify the private control-plane GET /status with its exact saved token
 * and compare the control response to the kernel-owned public listener.
 * Never send a POST, adopt a PID or start a process.
 */
export async function verifyAuthenticatedExternalCoreOwner(
 port=resolveSuperAgentCorePort(),
 configRoot=process.env.SUPERAGENT_CONFIG_DIR?.trim()
  ?path.resolve(process.env.SUPERAGENT_CONFIG_DIR):path.join(os.homedir(),".superagent-r"),
 kernelPid=readWindowsTcpListenerPid(port),
):Promise<boolean>{
 if(kernelPid===null||!verifyExternalCoreOwner(port,configRoot,kernelPid))return false;
 try {
  const file=path.join(configRoot,"core-supervisor-"+port+".json");
  const d=JSON.parse(fs.readFileSync(file,"utf8")) as {
    controlPort?:number;controlToken?:string;
  };
  if(!Number.isSafeInteger(d.controlPort)||!d.controlPort||
    d.controlPort<1024||d.controlPort>65535||d.controlPort===port||
    typeof d.controlToken!=="string"||!/^[a-f0-9]{64}$/.test(d.controlToken))
    return false;
  return await new Promise<boolean>(resolve=>{
   let finished=false;
   const done=(v:boolean)=>{if(!finished){finished=true;resolve(v)}};
   const req=http.request({hostname:"127.0.0.1",port:d.controlPort,
    method:"GET",path:"/status",timeout:1200,
    headers:{Authorization:"Bearer "+d.controlToken,Accept:"application/json"},
   },res=>{
    let body="";
    res.on("data",chunk=>{
      body+=String(chunk);
      if(body.length>4096){req.destroy();done(false)}
    });
    res.on("end",()=>{
      if(res.statusCode!==200)return done(false);
      try{
       const data=JSON.parse(body) as {
        publicPort?:number;supervisorPid?:number;active?:{pid?:number};
        ownerContract?: {
          version?:number;role?:string;mcpLifecycle?:string;
          replayPolicy?:string;
        };
       };
       const contract=data.ownerContract;
       done(data.publicPort===port&&data.supervisorPid===kernelPid&&
        typeof data.active?.pid==="number"&&data.active.pid>0&&
        contract?.version===1&&contract.role==="core-supervisor"&&
        contract.mcpLifecycle==="not-owned"&&
        contract.replayPolicy==="explicit-resume-only");
      }catch{done(false)}
    });
   });
   req.on("timeout",()=>req.destroy());
   req.on("error",()=>done(false));
   req.end();
  });
 }catch{return false}
}
