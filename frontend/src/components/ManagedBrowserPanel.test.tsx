import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManagedBrowserPanel from './ManagedBrowserPanel';
import { isValidManagedProfile, safeManagedLaunchUrl } from './managedBrowserTypes';

describe('managed browser safety contract', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('rejects non-web schemes, encoded secrets and path traversal', () => {
    expect(isValidManagedProfile('default-managed')).toBe(true);
    expect(isValidManagedProfile('../personal-profile')).toBe(false);
    expect(isValidManagedProfile('C:\\Users\\Public')).toBe(false);
    expect(() => safeManagedLaunchUrl('https://example.org/?session=private')).toThrow();
    expect(() => safeManagedLaunchUrl('file:///C:/secrets')).toThrow();
    expect(safeManagedLaunchUrl('https://example.org/docs')).toBe('https://example.org/docs');
  });
  it('never starts a browser until explicit opt-in and confirmation', async () => {
    const invoke = vi.fn(async (name: string) => {
      if (name === 'managed_browser_discover') return { available: true, engine: 'system-chrome' };
      if (name === 'managed_browser_status') return [];
      return { profileId: 'default-managed', generation: 'owned-generation', lifecycle: 'ready', debuggingAvailable: true };
    });
    vi.stubGlobal('__TAURI__', { core: { invoke } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ManagedBrowserPanel active initialUrl="https://example.org" />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle managed browser' }));
    expect(screen.queryByRole('button', { name: 'Launch Chrome' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable managed browser' }));
    await screen.findByText(/Installed Chrome detected/);
    fireEvent.click(screen.getByRole('button', { name: 'Launch Chrome' }));
    expect(confirm).toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalledWith('managed_browser_launch', expect.anything());
  });
  it('sanitizes URL at process boundary and uses owned generation for stop', async () => {
    const runtime = { profileId: 'default-managed', generation: 'owned-generation', lifecycle: 'ready', debuggingAvailable: true };
    let running = false;
    const invoke = vi.fn(async (name: string) => {
      if (name === 'managed_browser_discover') return { available: true, engine: 'system-chrome' };
      if (name === 'managed_browser_status') return running ? [runtime] : [];
      if (name === 'managed_browser_launch') { running = true; return runtime; }
      if (name === 'managed_browser_stop') { running = false; return null; }
      if (name === 'managed_browser_targets') return [];
      return null;
    });
    vi.stubGlobal('__TAURI__', { core: { invoke } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ManagedBrowserPanel active initialUrl="https://example.org/?token=topsecret" />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle managed browser' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable managed browser' }));
    await screen.findByText(/Installed Chrome detected/);
    fireEvent.click(screen.getByRole('button', { name: 'Launch Chrome' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_launch',
      { profileId: 'default-managed', initialUrl: 'about:blank' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Stop owned browser/i })).not.toHaveProperty('disabled', true));
    fireEvent.click(screen.getByRole('button', { name: /Stop owned browser/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stop',
      { profileId: 'default-managed', generation: 'owned-generation' }));
  });
  it('pairs only an owned tab after explicit confirmation and uses the native result', async () => {
    const runtime = { profileId: 'default-managed', generation: '456-789', lifecycle: 'ready', debuggingAvailable: true };
    const invoke = vi.fn(async (command: string) => {
      if (command === 'managed_browser_discover') return { available: true, engine: 'system-chrome' };
      if (command === 'managed_browser_status') return [runtime];
      if (command === 'managed_browser_targets') return [{ id: 'TARGET1', title: 'Test page', url: 'https://example.org/' }];
      if (command === 'managed_browser_gateway_register') return {
        registered: true, expiresAt: Date.now() + 90_000,
      };
      if (command === 'managed_browser_gateway_pairing') return {
        profileId: runtime.profileId, generation: runtime.generation, port: 53333,
        targetId: 'TARGET1', transport: 'superagent_browser_gateway',
      };
      throw new Error('Unexpected native call');
    });
    vi.stubGlobal('__TAURI__', { core: { invoke } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onSendToAgent = vi.fn((_instruction: string) => true);
    render(<ManagedBrowserPanel active initialUrl="about:blank" onSendToAgent={onSendToAgent} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle managed browser' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable managed browser' }));
    const pair = await screen.findByRole('button', { name: 'Pair agent with Test page' });
    expect(invoke).not.toHaveBeenCalledWith('managed_browser_gateway_pairing', expect.anything());
    fireEvent.click(pair);
    expect(confirm).toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalledWith('managed_browser_gateway_pairing', expect.anything());
    expect(onSendToAgent).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(pair);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_gateway_pairing',
      { profileId: 'default-managed', generation: '456-789', targetId: 'TARGET1' }));
    expect((await screen.findByLabelText('Verified MCP gateway handoff (assistant request or manual copy)') as HTMLTextAreaElement).value)
      .toContain('action=claim, port=53333, targetId=TARGET1');
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_gateway_register',
      { profileId: 'default-managed', generation: '456-789', targetId: 'TARGET1' }));
    await waitFor(() => expect(onSendToAgent).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Native runtime registered with local Core/)).toBeTruthy();
    expect(onSendToAgent.mock.calls[0][0]).toContain('action=claim, port=53333, targetId=TARGET1');
    expect(screen.getByText(/Pairing instruction routed to your workspace assistant/)).toBeTruthy();
    expect(invoke).not.toHaveBeenCalledWith('managed_browser_launch', expect.anything());
  });
  it('keeps disconnected browser unpaired and offers a clean recovery profile', async () => {
    const invoke = vi.fn(async (name: string) => {
      if (name === 'managed_browser_discover') return { available: true, engine: 'system-chrome' };
      if (name === 'managed_browser_status') return [{
        profileId: 'default-managed', generation: '123-456',
        lifecycle: 'disconnected', debuggingAvailable: false,
      }];
      throw new Error('Disconnected runtime cannot enumerate targets');
    });
    vi.stubGlobal('__TAURI__', { core: { invoke } });
    render(<ManagedBrowserPanel active initialUrl="about:blank" />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle managed browser' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable managed browser' }));
    expect(await screen.findByText(/Chrome is still owned by T-Line/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Refresh tabs' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Pair agent with/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Profile'), { target: { value: 'recovery' } });
    expect(screen.getByText(/The recovery profile starts empty/)).toBeTruthy();
    expect(invoke).not.toHaveBeenCalledWith('managed_browser_gateway_pairing', expect.anything());
  });
  it('never sends a browser agent request if native Core registration is rejected', async () => {
    const runtime = { profileId: 'default-managed', generation: '789-17929200000000',
      lifecycle: 'ready', debuggingAvailable: true };
    const invoke = vi.fn(async (command: string) => {
      if (command === 'managed_browser_discover') return { available: true, engine: 'system-chrome' };
      if (command === 'managed_browser_status') return [runtime];
      if (command === 'managed_browser_targets') return [{ id: 'TAB1', title: 'Safe test', url: 'https://example.org' }];
      if (command === 'managed_browser_gateway_pairing') return {
        profileId: runtime.profileId, generation: runtime.generation, port: 53333,
        targetId: 'TAB1', transport: 'superagent_browser_gateway',
      };
      if (command === 'managed_browser_gateway_register') throw new Error('Service offline');
      throw new Error('Unexpected native call');
    });
    vi.stubGlobal('__TAURI__', { core: { invoke } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSendToAgent = vi.fn((_instruction: string) => true);
    render(<ManagedBrowserPanel active initialUrl="about:blank" onSendToAgent={onSendToAgent} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle managed browser' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable managed browser' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pair agent with Safe test' }));
    expect(await screen.findByText(/Core registration not confirmed; manual pairing only/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy for assistant' })).toBeTruthy();
    expect(onSendToAgent).not.toHaveBeenCalled();
  });
});
