import { render, waitFor, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BrowserTab from './BrowserTab';

const { created, closed, showed, hid, errorCallbacks } = vi.hoisted(() => ({
  created: vi.fn(), closed: vi.fn(), showed: vi.fn(), hid: vi.fn(),
  errorCallbacks: [] as Array<(error: unknown) => void>
}));

vi.mock('@tauri-apps/api/webview', () => ({
  Webview: class {
    static getByLabel = async () => null;
    label: string;
    constructor(_window: unknown, label: string) {
      this.label = label;
      created(label);
    }
    once(event: string, cb: (error: unknown) => void) {
      if (event === 'tauri://error') errorCallbacks.push(cb);
      return Promise.resolve();
    }
    close() { closed(); return Promise.resolve(); }
    show() { showed(); return Promise.resolve(); }
    hide() { hid(); return Promise.resolve(); }
    setPosition() { return Promise.resolve(); }
    setSize() { return Promise.resolve(); }
  }
}));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({}) }));
vi.mock('@tauri-apps/api/dpi', () => ({
  LogicalPosition: class { constructor(public x: number, public y: number) {} },
  LogicalSize: class { constructor(public width: number, public height: number) {} }
}));
vi.mock('./BrowserNavigationBar', () => ({ default: () => <div>Navigation</div> }));
vi.mock('./BrowserDevTools', () => ({ default: () => <div>DevTools</div> }));
vi.mock('./Modals', () => ({ ConfirmModal: () => null }));
vi.mock('../hooks/useBrowserListeners', () => ({ useBrowserListeners: () => undefined }));
vi.mock('../hooks/useBrowserStorageAndHistory', () => ({
  useBrowserStorageAndHistory: () => ({
    zoomFactor: 1, handleZoomIn: vi.fn(), handleZoomOut: vi.fn(), handleZoomReset: vi.fn(),
    bookmarks: [], setBookmarks: vi.fn(), removeBookmark: vi.fn(), updateBookmark: vi.fn(),
    history: [], setHistory: vi.fn(), removeHistoryItem: vi.fn(),
    storageData: { cookies: [], localStorage: [] }, fetchStorageData: vi.fn(),
    deleteCookie: vi.fn(), deleteLocalStorage: vi.fn(), handleNavigateToBookmark: vi.fn(),
    handleNavigateToHistory: vi.fn()
  })
}));

const tab = { id: 'browser-test', type: 'browser' as const, name: 'Preview', url: 'http://localhost:3000/' };

beforeEach(() => {
  vi.clearAllMocks();
  errorCallbacks.length = 0;
  sessionStorage.clear();
  Object.defineProperty(window, '__TAURI__', {
    configurable: true, value: { core: { invoke: vi.fn().mockResolvedValue('http://localhost:3000/') } }
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 800, height: 600,
    right: 800, bottom: 600, toJSON: () => ({})
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as typeof window & {__TAURI__?:unknown}).__TAURI__;
});

describe('native BrowserTab lifecycle', () => {
  it('preserves the native WebView2 on tab switch, closes only on real unmount', async () => {
    const rendered = render(<BrowserTab tab={tab} isActive={true} />);
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(showed).toHaveBeenCalled());

    rendered.rerender(<BrowserTab tab={tab} isActive={false} />);
    await waitFor(() => expect(hid).toHaveBeenCalled());
    expect(closed).not.toHaveBeenCalled();

    rendered.rerender(<BrowserTab tab={tab} isActive={true} />);
    await waitFor(() => expect(showed).toHaveBeenCalledTimes(2));
    expect(created).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();

    rendered.unmount();
    await waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
  });
  it('offers an isolated retry if WebView2 fails to initialize', async () => {
    const rendered = render(<BrowserTab tab={tab} isActive={true} />);
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(errorCallbacks.length).toBe(1);
    act(() => errorCallbacks[0]('webview creation failure'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry Browser' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Retry Browser' }));
    await waitFor(() => expect(created).toHaveBeenCalledTimes(2));
    rendered.unmount();
  });
});
