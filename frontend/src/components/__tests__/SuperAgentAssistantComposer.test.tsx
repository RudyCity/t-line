import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SuperAgentInputContainer } from '../SuperAgentInputContainer';

afterEach(cleanup);
function setup(loading: boolean, options: { attachment?: boolean; canDelegate?: boolean } = {}) {
  const handleSend = vi.fn();
  const handleAbort = vi.fn();
  const handleDelegate = vi.fn();
  render(<SuperAgentInputContainer
    input="Please investigate the next issue"
    setInput={vi.fn()} handleKeyDown={vi.fn()}
    handleSend={handleSend} handleAbort={handleAbort}
    onDelegateAsTask={handleDelegate} canDelegateAsTask={options.canDelegate ?? true}
    loading={loading}
    ws={{ readyState: WebSocket.OPEN } as WebSocket}
    attachments={options.attachment ? [{ id: 'attachment', type: 'document' as const,
      file: new File(['demo'], 'example.txt') }] : []}
    removeAttachment={vi.fn()}
    fileInputRef={createRef<HTMLInputElement>()}
    handleFileChange={vi.fn()}
    textareaRef={createRef<HTMLTextAreaElement>()}
    consoleContainerRef={createRef<HTMLDivElement>()}
    presets={{ single: [{ id: 'preset1', name: 'Default' }], multi: [] }}
    activePresetId={{ single: 'preset1', multi: '' }}
    agentMode="single" handlePresetChange={vi.fn()}
    getMainModelLabel={() => 'model'}
  />);
  return { handleSend, handleAbort, handleDelegate };
}

describe('assistant composer during active work', () => {
  it('allows follow-up instruction without aborting the active turn', () => {
    const { handleSend, handleAbort } = setup(true);
    const text = screen.getByRole('textbox');
    expect((text as HTMLTextAreaElement).disabled).toBe(false);
    expect(screen.getByPlaceholderText(/Ask a follow-up or delegate a separate task/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Queue follow-up' }));
    expect(handleSend).toHaveBeenCalledOnce();
    expect(handleAbort).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /ABORT/ }));
    expect(handleAbort).toHaveBeenCalledOnce();
  });
  it('delegates text without sending or aborting an active chat turn', () => {
    const { handleSend, handleAbort, handleDelegate } = setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delegate as background task' }));
    expect(handleDelegate).toHaveBeenCalledOnce();
    expect(handleSend).not.toHaveBeenCalled();
    expect(handleAbort).not.toHaveBeenCalled();
  });
  it('prevents delegation of unsupported attachments or missing session', () => {
    const attached = setup(false, { attachment: true });
    expect((screen.getByRole('button', { name: 'Delegate as background task' }) as HTMLButtonElement).disabled).toBe(true);
    expect(attached.handleDelegate).not.toHaveBeenCalled();
    cleanup();
    const unavailable = setup(false, { canDelegate: false });
    expect((screen.getByRole('button', { name: 'Delegate as background task' }) as HTMLButtonElement).disabled).toBe(true);
    expect(unavailable.handleDelegate).not.toHaveBeenCalled();
  });
  it('still presents normal send in idle mode', () => {
    const { handleSend } = setup(false);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(handleSend).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /ABORT/ })).toBeNull();
  });
});
