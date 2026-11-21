import { describe, expect, it } from 'vitest';
import { PassThrough } from 'stream';
import { SuperAgentAcpClient } from '../src/superAgentAcpClient';
import { selectSuperAgentLaunch } from '../src/superAgentRuntime';

describe('SuperAgentAcpClient - T-Line Desktop Integration', () => {
  it('performs ACP handshake (initialize) over streams', async () => {
    const clientToMock = new PassThrough();
    const mockToClient = new PassThrough();

    const client = new SuperAgentAcpClient({
      inputStream: mockToClient,
      outputStream: clientToMock,
      spawnSubprocess: false,
    });

    // Mock server response handler
    clientToMock.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (!line) return;
      const req = JSON.parse(line);
      if (req.method === 'initialize') {
        const resp = {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            protocolVersion: '1.0.0',
            agentInfo: { name: 'superagent-core', version: '1.14.107' },
            capabilities: { promptStreaming: true, toolExecution: true },
            supportedMethods: ['initialize', 'session/new', 'session/prompt'],
          },
        };
        mockToClient.write(JSON.stringify(resp) + '\n');
      }
    });

    const initResult = await client.initialize();
    expect(initResult.protocolVersion).toBe('1.0.0');
    expect(initResult.agentInfo.name).toBe('superagent-core');
    expect(initResult.capabilities.promptStreaming).toBe(true);

    client.close();
  });

  it('passes systemPromptAppend in session/new for dynamic tools optimization', async () => {
    const clientToMock = new PassThrough();
    const mockToClient = new PassThrough();

    const client = new SuperAgentAcpClient({
      inputStream: mockToClient,
      outputStream: clientToMock,
      spawnSubprocess: false,
    });

    let capturedParams: any = null;
    clientToMock.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (!line) return;
      const req = JSON.parse(line);
      if (req.method === 'session/new') {
        capturedParams = req.params;
        const resp = {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            sessionId: 'sess_custom_prompt',
            models: { currentModelId: 'gemini-3.8-flash-high' },
          },
        };
        mockToClient.write(JSON.stringify(resp) + '\n');
      }
    });

    const sessionRes = await client.newSession(
      'D:/test-workspace',
      'tline',
      '# CUSTOM SYSTEM PROMPT INSTRUCTION'
    );

    expect(sessionRes.sessionId).toBe('sess_custom_prompt');
    expect(capturedParams).toBeDefined();
    expect(capturedParams.systemPrompt).toBe('# CUSTOM SYSTEM PROMPT INSTRUCTION');
    expect(capturedParams._meta.antigravity.systemPrompt.append).toBe('# CUSTOM SYSTEM PROMPT INSTRUCTION');

    client.close();
  });

  it('receives streaming updates (thought, text, tool_call)', async () => {
    const clientToMock = new PassThrough();
    const mockToClient = new PassThrough();

    const client = new SuperAgentAcpClient({
      inputStream: mockToClient,
      outputStream: clientToMock,
      spawnSubprocess: false,
    });

    const thoughts: string[] = [];
    const texts: string[] = [];
    const toolStarts: any[] = [];

    client.on('thought', (data) => thoughts.push(data.delta));
    client.on('text', (data) => texts.push(data.delta));
    client.on('tool_call_start', (data) => toolStarts.push(data));

    // Simulate mock agent sending updates
    mockToClient.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: 'sess_1',
          seq: 1,
          timestamp: Date.now(),
          update: { kind: 'thought_chunk', delta: 'Thinking about architecture...' },
        },
      }) + '\n'
    );

    mockToClient.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: 'sess_1',
          seq: 2,
          timestamp: Date.now(),
          update: { kind: 'text_chunk', delta: 'Here is the plan.' },
        },
      }) + '\n'
    );

    mockToClient.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: 'sess_1',
          seq: 3,
          timestamp: Date.now(),
          update: { kind: 'tool_call_start', tool: 'write_file', actor: 'agent', callId: 'call_1' },
        },
      }) + '\n'
    );

    mockToClient.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: 'sess_1',
          seq: 4,
          timestamp: Date.now(),
          update: {
            kind: 'tool_call_start',
            tool: 'superagent_tool_execute',
            callId: 'call_2',
            description: { name: 'superagent_chrome_cdp', arguments: { command: 'screenshot' } },
          },
        },
      }) + '\n'
    );

    // Wait a tick for event propagation
    await new Promise((r) => setTimeout(r, 20));

    expect(thoughts).toEqual(['Thinking about architecture...']);
    expect(texts).toEqual(['Here is the plan.']);
    expect(toolStarts.length).toBe(2);
    expect(toolStarts[0].tool).toBe('write_file');
    expect(toolStarts[1].tool).toBe('superagent_tool_execute');
    expect(toolStarts[1].description).toEqual({
      name: 'superagent_chrome_cdp',
      arguments: { command: 'screenshot' },
    });

    client.close();
  });

  it('handles reverse permission requests from agent and replies with decision', async () => {
    const clientToMock = new PassThrough();
    const mockToClient = new PassThrough();

    const client = new SuperAgentAcpClient({
      inputStream: mockToClient,
      outputStream: clientToMock,
      spawnSubprocess: false,
    });

    let capturedRpcResponse: any = null;
    clientToMock.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line) {
        capturedRpcResponse = JSON.parse(line);
      }
    });

    // Client listens for permission requests
    client.on('permission_requested', (req) => {
      expect(req.permissionId).toBe('perm_999');
      expect(req.action).toBe('command_execute');
      req.reply('approved');
    });

    // Mock agent emits reverse request
    mockToClient.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 'rpc_req_100',
        method: 'session/request_permission',
        params: {
          permissionId: 'perm_999',
          sessionId: 'sess_1',
          workspacePath: 'D:/test',
          action: 'command_execute',
          target: 'npm test',
          description: 'Run tests in workspace',
          riskLevel: 'high',
          expiresInMs: 5000,
        },
      }) + '\n'
    );

    // Wait for reply to arrive on clientToMock
    await new Promise((r) => setTimeout(r, 30));

    expect(capturedRpcResponse).toBeDefined();
    expect(capturedRpcResponse.id).toBe('rpc_req_100');
    expect(capturedRpcResponse.result.decision).toBe('approved');

    client.close();
  });

  it('selectSuperAgentLaunch sets --acp flag when mode is acp', () => {
    const choice = selectSuperAgentLaunch(undefined, 'acp');
    expect(choice.args).toContain('--acp');
    expect(choice.args).not.toContain('--server');
  });

  it('detects installed ADE providers and lists all 7 engines with status', async () => {
    const { listAcpEngines, isBinaryInstalled } = await import('../src/acpEngineRegistry');
    const engines = listAcpEngines();

    expect(engines.length).toBeGreaterThanOrEqual(7);
    const engineIds = engines.map((e) => e.id);
    expect(engineIds).toContain('antigravity');
    expect(engineIds).toContain('superagent');
    expect(engineIds).toContain('claude-code');
    expect(engineIds).toContain('cursor');
    expect(engineIds).toContain('codex');
    expect(engineIds).toContain('zed');
    expect(engineIds).toContain('aider');

    // Installed engines come first in the sorted array
    const firstEngine = engines[0];
    expect(firstEngine.isInstalled).toBe(true);
    expect(firstEngine.status).toBe('ready');

    // isBinaryInstalled returns false for nonexistent binary
    expect(isBinaryInstalled('nonexistent_tool_12345')).toBe(false);
  });
});
