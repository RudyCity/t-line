import { describe, expect, it, vi } from 'vitest';
import { parseParityCommand, runParityCommand } from '../SuperAgentParityActions';

const manifest = {
  server: 'superagent', schemaVersion: 1, version: '1.14.8', commands: [],
  httpActions: ['mcp.status', 'tools.catalog', 'selfdev.status', 'muse.status'].map(id => ({ id, method: 'GET' })),
};
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
}) as Response;
const auth = () => ({ Authorization: 'Bearer desktop' });

describe('T-Line MCP, tools, selfdev, Muse read-only command adapters', () => {
  it('parses safe status commands, including defaults', () => {
    expect(parseParityCommand('/mcp list')?.action).toBe('mcp.status');
    expect(parseParityCommand('/tools')?.action).toBe('tools.catalog');
    expect(parseParityCommand('/selfdev status')?.action).toBe('selfdev.status');
    expect(parseParityCommand('/muse status')?.action).toBe('muse.status');
  });

  it('rejects mutating commands before any request', async () => {
    const request = vi.fn();
    for (const cmd of ['/mcp add foo npx', '/mcp reload', '/tools run shell',
      '/selfdev approve 23', '/selfdev disable', '/muse stop', '/muse run risky-task']) {
      const text = await runParityCommand(cmd, 'D:/mine', auth, request);
      expect(text).toContain('Only read-only');
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('shows MCP status without credentials and uses capability negotiation', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(manifest))
      .mockResolvedValueOnce(response({ success: true, scope: 'runtime-global',
        servers: [{ name: 'git', status: 'connected', toolCount: 7, disabled: false }] }));
    const text = await runParityCommand('/mcp list', 'D:/my project', auth, request);
    expect(text).toContain('git: connected (7 tools)');
    expect(request.mock.calls[1][0]).toContain('mcp.status?workspace=D%3A%2Fmy%20project');
    expect(request.mock.calls[1][1].headers.Authorization).toBe('Bearer desktop');
  });

  it('reports only tool names and bounded selfdev status', async () => {
    const tools = vi.fn()
      .mockResolvedValueOnce(response(manifest))
      .mockResolvedValueOnce(response({ success: true, tools: ['read_file', 'search'], count: 2 }));
    expect(await runParityCommand('/tools list', 'D:/one', auth, tools)).toContain('read_file');
    const selfdev = vi.fn()
      .mockResolvedValueOnce(response(manifest))
      .mockResolvedValueOnce(response({ success: true, scope: 'workspace', enabled: true,
        userOptOut: false, storageAvailable: true, eventCount: 3,
        lessonCounts: { active: 1, candidate: 2, retired: 0 } }));
    const out = await runParityCommand('/selfdev status', 'D:/one', auth, selfdev);
    expect(out).toContain('Lessons: 1 active, 2 candidate');
    expect(out).toContain('current workspace');
  });

  it('does not claim another workspace Muse task and treats status as unverified', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(manifest))
      .mockResolvedValueOnce(response({ success: true, scope: 'workspace',
        transport: 'websocket', watcherActive: true, runnerEnabled: false, activeTask: null }));
    const text = await runParityCommand('/muse status', 'D:/mine', auth, request);
    expect(text).toContain('none for this workspace');
  });

  it('fails closed when capabilities do not explicitly declare the action', async () => {
    const request = vi.fn().mockResolvedValue(response({ ...manifest, httpActions: [] }));
    const out = await runParityCommand('/mcp status', 'D:/mine', auth, request);
    expect(out).toContain('not supported');
    expect(request).toHaveBeenCalledTimes(1);
  });
});
