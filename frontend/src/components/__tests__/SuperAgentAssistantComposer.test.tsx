import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SuperAgentInputContainer } from '../SuperAgentInputContainer';

afterEach(cleanup);
function setup(loading: boolean) {
  const handleSend = vi.fn();
  const handleAbort = vi.fn();
  render(<SuperAgentInputContainer
    input="Please investigate the next issue"
    setInput={vi.fn()} handleKeyDown={vi.fn()}
    handleSend={handleSend} handleAbort={handleAbort}
    loading={loading}
    ws={{ readyState: WebSocket.OPEN } as WebSocket}
    attachments={[]}
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
  return { handleSend, handleAbort };
}

describe('assistant composer during active work', () => {
  it('allows follow-up instruction without aborting the active turn', () => {
    const { handleSend, handleAbort } = setup(true);
    const text = screen.getByRole('textbox');
    expect((text as HTMLTextAreaElement).disabled).toBe(false);
    expect(screen.getByPlaceholderText(/it will queue behind the active turn/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Queue follow-up' }));
    expect(handleSend).toHaveBeenCalledOnce();
    expect(handleAbort).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /ABORT/ }));
    expect(handleAbort).toHaveBeenCalledOnce();
  });
  it('still presents normal send in idle mode', () => {
    const { handleSend } = setup(false);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(handleSend).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /ABORT/ })).toBeNull();
  });
});
