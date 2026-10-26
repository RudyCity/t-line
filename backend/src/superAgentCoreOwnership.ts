import {resolveSuperAgentCorePort} from "./superAgentCorePort";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
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
