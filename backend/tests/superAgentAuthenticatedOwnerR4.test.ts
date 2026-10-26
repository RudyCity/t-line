import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {afterEach,describe,it,expect} from "vitest";
import {verifyAuthenticatedExternalCoreOwner}
 from "../src/superAgentCoreOwnership";

const old=process.env.TLINE_SUPERAGENT_OWNER_MODE;
afterEach(()=>{
 if(old===undefined)delete process.env.TLINE_SUPERAGENT_OWNER_MODE;
 else process.env.TLINE_SUPERAGENT_OWNER_MODE=old;
});
async function serverFor(statusBody:()=>unknown,token:string){
 const server=http.createServer((req,res)=>{
   if(req.method!=="GET"||req.url!=="/status"||
      req.headers.authorization!=="Bearer "+token){
      res.writeHead(401);res.end();return;
   }
   res.writeHead(200,{"Content-Type":"application/json"});
   res.end(JSON.stringify(statusBody()));
 });
 await new Promise<void>((resolve,reject)=>{
   server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const a=server.address();
 if(!a||typeof a==="string")throw Error("Missing local control port");
 return {server,port:a.port};
}
describe("R4 private control-plane attestation (read-only)",()=>{
 it("requires authenticated GET /status and matching generation identity",async()=>{
  process.env.TLINE_SUPERAGENT_OWNER_MODE="supervised-external";
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4-control-owner-"));
  const publicPort=58991,pid=24501,token="a".repeat(64);
  let identity={publicPort,supervisorPid:pid,active:{pid:24502},
    ownerContract:{version:1,role:"core-supervisor",
      mcpLifecycle:"not-owned",replayPolicy:"explicit-resume-only"}};
  const control=await serverFor(()=>identity,token);
  try{
    const file=path.join(root,"core-supervisor-"+publicPort+".json");
    fs.writeFileSync(file,JSON.stringify({
      publicPort,supervisorPid:pid,
      controlPort:control.port,controlToken:token,
    }));
    expect(await verifyAuthenticatedExternalCoreOwner(publicPort,root,pid)).toBe(true);
    identity={...identity,supervisorPid:24503};
    expect(await verifyAuthenticatedExternalCoreOwner(publicPort,root,pid)).toBe(false);
    identity={...identity,supervisorPid:pid,active:{pid:0}};
    expect(await verifyAuthenticatedExternalCoreOwner(publicPort,root,pid)).toBe(false);
    identity={...identity,active:{pid:24502}};
    expect(await verifyAuthenticatedExternalCoreOwner(publicPort,root,24504)).toBe(false);
    identity={...identity,ownerContract:{...identity.ownerContract,
      mcpLifecycle:"shared"}};
    expect(await verifyAuthenticatedExternalCoreOwner(publicPort,root,pid)).toBe(false);
    identity={...identity,ownerContract:{...identity.ownerContract,
      mcpLifecycle:"not-owned",version:2}};
    expect(await verifyAuthenticatedExternalCoreOwner(publicPort,root,pid)).toBe(false);
    identity={...identity,ownerContract:{...identity.ownerContract,
      version:1,replayPolicy:"auto-replay"}};
    expect(await verifyAuthenticatedExternalCoreOwner(publicPort,root,pid)).toBe(false);
    identity={...identity,ownerContract:{version:1,role:"core-supervisor",
      mcpLifecycle:"not-owned",replayPolicy:"explicit-resume-only"}};
    expect(await verifyAuthenticatedExternalCoreOwner(publicPort,root,pid)).toBe(true);
    fs.writeFileSync(file,JSON.stringify({
      publicPort,supervisorPid:pid,
      controlPort:control.port,controlToken:"b".repeat(64),
    }));
    expect(await verifyAuthenticatedExternalCoreOwner(publicPort,root,pid)).toBe(false);
  } finally {
    await new Promise<void>((resolve,reject)=>
      control.server.close(err=>err?reject(err):resolve()));
    fs.rmSync(root,{recursive:true,force:true});
  }
 });
 it("never accepts a state file without private control-plane proof",async()=>{
  process.env.TLINE_SUPERAGENT_OWNER_MODE="supervised-external";
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4-unverified-owner-"));
  try{
    fs.writeFileSync(path.join(root,"core-supervisor-58993.json"),
      JSON.stringify({publicPort:58993,supervisorPid:12345}));
    expect(await verifyAuthenticatedExternalCoreOwner(58993,root,12345)).toBe(false);
    expect(await verifyAuthenticatedExternalCoreOwner(58993,root,null)).toBe(false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
 });
});
