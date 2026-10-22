import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BrowserAgentSessions from './BrowserAgentSessions';

describe('BrowserAgentSessions', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('shows active browser claims without exposing capabilities', async () => {
    const now = Date.now();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        summary: { activeAgents: 1, activeTabs: 1, queued: 2, extensionBlocked: true },
        sessions: [{ key: 'aaa', port: 9222, targetId: 'TARGET_123456', agentId: 'qa-agent', claimedAt: now, expiresAt: now + 60_000 }],
        queues: [{ resourceKey: 'aaa', waiting: 2, locked: true, oldestWaitMs: 4000 }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<BrowserAgentSessions active={true} />);
    await waitFor(() => expect(screen.getByText('1 tabs')).toBeTruthy());
    expect(screen.getByText('Extension gated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle browser agent sessions' }));
    expect(screen.getByText('qa-agent')).toBeTruthy();
    expect(screen.getByText(/oldest 4s/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/superagent/browser/sessions', expect.objectContaining({ cache: 'no-store' }));
    expect(document.body.textContent).not.toContain('sessionToken');
  });
  it('does not poll when browser tab is inactive', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<BrowserAgentSessions active={false} />);
    expect(container.textContent).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
