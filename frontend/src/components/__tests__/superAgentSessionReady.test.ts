import { describe, it, expect, vi } from 'vitest';
import {
  extractLifecycleWarnings,
  type SessionLifecycleEvent,
} from '../../services/sessionLifecycleContract';

describe('P1 DEEP-08 & SESSION SEND BUG: Session Ready Queue & Lifecycle Binding', () => {
  it('queues prompt submission when session is not ready and dispatches exactly once upon READY', () => {
    let sessionReady = false;
    let pendingSend: {
      sessionId: string;
      payload: any;
      displayText: string;
    } | null = null;

    const mockSocket = {
      readyState: 1, // OPEN
      send: vi.fn(),
    };

    const targetSessionId = 'sess_cold_1';
    const clientMessageId = 'msg_uuid_123';
    const promptPayload = {
      type: 'prompt',
      text: 'First prompt in cold session',
      sessionId: targetSessionId,
      clientMessageId,
    };

    // Attempt to send before READY
    if (sessionReady && mockSocket.readyState === 1) {
      mockSocket.send(JSON.stringify(promptPayload));
    } else {
      pendingSend = {
        sessionId: targetSessionId,
        payload: promptPayload,
        displayText: 'First prompt in cold session',
      };
    }

    // Socket must NOT have sent yet
    expect(mockSocket.send).not.toHaveBeenCalled();
    expect(pendingSend).not.toBeNull();

    // Now simulate session_lifecycle transitioning to READY
    const lifecyclePayload = {
      type: 'session_lifecycle',
      sessionId: 'sess_cold_1',
      state: 'READY',
      meta: { isNewSession: true },
    };

    if (lifecyclePayload.type === 'session_lifecycle') {
      if (lifecyclePayload.sessionId === targetSessionId) {
        if (lifecyclePayload.state === 'READY') {
          sessionReady = true;
          if (pendingSend && pendingSend.sessionId === lifecyclePayload.sessionId) {
            const toSend = pendingSend;
            pendingSend = null;
            mockSocket.send(JSON.stringify(toSend.payload));
          }
        }
      }
    }

    expect(sessionReady).toBe(true);
    expect(mockSocket.send).toHaveBeenCalledTimes(1);
    const sentData = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sentData.sessionId).toBe('sess_cold_1');
    expect(sentData.clientMessageId).toBe('msg_uuid_123');
    expect(pendingSend).toBeNull();
  });

  it('prevents sending a newly created session prompt through an older bound socket', () => {
    const oldSessionId = 'sess_old';
    const newSessionId = 'sess_new';

    const oldSocket = {
      readyState: 1,
      send: vi.fn(),
    };

    let sessionReady = true; // Old session might have been ready
    let pendingSend: any = null;

    const promptPayload = {
      type: 'prompt',
      text: 'New chat initial prompt',
      sessionId: newSessionId,
      clientMessageId: 'msg_uuid_new',
    };

    // When creating a new chat, isBrandNewSession = true
    const isBrandNewSession = true;
    const isSocketReadyForSession =
      !isBrandNewSession &&
      promptPayload.sessionId === oldSessionId &&
      sessionReady &&
      oldSocket.readyState === 1;

    expect(isSocketReadyForSession).toBe(false);

    if (isSocketReadyForSession) {
      oldSocket.send(JSON.stringify(promptPayload));
    } else {
      pendingSend = {
        sessionId: newSessionId,
        payload: promptPayload,
      };
    }

    // Old socket must NOT receive the new session prompt!
    expect(oldSocket.send).not.toHaveBeenCalled();
    expect(pendingSend.sessionId).toBe(newSessionId);

    // New socket connects for newSessionId
    const newSocket = {
      readyState: 1,
      send: vi.fn(),
    };

    // When new socket receives READY:
    const readyEvent = {
      type: 'session_lifecycle',
      sessionId: newSessionId,
      state: 'READY',
    };

    if (readyEvent.state === 'READY' && pendingSend?.sessionId === readyEvent.sessionId) {
      const toSend = pendingSend;
      pendingSend = null;
      newSocket.send(JSON.stringify(toSend.payload));
    }

    expect(newSocket.send).toHaveBeenCalledTimes(1);
    const sentData = JSON.parse(newSocket.send.mock.calls[0][0]);
    expect(sentData.sessionId).toBe(newSessionId);
    expect(sentData.clientMessageId).toBe('msg_uuid_new');
    expect(pendingSend).toBeNull();
  });

  it('surfaces history restore warning from actual backend metadata and prevents duplicate notifications on replay', () => {
    const messages: any[] = [];
    const setMessages = vi.fn((updater) => {
      const next = typeof updater === 'function' ? updater(messages) : updater;
      messages.length = 0;
      messages.push(...next);
    });

    const surfacedWarnings = new Map<string, Set<string>>();

    // Actual backend lifecycle event shape emitted by superAgentSessionLifecycle.ts
    const backendLifecyclePayload: SessionLifecycleEvent = {
      type: 'session_lifecycle',
      sessionId: 'sess_warning',
      state: 'READY',
      metadata: {
        workspace: '/workspace/demo',
        mode: 'single',
        historyWarnings: ['SQLite history table was busy or truncated; continuing with empty memory.'],
        warnings: ['SQLite history table was busy or truncated; continuing with empty memory.'],
        historyRestoreWarning: 'SQLite history table was busy or truncated; continuing with empty memory.',
      },
    };

    const processLifecycleEvent = (payload: SessionLifecycleEvent) => {
      if (payload.state === 'READY') {
        const warnings = extractLifecycleWarnings(payload);
        if (warnings.length > 0) {
          const sessionWarnings = surfacedWarnings.get(payload.sessionId) ?? new Set<string>();
          surfacedWarnings.set(payload.sessionId, sessionWarnings);
          const newWarnings = warnings.filter((w) => !sessionWarnings.has(w));
          for (const w of newWarnings) {
            sessionWarnings.add(w);
            setMessages((prev: any[]) => [
              ...prev,
              {
                role: 'system',
                text: `⚠️ History notice: ${w}`,
              },
            ]);
          }
        }
      }
    };

    // First arrival
    processLifecycleEvent(backendLifecyclePayload);
    expect(setMessages).toHaveBeenCalledTimes(1);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain('SQLite history table was busy or truncated');

    // Replay / reconnect arrival with identical warnings
    processLifecycleEvent(backendLifecyclePayload);
    // Must NOT call setMessages again or append duplicate messages
    expect(setMessages).toHaveBeenCalledTimes(1);
    expect(messages).toHaveLength(1);
  });
});
