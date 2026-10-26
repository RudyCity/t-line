import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManagedBrowserPanel from './ManagedBrowserPanel';

describe('single shared Chrome tab handoff', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('takes human control, pauses input for agent, and resumes on the same target', async () => {
    const runtime = { profileId: 'default-managed', generation: '1000-1793000000000000',
      lifecycle: 'ready', debuggingAvailable: true, embedded: true, engine: 'system-chrome' };
    let launched = false;
    const invoke = vi.fn(async (command: string, args?: Record<string, any>) => {
      switch (command) {
        case 'managed_browser_discover': return { available: true, engine: 'system-chrome' };
        case 'managed_browser_status': return launched ? [runtime] : [];
        case 'managed_browser_launch': launched = true; return runtime;
        case 'managed_browser_targets': return [{ id: 'PAGE1', title: 'Shared', url: 'https://example.org/' }];
        case 'managed_browser_control_mode': return { mode: args?.mode };
        case 'managed_browser_gateway_pairing': return { profileId: runtime.profileId, generation: runtime.generation,
          port: 53331, targetId: 'PAGE1', transport: 'superagent_browser_gateway' };
        case 'managed_browser_gateway_register': return { registered: true, expiresAt: Date.now() + 90_000 };
        case 'managed_browser_capture': return { targetId: 'PAGE1', dataUrl: 'data:image/jpeg;base64,/9j/ABCD==', capturedAt: Date.now() };
        case 'managed_browser_stream_start': return { streamId: '400-1' };
        case 'get_memory_usage': return { desktopTotal: 10485760 };
        case 'managed_browser_interact': return null;
        default: return null;
      }
    });
    vi.stubGlobal('__TAURI__', { core: { invoke } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSendToAgent = vi.fn(() => true);
    render(<ManagedBrowserPanel active initialUrl="https://example.org/" onSendToAgent={onSendToAgent}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle managed browser' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable managed browser' }));
    await screen.findByText(/Installed Chrome detected/);
    fireEvent.click(screen.getByRole('button', { name: 'Open Chrome inside T-Line' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Connect Agent' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_control_mode', {
      profileId: runtime.profileId, generation: runtime.generation, targetId: 'PAGE1', mode: 'human',
    }));
    expect(onSendToAgent).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Return to Agent' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Return to Agent' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_control_mode', {
      profileId: runtime.profileId, generation: runtime.generation, targetId: 'PAGE1', mode: 'agent',
    }));
    await waitFor(() => expect(screen.queryByRole('application', { name: 'Interactive Chrome viewport' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Chrome Back' }));
    expect(invoke).not.toHaveBeenCalledWith('managed_browser_interact', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Take Control' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Return to Agent' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Chrome Back' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_interact',
      { profileId: runtime.profileId, generation: runtime.generation, targetId: 'PAGE1',
        interaction: { type: 'back' } }));
  });
});
