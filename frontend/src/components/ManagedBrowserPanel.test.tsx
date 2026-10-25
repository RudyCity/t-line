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
});
