import { describe, expect, it, vi } from 'vitest';
import { getTaskCancelCapability, requestTaskCancellation } from '../SuperAgentTaskControls';
const payload = (body: any, status = 200): Response => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
}) as Response;
const base = { workspace: 'D:/scope', sessionId: 'sess_current', jobId: 'clj_1792480000000_deadbeef' };
const auth = () => ({ Authorization: 'Bearer frontend' });
describe('TLine explicitly opted-in cancellation workflow', () => {
  it('shows cancellation only if both POST actions are advertised', async () => {
    const manifest = { server: 'superagent', schemaVersion: 1, httpActions: [
      { id: 'tasks.cancel.prepare', method: 'POST', access: 'workspace-operator' },
      { id: 'tasks.cancel.confirm', method: 'POST', access: 'workspace-operator' },
    ] };
    const request = vi.fn().mockResolvedValue(payload(manifest));
    expect(await getTaskCancelCapability(base.workspace, auth, request)).toBe(true);
    request.mockResolvedValue(payload({ ...manifest, httpActions: manifest.httpActions.slice(0, 1) }));
    expect(await getTaskCancelCapability(base.workspace, auth, request)).toBe(false);
  });
  it('only confirms with a server-issued single-use grant for the exact job', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(payload({ success: true, jobId: base.jobId, challenge: 'f'.repeat(48) }))
      .mockResolvedValueOnce(payload({ success: true, jobId: base.jobId, requested: true }, 202));
    const output = await requestTaskCancellation(base.workspace, base.sessionId, base.jobId, auth, request);
    expect(output).toContain('Awaiting verified task exit');
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toContain('/cancel/prepare');
    expect(request.mock.calls[1][0]).toContain('/cancel/confirm');
    expect(JSON.parse(request.mock.calls[1][1].body).challenge).toBe('f'.repeat(48));
  });
  it('fails closed on wrong grant, 403 and forged task ID', async () => {
    const request = vi.fn().mockResolvedValue(payload({ success: true, jobId: base.jobId, challenge: 'bad' }));
    await expect(requestTaskCancellation(base.workspace, base.sessionId, base.jobId, auth, request))
      .rejects.toThrow('Invalid task cancellation confirmation');
    expect(request).toHaveBeenCalledTimes(1);
    await expect(requestTaskCancellation(base.workspace, base.sessionId, '../bad', auth, request))
      .rejects.toThrow('Invalid CLI task scope');
    const denied = vi.fn().mockResolvedValue(payload({ success: false, error: 'Operator disabled' }, 403));
    await expect(requestTaskCancellation(base.workspace, base.sessionId, base.jobId, auth, denied))
      .rejects.toThrow('Operator disabled');
  });
});
