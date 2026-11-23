import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { SuperAgentAcpClient } from '../src/superAgentAcpClient';
import { SuperAgentAcpBridgeAdapter } from '../src/superAgentAcpBridgeAdapter';

// Mock WebSocket class simulating ws library
class MockWebSocket extends EventEmitter {
  public readyState = 1; // WebSocket.OPEN
  public sentMessages: any[] = [];

  send(data: string) {
    this.sentMessages.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3; // WebSocket.CLOSED
    this.emit('close');
  }
}

describe('SuperAgentAcpBridgeAdapter - Frontend WebSocket Relay', () => {
  it('relays thought and text chunks to WebSocket client', async () => {
    const clientToMock = new PassThrough();
    const mockToClient = new PassThrough();

    const acpClient = new SuperAgentAcpClient({
      inputStream: mockToClient,
      outputStream: clientToMock,
      spawnSubprocess: false,
    });

    const mockWs = new MockWebSocket();
    const adapter = new SuperAgentAcpBridgeAdapter({
      client: acpClient,
      ws: mockWs as any,
      workspacePath: 'D:/test',
      defaultSessionId: 'sess_test_1',
    });

    // Simulate ACP client emitting events
    acpClient.emit('thought', { sessionId: 'sess_test_1', delta: 'CoT thinking step...' });
    acpClient.emit('text', { sessionId: 'sess_test_1', delta: 'Generated reply' });

    expect(mockWs.sentMessages).toHaveLength(2);
    expect(mockWs.sentMessages[0]).toEqual({
      type: 'agent_event',
      event: {
        type: 'thought',
        content: 'CoT thinking step...',
      },
      sessionId: 'sess_test_1',
    });
    expect(mockWs.sentMessages[1]).toEqual({
      type: 'agent_event',
      event: {
        type: 'text',
        content: 'Generated reply',
      },
      sessionId: 'sess_test_1',
    });

    adapter.dispose();
    acpClient.close();
  });

  it('relays tool events to WebSocket client', async () => {
    const clientToMock = new PassThrough();
    const mockToClient = new PassThrough();

    const acpClient = new SuperAgentAcpClient({
      inputStream: mockToClient,
      outputStream: clientToMock,
      spawnSubprocess: false,
    });

    const mockWs = new MockWebSocket();
    const adapter = new SuperAgentAcpBridgeAdapter({
      client: acpClient,
      ws: mockWs as any,
      workspacePath: 'D:/test',
      defaultSessionId: 'sess_test_1',
    });

    acpClient.emit('tool_call_start', {
      sessionId: 'sess_test_1',
      tool: 'read_files',
      callId: 'call_101',
      description: 'Read package.json',
    });

    acpClient.emit('tool_call_end', {
      sessionId: 'sess_test_1',
      tool: 'read_files',
      callId: 'call_101',
      status: 'completed',
    });

    expect(mockWs.sentMessages).toHaveLength(2);
    expect(mockWs.sentMessages[0].type).toBe('agent_event');
    expect(mockWs.sentMessages[0].event.type).toBe('tool_start');
    expect(mockWs.sentMessages[0].event.toolCall.name).toBe('read_files');
    expect(mockWs.sentMessages[1].type).toBe('agent_event');
    expect(mockWs.sentMessages[1].event.type).toBe('tool_end');
    expect(mockWs.sentMessages[1].event.toolResult.isError).toBe(false);

    adapter.dispose();
    acpClient.close();
  });

  it('manages interactive permission requests and frontend approvals', async () => {
    const clientToMock = new PassThrough();
    const mockToClient = new PassThrough();

    const acpClient = new SuperAgentAcpClient({
      inputStream: mockToClient,
      outputStream: clientToMock,
      spawnSubprocess: false,
    });

    const mockWs = new MockWebSocket();
    const adapter = new SuperAgentAcpBridgeAdapter({
      client: acpClient,
      ws: mockWs as any,
      workspacePath: 'D:/test',
      defaultSessionId: 'sess_test_1',
    });

    let clientOutputRpc: any = null;
    clientToMock.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line) clientOutputRpc = JSON.parse(line);
    });

    // 1. Agent asks for permission
    acpClient.emit('permission_requested', {
      rpcId: 555,
      permissionId: 'perm_security_01',
      sessionId: 'sess_test_1',
      workspacePath: 'D:/test',
      action: 'command_execute',
      target: 'rm -rf node_modules',
      description: 'Delete node_modules',
      riskLevel: 'critical',
      expiresInMs: 10000,
    });

    expect(mockWs.sentMessages).toHaveLength(1);
    expect(mockWs.sentMessages[0].type).toBe('permission_required');
    expect(mockWs.sentMessages[0].permissionId).toBe('perm_security_01');
    expect(mockWs.sentMessages[0].toolCall?.name).toBe('rm -rf node_modules');
    expect(mockWs.sentMessages[0].description).toBe('Delete node_modules');

    // 2. Frontend responds with approval
    await adapter.handleFrontendMessage({
      type: 'permission_response',
      permissionId: 'perm_security_01',
      decision: 'approved',
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(clientOutputRpc).toBeDefined();
    expect(clientOutputRpc.id).toBe(555);
    expect(clientOutputRpc.result.decision).toBe('approved');

    // 3. Test approve_permission message with target-only permission
    acpClient.emit('permission_requested', {
      rpcId: 556,
      action: 'command_execute',
      target: 'superagent_list_projects',
    });

    expect(mockWs.sentMessages).toHaveLength(3); // +1 permission_required, +1 ack from previous
    const secondReq = mockWs.sentMessages.find((m: any) => m.type === 'permission_required' && m.target === 'superagent_list_projects');
    expect(secondReq).toBeDefined();
    expect(secondReq.permissionId).toBe('perm_556');
    expect(secondReq.toolCall?.name).toBe('superagent_list_projects');
    expect(secondReq.description).toBe('Execute tool: superagent_list_projects');

    await adapter.handleFrontendMessage({
      type: 'approve_permission',
      permissionId: 'perm_556',
      approval: true,
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(clientOutputRpc.id).toBe(556);
    expect(clientOutputRpc.result.decision).toBe('approved');
    const ackMsg = mockWs.sentMessages.find((m: any) => m.type === 'permission_decision_ack' && m.permissionId === 'perm_556');
    expect(ackMsg).toBeDefined();
    expect(ackMsg.accepted).toBe(true);

    adapter.dispose();
    acpClient.close();
  });
});
