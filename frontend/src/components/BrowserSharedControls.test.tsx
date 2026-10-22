import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BrowserSharedControls from './BrowserSharedControls';

const session = {
  key: 'owner-key', port: 9222, targetId: 'TAB_A', agentId: 'owner',
  mode: 'shared' as const,
  participants: [
    { agentId: 'owner', role: 'owner' as const },
    { agentId: 'worker', role: 'contributor' as const },
  ],
};
describe('BrowserSharedControls token-gated owner operations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requires owner token, sends an allowlisted request and keeps invitation ephemeral', async () => {
    const onChanged = vi.fn();
    const fetchMock = vi.fn(async (_url: unknown, _opts: unknown) => ({
      ok: true, json: async () => ({
        success: true, result: {
          inviteId: 'invite-one', invitationToken: 'secret-invite-value', agentId: 'reviewer',
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<BrowserSharedControls session={session} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage shared tab TAB_A' }));
    const invite = screen.getByRole('button', { name: /Invite/i });
    expect((invite as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Owner token TAB_A'), { target: { value: 'private-owner-capability' } });
    fireEvent.change(screen.getByLabelText('New participant agent ID'), { target: { value: 'reviewer' } });
    expect((invite as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(invite);
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/superagent/browser/shared-control');
    expect(options.cache).toBe('no-store');
    expect(JSON.parse(options.body as string)).toMatchObject({
      action: 'invite', agentId: 'owner', memberId: 'reviewer', role: 'observer',
      sessionToken: 'private-owner-capability',
    });
    expect(screen.getByText('One-time invitation for reviewer')).toBeTruthy();
    expect(document.body.textContent).not.toContain('private-owner-capability');
    expect(document.body.textContent).not.toContain('secret-invite-value');
    fireEvent.click(screen.getByText('Close controls'));
    expect(screen.queryByText('One-time invitation for reviewer')).toBeNull();
    unmount();
  });

  it('does not hand over to a contributor without explicit confirmation', async () => {
    const onChanged = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', () => false);
    render(<BrowserSharedControls session={session} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage shared tab TAB_A' }));
    fireEvent.change(screen.getByLabelText('Owner token TAB_A'), { target: { value: 'secret-owner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Handover to worker' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
