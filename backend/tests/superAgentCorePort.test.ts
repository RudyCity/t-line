import {afterEach,describe,expect,it} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {resolveSuperAgentCorePort} from "../src/superAgentCorePort";
import {readSuperAgentServiceToken} from "../src/superAgentAuth";
import {forceKillPort7888} from "../src/superAgentBridge";

const original=process.env.TLINE_SUPERAGENT_CORE_PORT;
afterEach(()=>{
  if(original===undefined)delete process.env.TLINE_SUPERAGENT_CORE_PORT;
  else process.env.TLINE_SUPERAGENT_CORE_PORT=original;
});
describe("Core split transport port and owner safety",()=>{
  it("keeps old production port unchanged unless explicitly opted in",()=>{
    delete process.env.TLINE_SUPERAGENT_CORE_PORT;
    expect(resolveSuperAgentCorePort()).toBe(7888);
  });
  it("only accepts localhost TCP port numeric values",()=>{
    expect(resolveSuperAgentCorePort("7892")).toBe(7892);
    for(const bad of ["https://example.com","localhost:7892","0","80","65536",
      "-1","7892/mcp","7892?query"," 7892","7892 ","1e4"]){
      expect(()=>resolveSuperAgentCorePort(bad)).toThrow();
    }
  });
  it("does not mistake a different port discovery token for the configured Core",()=>{
    const home=fs.mkdtempSync(path.join(os.tmpdir(),"sa-tline-port-split-"));
    const info=path.join(home,"discovery.json");
    try{
      process.env.TLINE_SUPERAGENT_CORE_PORT="7892";
      fs.writeFileSync(info,JSON.stringify({port:7888,authToken:"a".repeat(48)}));
      expect(readSuperAgentServiceToken(info)).toBeNull();
      fs.writeFileSync(info,JSON.stringify({port:7892,authToken:"a".repeat(48)}));
      expect(readSuperAgentServiceToken(info)).toBe("a".repeat(48));
    } finally {fs.rmSync(home,{recursive:true,force:true});}
  });
  it("never kills a listener merely because it owns 7888",()=>{
    expect(()=>forceKillPort7888()).toThrow(/disabled/);
  });
});
