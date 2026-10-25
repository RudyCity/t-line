import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBrowserScreenshot } from '../hooks/useBrowserScreenshot';

describe('browser screenshot isolation', () => {
  afterEach(() => vi.restoreAllMocks());
  it('uses direct Electron capture and does not hide its browser surface', async () => {
    const capturePage = vi.fn(async () => ({ toDataURL: () => 'data:image/png;base64,AA==' }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useBrowserScreenshot('tab-x', true, { capturePage }));
    await act(async () => { await result.current(); });
    expect(capturePage).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls.some(([event]) => event.type === 'tline-hide-native-webview')).toBe(false);
  });
  it('handles a canceled native capture without reporting success', async () => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia: vi.fn(async () => { throw new Error('permission canceled'); }) },
    });
    try {
      const events: string[] = [];
      const handler = (e: Event) => events.push((e as CustomEvent).detail.message);
      window.addEventListener('tline-toast', handler);
      const dispatch = vi.spyOn(window, 'dispatchEvent');
      const { result } = renderHook(() => useBrowserScreenshot('tab-x', false, null));
      await act(async () => { await result.current(); });
      expect(events.some(message => message.includes('Screenshot not saved: permission canceled'))).toBe(true);
      expect(dispatch.mock.calls.some(([event]) => event.type === 'tline-hide-native-webview')).toBe(false);
      window.removeEventListener('tline-toast', handler);
    } finally { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: original }); }
  });
});
