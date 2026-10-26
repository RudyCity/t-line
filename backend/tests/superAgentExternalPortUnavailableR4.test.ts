import {afterEach,describe,expect,it} from "vitest";
import {probeSuperAgentPort} from "../src/superAgentPortProbe";

const previous=process.env.TLINE_SUPERAGENT_OWNER_MODE;
afterEach(()=>{
  if(previous===undefined)delete process.env.TLINE_SUPERAGENT_OWNER_MODE;
  else process.env.TLINE_SUPERAGENT_OWNER_MODE=previous;
});
describe("R4 external Core port never becomes a spawn candidate",()=>{
  it("classifies unavailable non-legacy external port as occupied (fail closed)",async()=>{
    process.env.TLINE_SUPERAGENT_OWNER_MODE="supervised-external";
    // Arbitrary high test port: whether unused or bound to an unverified
    // process, the only safe classification is 'occupied'.
    expect(await probeSuperAgentPort(59731,{})).toBe("occupied");
  });
  it("refuses legacy 7888 in supervised mode without probing or spawning",async()=>{
    process.env.TLINE_SUPERAGENT_OWNER_MODE="supervised-external";
    expect(await probeSuperAgentPort(7888,{})).toBe("occupied");
  });
});
