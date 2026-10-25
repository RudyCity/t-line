import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManagedBrowserLivePreview, { isSafeManagedFrame } from './ManagedBrowserLivePreview';

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
