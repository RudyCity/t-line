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
    const safe = { ...frame, streamId: '100-1', transport: 'screencast', sequence: 1 };
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
      if (name === 'managed_browser_stream_stop' || name === 'managed_browser_stream_ack') return undefined;
      if (name === 'managed_browser_stream_stats') return {
        streamId: '100-1', sent: 1, acknowledged: 1, dropped: 0, inFlight: false, lastAckMs: 13, elapsedMs: 1000,
      };
      throw new Error('Unexpected command ' + name);
    });
    vi.stubGlobal('__TAURI__', { core: { invoke }, event: { listen } });
    const props = { profileId: 'default-managed', generation: '1-2',
      targetId: 'TAB1', onClose: vi.fn() };
    const ui = render(<ManagedBrowserLivePreview {...props} active/>);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_start', {
      profileId: 'default-managed', generation: '1-2', targetId: 'TAB1',
    }));
    act(() => listener?.({ payload: { ...frame, streamId: 'wrong', transport: 'screencast', sequence: 1 } }));
    expect(screen.queryByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeNull();
    act(() => listener?.({ payload: { ...frame, streamId: '100-1', transport: 'snapshot', sequence: 1 } }));
    expect(await screen.findByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeTruthy();
    expect(screen.getByText(/Live preview · read-only · snapshot/)).toBeTruthy();
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_ack', {
      streamId: '100-1', sequence: 1,
    }));
    ui.rerender(<ManagedBrowserLivePreview {...props} active={false}/>);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_stop', { streamId: '100-1' }));
    expect(unlisten).toHaveBeenCalledTimes(1);
    expect(screen.queryByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeNull();
  });
  it('buffers the first frame until native start returns its verified stream ID', async () => {
    let listener: ((event: { payload?: unknown }) => void) | undefined;
    const unlisten = vi.fn();
    let resolveStart!: (value: unknown) => void;
    const start = new Promise<unknown>(resolve => { resolveStart = resolve; });
    const invoke = vi.fn(async (name: string) => {
      if (name === 'managed_browser_stream_start') return await start;
      if (name === 'managed_browser_stream_ack' || name === 'managed_browser_stream_stop') return undefined;
      if (name === 'get_memory_usage') return { desktopTotal: 104857600 };
      throw new Error('Unexpected native command: ' + name);
    });
    vi.stubGlobal('__TAURI__', { core: { invoke }, event: {
      listen: vi.fn(async (_topic: string, callback: typeof listener) => {
        listener = callback;
        return unlisten;
      }),
    } });
    const props = { profileId: 'default-managed', generation: '7-8',
      targetId: 'TAB1', active: true, onClose: vi.fn() };
    const ui = render(<ManagedBrowserLivePreview {...props} />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_start', {
      profileId: 'default-managed', generation: '7-8', targetId: 'TAB1',
    }));
    act(() => listener?.({ payload: { ...frame, streamId: '999-1', transport: 'snapshot', sequence: 1 } }));
    expect(screen.queryByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeNull();
    await act(async () => { resolveStart({ streamId: '999-1' }); });
    expect(await screen.findByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeTruthy();
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_ack', {
      streamId: '999-1', sequence: 1,
    }));
    ui.rerender(<ManagedBrowserLivePreview {...props} active={false}/>);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_stop', { streamId: '999-1' }));
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
  it('stops the exact native stream and clears browser pixels when window becomes hidden', async () => {
    let listener: ((event: { payload?: unknown }) => void) | undefined;
    const invoke = vi.fn(async (name: string) => {
      if (name === 'managed_browser_stream_start') return { streamId: '300-1' };
      if (name === 'managed_browser_stream_stop' || name === 'managed_browser_stream_ack') return undefined;
      if (name === 'get_memory_usage') return { desktopTotal: 80 * 1024 * 1024 };
      throw new Error('Unexpected native command ' + name);
    });
    vi.stubGlobal('__TAURI__', { core: { invoke }, event: {
      listen: async (_topic: string, callback: typeof listener) => {
        listener = callback;
        return () => {};
      },
    } });
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const ui = render(<ManagedBrowserLivePreview profileId="default-managed" generation="300-400"
      targetId="TAB1" active onClose={() => {}}/>);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_start', {
      profileId: 'default-managed', generation: '300-400', targetId: 'TAB1',
    }));
    act(() => listener?.({ payload: { ...frame, streamId: '300-1', sequence: 1, transport: 'snapshot' } }));
    expect(await screen.findByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeTruthy();
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('managed_browser_stream_stop', { streamId: '300-1' }));
    expect(screen.queryByAltText('Live screenshot of the selected T-Line-managed browser tab')).toBeNull();
    expect(screen.getByText(/Live preview · read-only · paused/)).toBeTruthy();
    ui.unmount();
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
  it('forwards pointer, scroll and keyboard only when interactive and focused', async () => {
    const invoke = vi.fn(async () => frame);
    vi.stubGlobal('__TAURI__', { core: { invoke } });
    const onInteraction = vi.fn();
    const view = render(<ManagedBrowserLivePreview
      profileId="testing" generation="2-3" targetId="TAB1" active
      onClose={() => {}} interactive fill onInteraction={onInteraction}/>);
    const image = await screen.findByAltText('Live screenshot of the selected T-Line-managed browser tab') as HTMLImageElement;
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 800 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 400 });
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 400, height: 200,
      right: 400, bottom: 200, toJSON: () => ({}),
    });
    fireEvent.click(image, { clientX: 50, clientY: 60 });
    expect(onInteraction).toHaveBeenCalledWith({ type: 'click', x: 100, y: 120 });
    fireEvent.wheel(image, { clientX: 50, clientY: 60, deltaY: 300 });
    expect(onInteraction).toHaveBeenCalledWith({ type: 'scroll', x: 100, y: 120, delta_y: 300 });
    const viewport = screen.getByRole('application', { name: 'Interactive Chrome viewport' });
    fireEvent.keyDown(viewport, { key: 'Enter' });
    fireEvent.keyDown(viewport, { key: 'a' });
    expect(onInteraction).toHaveBeenCalledWith({ type: 'key', key: 'Enter' });
    expect(onInteraction).toHaveBeenCalledWith({ type: 'text', text: 'a' });
    view.rerender(<ManagedBrowserLivePreview
      profileId="testing" generation="2-3" targetId="TAB1" active
      onClose={() => {}} interactive={false} onInteraction={onInteraction}/>);
    onInteraction.mockClear();
    fireEvent.click(screen.getByAltText('Live screenshot of the selected T-Line-managed browser tab'), {
      clientX: 50, clientY: 60,
    });
    expect(onInteraction).not.toHaveBeenCalled();
    view.unmount();
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
