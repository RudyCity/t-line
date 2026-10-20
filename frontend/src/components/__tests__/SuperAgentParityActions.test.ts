import { describe, it, expect, vi } from 'vitest';
import { parseParityCommand, runParityCommand } from '../SuperAgentParityActions';

describe('T-Line read-only slash commands', () => {
  const manifest = { schemaVersion: 1, server: 'superagent', version: '1.14.8',
    commands: [{ name: 'daemon' }], httpActions: [
      { id: 'daemon.status', method: 'GET' }, { id: 'gateway.status', method: 'GET' },
    ] };
  const reply = (payload: unknown, status = 200) => ({
    ok: status >= 200 && status < 300, status, json: async () => payload,
  }) as Response;
  it('parses only explicit read-only command families', () => {
    expect(parseParityCommand('/daemon status')?.action).toBe('daemon.status');
    expect(parseParityCommand('/gateway')?.action).toBe('gateway.status');
    expect(parseParityCommand('/parity')?.action).toBe('capabilities');
    expect(parseParityCommand('/tools')?.action).toBe('tools.catalog');
  });
  it('negotiates capabilities before reading daemon status', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(reply(manifest))
      .mockResolvedValueOnce(reply({ success: true, running: true, activeJobsCount: 2, uptime: 20 }));
    const text = await runParityCommand('/daemon status', 'D:/workspace', () => ({ Authorization: 'Bearer tline' }), request);
    expect(text).toContain('Active jobs: 2');
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toContain('/parity/daemon.status?workspace=D%3A%2Fworkspace');
  });
  it('prevents mutations and cross-workspace job listing without any HTTP request', async () => {
    const request = vi.fn();
    const auth = () => ({ Authorization: 'Bearer tline' });
    expect(await runParityCommand('/daemon jobs', 'D:/x', auth, request)).toContain('workspace scoping');
    expect(await runParityCommand('/gateway config botToken SECRET', 'D:/x', auth, request)).toContain('CLI-only');
    expect(request).not.toHaveBeenCalled();
  });
  it('refuses undeclared live actions and shows unavailable server clearly', async () => {
    const request = vi.fn().mockResolvedValue(reply({ ...manifest, httpActions: [] }));
    expect(await runParityCommand('/daemon', 'D:/x', () => ({}), request)).toContain('not supported');
    const bad = vi.fn().mockResolvedValue(reply({ error: 'not installed' }, 404));
    expect(await runParityCommand('/parity', 'D:/x', () => ({}), bad)).toContain('negotiation failed');
  });
});
