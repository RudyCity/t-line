import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManagedBrowserLivePreview, { isSafeManagedFrame, isSafeBrowserStreamEvent } from './ManagedBrowserLivePreview';

const frame = { targetId: 'TAB1', dataUrl: 'data:image/jpeg;base64,/9j/ABCD==', capturedAt: 123456 };
describe('T-Line native managed browser read-only preview', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('strictly rejects images for other targets, external URLs and malformed frames', () => {
    expect(isSafeManagedFrame(frame, 'TAB1')).toBe(true);
    expect(isSafeManagedFrame({ ...frame, targetId: 'OTHER' }, 'TAB1')).toBe(false);
    expect(isSafeManagedFrame({ ...frame, dataUrl: 'https://public.example/sensitive' }, 'TAB1')).toBe(false);
    expect(isSafeManagedFrame({ ...frame, dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }, 'TAB1')).toBe(false);
    expect(isSafeManagedFrame({ ...frame, dataUrl: 'data:image/jpeg;base64,AAAA' }, 'TAB1')).toBe(false);
    expect(isSafeManagedFrame({ ...frame, dataUrl: 'data:image/jpeg;base64,/9j/' + 'A'.repeat(2_010_000) }, 'TAB1')).toBe(false);
  });
  it('rejects stale stream IDs and wrong target frames', () => {
    const safe = { ...frame, streamId: '100-1', transport: 'screencast' };
    expect(isSafeBrowserStreamEvent(safe, '100-1', 'TAB1')).toBe(true);
    expect(isSafeBrowserStreamEvent(safe, '100-2', 'TAB1')).toBe(false);
    expect(isSafeBrowserStreamEvent(safe, '100-1', 'OTHER')).toBe(false);
    expect(isSafeBrowserStreamEvent({ ...safe, transport: 'script' }, '100-1', 'TAB1')).toBe(false);
  });
  it('starts one stream, accepts matched native frames and stops on close', async () => {
    let listener: ((event: { payload?: unknown }) => void) | undefined;
    const unlisten = vi.fn();
    const listen = vi.fn(async (_name: string, callback: typeof listener) => {
      listener = callback;
      return unlisten;
    });
    const invoke = vi.fn(async (name: string) => {
      if (name === 'managed_browser_stream_start') return { streamId: '100-1' };
      if (name === 'managed_browser_stream_stop') return undefined;
      throw new Error('Unexpected command ' + name);
    });
    vi.stubGlobal('__TAURI__', { core: { invoke }, event: { listen } });
    const props = { profileId: 'default-managed', generation: '1-2',
      targetId: 'TAB1', onClose: vi.fn() };
    const ui = render(<ManagedBrowserLivePreview {...props} active/>);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_start', {
      profileId: 'default-managed', generation: '1-2', targetId: 'TAB1',
    }));
    act(() => listener?.({ payload: { ...frame, streamId: 'wrong', transport: 'screencast' } }));
    expect(screen.queryByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeNull();
    act(() => listener?.({ payload: { ...frame, streamId: '100-1', transport: 'snapshot' } }));
    expect(await screen.findByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeTruthy();
    expect(screen.getByText(/Live preview · read-only · snapshot/)).toBeTruthy();
    ui.rerender(<ManagedBrowserLivePreview {...props} active={false}/>);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_stop', { streamId: '100-1' }));
    expect(unlisten).toHaveBeenCalledTimes(1);
    expect(screen.queryByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeNull();
  });
  it('captures only when explicitly opened, then clears pixels when closed', async () => {
    const invoke = vi.fn(async () => frame);
    vi.stubGlobal('__TAURI__', { core: { invoke } });
    const close = vi.fn();
    const props = { profileId: 'default-managed', generation: '1-2', targetId: 'TAB1', onClose: close };
    const ui = render(<ManagedBrowserLivePreview {...props} active={false}/>);
    expect(invoke).not.toHaveBeenCalled();
    ui.rerender(<ManagedBrowserLivePreview {...props} active/>);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_capture', {
      profileId: 'default-managed', generation: '1-2', targetId: 'TAB1',
    }));
    expect((await screen.findByAltText('Live screenshot of the selected T-Line-managed browser tab') as HTMLImageElement).src)
      .toContain('data:image/jpeg;base64,/9j/');
    expect(screen.queryByRole('button', { name: /click page/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close live preview' }));
    expect(close).toHaveBeenCalledTimes(1);
    ui.rerender(<ManagedBrowserLivePreview {...props} active={false}/>);
    expect(screen.queryByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeNull();
  });
  it('fails closed for forged or invalid native screenshots', async () => {
    const invoke = vi.fn(async () => ({ ...frame, targetId: 'OTHER' }));
    vi.stubGlobal('__TAURI__', { core: { invoke } });
    render(<ManagedBrowserLivePreview profileId="testing" generation="2-3"
      targetId="TAB1" active onClose={() => {}}/>);
    expect(await screen.findByText(/Invalid local browser screenshot/)).toBeTruthy();
    expect(screen.queryByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeNull();
  });
});
