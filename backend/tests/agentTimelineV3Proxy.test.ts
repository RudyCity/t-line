import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createAgentTimelineStreamProxy } from '../src/agentTimelineStreamProxy';
import { createApprovalStatusProxy } from '../src/approvalStatusProxy';
const closing:Array<() => Promise<void>>=[];
afterEach(async()=>{ for (const close of closing.splice(0).reverse()) await close(); });
async function listen(handler:http.RequestListener) {
  const server=http.createServer(handler);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  closing.push(()=>new Promise(resolve=>server.close(()=>resolve())));
  const address=server.address();
  if (!address || typeof address==='string') throw Error('Port missing');
  return address.port;
}
async function fixture(identity:{role?:string;source?:string}) {
  const records:Array<{url:string;headers:http.IncomingHttpHeaders;method:string}>=[];
  const port=await listen((req,res)=>{
    records.push({url:req.url||'',headers:req.headers,method:req.method||''});
    if (req.url?.startsWith('/api/tline/agent-timeline/stream')) {
      res.writeHead(200,{'Content-Type':'text/event-stream'});
      res.end('id: 1\ndata: {"seq":1,"at":1792960000001,"actor":"main","kind":"tool_start","tool":"read_files"}\n\n');
    } else {
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({success:true,sessionId:'sess_1',approvals:[
        {permissionId:'perm_one',state:'pending',requestedAt:1,updatedAt:1,expiresAt:100}
      ]}));
    }
  });
  const app=express();
  app.use((req,_res,next)=>{(req as any).user=identity;next()});
  app.use('/stream',createAgentTimelineStreamProxy({
    port,getServiceHeaders:()=>({Authorization:'Bearer core-test'}),
  }));
  app.use('/approvals',createApprovalStatusProxy({
    port,getServiceHeaders:()=>({Authorization:'Bearer core-test'}),
  }));
  const frontend=await listen(app);
  return {base:'http://127.0.0.1:'+frontend,records};
}
describe('Core SSE and approval status fixed proxies',()=>{
  it('streams metadata only with exact owner workspace/session headers',async()=>{
    const {base,records}=await fixture({role:'admin'});
    const q='?workspace=D%3A%2Fproject&sessionId=sess_1&cursor=0';
    const response=await fetch(base+'/stream'+q);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(await response.text()).toContain('id: 1');
    expect(records).toHaveLength(1);
    expect(records[0].url).toContain('/api/tline/agent-timeline/stream?');
    expect(records[0].headers.authorization).toBe('Bearer core-test');
    expect(records[0].headers['x-client-mode']).toBe('tline');
    expect(records[0].headers['x-workspace-path']).toBe('D:/project');
    expect(records[0].method).toBe('GET');
  });
  it('provides approval status via read-only route and denies unscoped/mutating requests',async()=>{
    const {base,records}=await fixture({source:'local'});
    const q='?workspace=D%3A%2Fproject&sessionId=sess_1';
    const status=await fetch(base+'/approvals'+q);
    expect(status.status).toBe(200);
    expect((await status.json()).approvals[0].state).toBe('pending');
    expect((await fetch(base+'/stream'+q+'&cursor=oops')).status).toBe(400);
    expect((await fetch(base+'/approvals'+q,{method:'POST'})).status).toBe(404);
    expect(records).toHaveLength(1);
    const rejected=await fixture({role:'viewer'});
    expect((await fetch(rejected.base+'/approvals'+q)).status).toBe(403);
    expect((await fetch(rejected.base+'/stream'+q+'&cursor=0')).status).toBe(403);
    expect(rejected.records).toHaveLength(0);
  });
});
