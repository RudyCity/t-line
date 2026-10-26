import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCoreApprovals } from '../CoreApprovalStatusApi';
afterEach(() => vi.unstubAllGlobals());
const allowed = {success:true,sessionId:'sess_1',approvals:[
  {permissionId:'p_one',state:'pending',requestedAt:1,updatedAt:1,expiresAt:10},
  {permissionId:'p_two',state:'expired',requestedAt:1,updatedAt:11,expiresAt:10},
  {permissionId:'p_cancel',state:'cancelled',requestedAt:1,updatedAt:11,expiresAt:10},
]};
describe('read-only approval state recovery',()=>{
  it('reads exact authenticated scope without replaying decision',async()=>{
    const request=vi.fn(async()=>({ok:true,json:async()=>allowed}));
    vi.stubGlobal('fetch',request);
    expect((await listCoreApprovals('D:/p','sess_1',()=>({Authorization:'Bearer test'}))).map(a=>a.state))
      .toEqual(['pending','expired','cancelled']);
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('sessionId=sess_1');
    expect(init.method).toBeUndefined();
  });
  it('rejects cross-session and bogus approval records',async()=>{
    for(const payload of [
      {...allowed,sessionId:'other'},
      {...allowed,approvals:[{...allowed.approvals[0],state:'approved_by_user_fake'}]},
    ]) {
      vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>payload})));
      await expect(listCoreApprovals('D:/p','sess_1',()=>({}))).rejects.toThrow();
    }
  });
});
