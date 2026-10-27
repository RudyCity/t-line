import { describe, it, expect, vi } from 'vitest';
import { handleAgentEventPayload } from '../SuperAgentConsoleUtils';

describe('P2 DEEP-10: Canonical Subagent Identity', () => {
  it('does NOT create fake RUNNING subagents with Math.random() on invoke_subagent tool calls', () => {
    let subagentList: any[] = [];
    const setSubagentList = vi.fn((updater) => {
      subagentList = typeof updater === 'function' ? updater(subagentList) : updater;
    });
    const setMessages = vi.fn();
    const setLoading = vi.fn();
    const setToolProgressMsg = vi.fn();
    const isAbortedRef = { current: false };

    // Simulate an agent event where invoke_subagent is being called with subagent args
    const invokePayload = {
      type: 'agent_event',
      sessionId: 'sess_1',
      event: {
        type: 'tool_call',
        toolCall: {
          id: 'call_1',
          name: 'invoke_subagent',
          args: {
            subagents: [
              { TypeName: 'researcher', Role: 'Codebase Researcher', Prompt: 'Analyze auth' },
            ],
          },
        },
      },
    };

    handleAgentEventPayload(
      invokePayload,
      setLoading,
      setToolProgressMsg,
      setMessages,
      setSubagentList,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      isAbortedRef,
      'sess_1'
    );

    // setSubagentList must NOT have been called with a fake Math.random() ID
    expect(setSubagentList).not.toHaveBeenCalled();
    expect(subagentList).toHaveLength(0);

    // Messages should still record the tool invocation for user transparency
    expect(setMessages).toHaveBeenCalled();
  });

  it('only updates subagents canonically via authoritative subagents_update events', () => {
    let subagentList: any[] = [];
    const setSubagentList = vi.fn((updater) => {
      subagentList = typeof updater === 'function' ? updater(subagentList) : updater;
    });
    const isAbortedRef = { current: false };

    // 1. Authoritative subagents_update event from Core
    const coreUpdatePayload = {
      type: 'subagents_update',
      sessionId: 'sess_1',
      subagents: [
        {
          id: 'sub_core_123',
          typeName: 'researcher',
          role: 'Codebase Researcher',
          status: 'RUNNING',
          prompt: 'Analyze auth',
          logs: ['[04:20:00] Subagent launched'],
        },
      ],
    };

    handleAgentEventPayload(
      coreUpdatePayload,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      setSubagentList,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      isAbortedRef,
      'sess_1'
    );

    expect(setSubagentList).toHaveBeenCalled();
    expect(subagentList).toHaveLength(1);
    expect(subagentList[0].id).toBe('sub_core_123');
    expect(subagentList[0].status).toBe('RUNNING');

    // 2. Authoritative completion update from Core
    const completionPayload = {
      type: 'subagents_update',
      sessionId: 'sess_1',
      subagents: [
        {
          id: 'sub_core_123',
          status: 'COMPLETED',
          result: { summary: 'Analysis complete' },
        },
      ],
    };

    handleAgentEventPayload(
      completionPayload,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      setSubagentList,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      isAbortedRef,
      'sess_1'
    );

    // No duplicate rows created; existing record updated
    expect(subagentList).toHaveLength(1);
    expect(subagentList[0].id).toBe('sub_core_123');
    expect(subagentList[0].status).toBe('COMPLETED');
  });
});
