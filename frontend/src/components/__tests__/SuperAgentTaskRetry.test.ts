import { describe, expect, it, vi } from 'vitest';
import { getTaskRetryCapability, requestTaskRetry } from '../SuperAgentTaskRetry';
const reply = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300,
  status, json: async () => data }) as Response;
const jobId = 'clj_1792480000000_deadbeef';
const workspace = 'D:/work', sessionId = 'sess_user';
const instruction = 'Regenerate the output file under the expected workspace path.';
const auth = () => ({ Authorization: 'Bearer test' });
describe('TLine explicit new-instruction retry client', () => {
  it('requires both advertised creator-confirmed POST capabilities', async () => {
    const capabilities = { server: 'superagent', schemaVersion: 1,
      httpActions: ['prepare', 'confirm'].map(stage => ({
        id: 'tasks.retry.' + stage, method: 'POST', access: 'creator-confirmed',
      })) };
    const request = vi.fn().mockResolvedValueOnce(reply(capabilities))
      .mockResolvedValueOnce(reply({ ...capabilities, httpActions: capabilities.httpActions.slice(0, 1) }));
    expect(await getTaskRetryCapability(workspace, auth, request)).toBe(true);
    expect(await getTaskRetryCapability(workspace, auth, request)).toBe(false);
  });
  it('never invokes confirm without explicit fresh instruction and human approval', async () => {
    const request = vi.fn().mockResolvedValue(reply({
      success: true, sourceJobId: jobId, challenge: 'a'.repeat(48),
    }));
    const result = await requestTaskRetry(workspace, sessionId, jobId,
      instruction, auth, () => false, request);
    expect(result).toContain('not approved');
    expect(request).toHaveBeenCalledTimes(1);
    await expect(requestTaskRetry(workspace, sessionId, jobId,
      'too short', auth, () => true, request)).rejects.toThrow(/new instruction/);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('sends a fresh instruction only to prepare, and only challenge on confirm', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(reply({ success: true, sourceJobId: jobId, challenge: 'b'.repeat(48) }))
      .mockResolvedValueOnce(reply({ success: true, sourceJobId: jobId, requested: true,
        newJobId: 'clj_1792480000001_feedface' }, 202));
    const approval = vi.fn(() => true);
    const result = await requestTaskRetry(workspace, sessionId, jobId, instruction, auth, approval, request);
    expect(result).toContain('clj_1792480000001_feedface');
    expect(approval).toHaveBeenCalledOnce();
    expect(JSON.parse(request.mock.calls[0][1].body).prompt).toBe(instruction);
    expect(JSON.parse(request.mock.calls[1][1].body).prompt).toBeUndefined();
    expect(JSON.parse(request.mock.calls[1][1].body).challenge).toBe('b'.repeat(48));
  });
  it('refuses fabricated challenge, denial and ambiguous restart outcomes', async () => {
    const forged = vi.fn().mockResolvedValue(reply({
      success: true, sourceJobId: jobId, challenge: 'INVALID',
    }));
    await expect(requestTaskRetry(workspace, sessionId, jobId,
      instruction, auth, () => true, forged)).rejects.toThrow(/Invalid retry/);
    expect(forged).toHaveBeenCalledTimes(1);
    const denied = vi.fn().mockResolvedValue(reply({ success: false, error: 'Source changed' }, 409));
    await expect(requestTaskRetry(workspace, sessionId, jobId,
      instruction, auth, () => true, denied)).rejects.toThrow('Source changed');
  });
});
