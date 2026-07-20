import { describe, it, expect, vi } from 'vitest';
import { handleAgentEventPayload } from '../SuperAgentConsoleUtils';

describe('SuperAgent Stream Print Parser Tests', () => {
  const mockSetLoading = vi.fn();
  const mockSetToolProgressMsg = vi.fn();
  const mockSetMessages = vi.fn();
  const mockSetSubagentList = vi.fn();
  const mockSetPendingPermission = vi.fn();
  const mockSetPendingQuestion = vi.fn();
  const mockSetSelectedQuestionAnswers = vi.fn();
  const mockSetCustomQuestionInput = vi.fn();
  const mockSetPendingPlanApproval = vi.fn();
  const mockIsAbortedRef = { current: false };

  const getUpdatedMessages = (payload: any, initialMessages: any[]) => {
    mockSetMessages.mockClear();
    handleAgentEventPayload(
      payload,
      mockSetLoading,
      mockSetToolProgressMsg,
      mockSetMessages,
      mockSetSubagentList,
      mockSetPendingPermission,
      mockSetPendingQuestion,
      mockSetSelectedQuestionAnswers,
      mockSetCustomQuestionInput,
      mockSetPendingPlanApproval,
      mockIsAbortedRef
    );

    // Get the updater function passed to setMessages
    const updater = mockSetMessages.mock.calls[0]?.[0];
    if (typeof updater === 'function') {
      return updater(initialMessages);
    }
    return mockSetMessages.mock.calls[0]?.[0] || initialMessages;
  };

  it('should correctly concatenate delta chunks', () => {
    // 1st chunk
    let messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: 'Hello' } },
      []
    );
    expect(messages).toEqual([{ role: 'assistant', text: 'Hello' }]);

    // 2nd chunk
    messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: ' world' } },
      messages
    );
    expect(messages).toEqual([{ role: 'assistant', text: 'Hello world' }]);

    // 3rd chunk
    messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: '!' } },
      messages
    );
    expect(messages).toEqual([{ role: 'assistant', text: 'Hello world!' }]);
  });

  it('should not swallow repeated consecutive identical characters (e.g. haha, 111)', () => {
    // Test repeating 'ha' -> 'haha'
    let messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: 'ha' } },
      []
    );
    messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: 'ha' } },
      messages
    );
    expect(messages).toEqual([{ role: 'assistant', text: 'haha' }]);

    // Test repeating '1' -> '111'
    messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: '1' } },
      []
    );
    messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: '1' } },
      messages
    );
    messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: '1' } },
      messages
    );
    expect(messages).toEqual([{ role: 'assistant', text: '111' }]);
  });

  it('should correctly parse cumulative chunks if sent by the server', () => {
    // 1st chunk
    let messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: 'Hello' } },
      []
    );
    expect(messages).toEqual([{ role: 'assistant', text: 'Hello' }]);

    // 2nd cumulative chunk (starts with previous, is longer)
    messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: 'Hello world' } },
      messages
    );
    expect(messages).toEqual([{ role: 'assistant', text: 'Hello world' }]);

    // 3rd cumulative chunk
    messages = getUpdatedMessages(
      { type: 'agent_event', event: { type: 'text', content: 'Hello world!' } },
      messages
    );
    expect(messages).toEqual([{ role: 'assistant', text: 'Hello world!' }]);
  });
});
