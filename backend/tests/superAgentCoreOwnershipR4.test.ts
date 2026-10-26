import {afterEach,describe,expect,it} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {resolveCoreOwnershipMode,verifyExternalCoreOwner,
  readWindowsTcpListenerPid} from "../src/superAgentCoreOwnership";
const oldMode=process.env.TLINE_SUPERAGENT_OWNER_MODE;
afterEach(()=>{
 if(oldMode===undefined)delete process.env.TLINE_SUPERAGENT_OWNER_MODE;
 else process.env.TLINE_SUPERAGENT_OWNER_MODE=oldMode;
});
describe("R4 verified external Core routing",()=>{
 it("uses legacy by default and needs explicit non-legacy supervised port",()=>{
  delete process.env.TLINE_SUPERAGENT_OWNER_MODE;
  expect(resolveCoreOwnershipMode(undefined,7888)).toBe("legacy");
  expect(resolveCoreOwnershipMode("supervised-external",7899)).toBe("supervised-external");
  expect(()=>resolveCoreOwnershipMode("supervised-external",7888)).toThrow();
  expect(()=>resolveCoreOwnershipMode("external",7899)).toThrow();
 });
 it("requires supervisor record plus matching live OS listener PID",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"tline-core-owner-"));
  process.env.TLINE_SUPERAGENT_OWNER_MODE="supervised-external";
  try{
   const file=path.join(dir,"core-supervisor-7899.json");
   fs.writeFileSync(file,JSON.stringify({publicPort:7899,supervisorPid:4321}));
   expect(verifyExternalCoreOwner(7899,dir,4321)).toBe(true);
   expect(verifyExternalCoreOwner(7899,dir,4322)).toBe(false);
   fs.writeFileSync(file,JSON.stringify({publicPort:7888,supervisorPid:4321}));
   expect(verifyExternalCoreOwner(7899,dir,4321)).toBe(false);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 });
 it("does not treat an absent kernel TCP owner as proof",()=>{
  process.env.TLINE_SUPERAGENT_OWNER_MODE="supervised-external";
  expect(verifyExternalCoreOwner(7899,os.tmpdir(),null)).toBe(false);
  if(process.platform!=="win32")expect(readWindowsTcpListenerPid(7899)).toBeNull();
 });
});
