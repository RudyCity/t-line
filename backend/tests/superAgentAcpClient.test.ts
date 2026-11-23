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

  it('sendPrompt dispatches prompt without premature done status', async () => {
    const clientToMock = new PassThrough();
    const mockToClient = new PassThrough();

    const client = new SuperAgentAcpClient({
      inputStream: mockToClient,
      outputStream: clientToMock,
      spawnSubprocess: false,
    });

    let doneEmitted = false;
    client.on('status', (data) => {
      if (data.status === 'done') doneEmitted = true;
    });

    // Mock server handles session/prompt request
    clientToMock.on('data', (chunk) => {
      const msg = JSON.parse(chunk.toString().trim());
      if (msg.method === 'session/prompt') {
        mockToClient.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: { promptId: 'p_1', accepted: true, startedAt: Date.now() },
          }) + '\n'
        );
      }
    });

    const res = await client.sendPrompt('sess_1', 'Execute continuous loop task');
    expect(res.accepted).toBe(true);
    // Verification: status done MUST NOT be emitted right after prompt acceptance
    expect(doneEmitted).toBe(false);

    // Now simulate real server done notification
    mockToClient.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: 'sess_1',
          seq: 10,
          timestamp: Date.now(),
          update: { kind: 'status_change', status: 'done', summary: 'Turn completed' },
        },
      }) + '\n'
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(doneEmitted).toBe(true);

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

  it('detects installed ADE providers and lists all Universal ADE Hub engines with status', async () => {
    const { listAcpEngines, isBinaryInstalled } = await import('../src/acpEngineRegistry');
    const engines = listAcpEngines();

    expect(engines.length).toBeGreaterThanOrEqual(13);
    const engineIds = engines.map((e) => e.id);
    expect(engineIds).toContain('antigravity');
    expect(engineIds).toContain('superagent');
    expect(engineIds).toContain('opencode');
    expect(engineIds).toContain('cline');
    expect(engineIds).toContain('kilo');
    expect(engineIds).toContain('claude-code');
    expect(engineIds).toContain('cursor');
    expect(engineIds).toContain('windsurf');
    expect(engineIds).toContain('codex');
    expect(engineIds).toContain('zed');
    expect(engineIds).toContain('continue');
    expect(engineIds).toContain('goose');
    expect(engineIds).toContain('aider');

    // Installed engines come first in the sorted array
    const firstEngine = engines[0];
    expect(firstEngine.isInstalled).toBe(true);
    expect(firstEngine.status).toBe('ready');

    // isBinaryInstalled returns false for nonexistent binary
    expect(isBinaryInstalled('nonexistent_tool_12345')).toBe(false);
  });

  it('unwraps dynamic tool calls cleanly in streaming bridge', async () => {
    const { unwrapDynamicTool } = await import('../src/superAgentAcpBridgeAdapter');

    const unwrappedExecute = unwrapDynamicTool('superagent_tool_execute', {
      name: 'superagent_chrome_cdp',
      arguments: { command: 'screenshot' },
    });
    expect(unwrappedExecute.resolvedTool).toBe('superagent_chrome_cdp');
    expect(unwrappedExecute.resolvedArgs).toEqual({ command: 'screenshot' });

    const unwrappedMcp = unwrapDynamicTool('call_mcp_tool', {
      ToolName: 'superagent_list_projects',
      Arguments: { filter: 'active' },
    });
    expect(unwrappedMcp.resolvedTool).toBe('superagent_list_projects');
    expect(unwrappedMcp.resolvedArgs).toEqual({ filter: 'active' });

    const plain = unwrapDynamicTool('read_file', { path: '/tmp/test' });
    expect(plain.resolvedTool).toBe('read_file');
    expect(plain.resolvedArgs).toEqual({ path: '/tmp/test' });
  });

  it('resolves in-flight ACP reverse permissions and replies to client', async () => {
    const { pendingAcpPermissions, resolvePendingAcpPermission } = await import('../src/superAgentAcpBridgeAdapter');

    let capturedDecision: string | null = null;
    const mockClient: any = {
      respondPermission: (_rpcId: any, decision: string) => {
        capturedDecision = decision;
      },
    };

    pendingAcpPermissions.set('perm_test_123', {
      client: mockClient,
      rpcId: 42,
      sessionId: 'sess_test',
    });

    const resolved = resolvePendingAcpPermission('perm_test_123', true);
    expect(resolved).toBe(true);
    expect(capturedDecision).toBe('approved');
    expect(pendingAcpPermissions.has('perm_test_123')).toBe(false);

    // Resolving again returns false
    expect(resolvePendingAcpPermission('perm_test_123', true)).toBe(false);
  });

  it('provisions opencode.json with Superagent MCP server configuration', async () => {
    const { provisionOpencodeMcp } = await import('../src/acpMcpProvisioner');
    const os = await import('os');
    const fs = await import('fs');
    const path = await import('path');

    const testDir = path.join(os.tmpdir(), `tline_mcp_test_${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    try {
      const ok = provisionOpencodeMcp(testDir, 'D:/test/superagent/dist/cli.js');
      expect(ok).toBe(true);

      const configPath = path.join(testDir, 'opencode.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(parsed.mcp).toBeDefined();
      expect(parsed.mcp.superagent).toBeDefined();
      expect(parsed.mcp.superagent.command).toContain('D:/test/superagent/dist/cli.js');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});
