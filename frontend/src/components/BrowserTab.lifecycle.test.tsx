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
vi.mock('./BrowserNavigationBar', () => ({
  default: ({ urlInput, setUrlInput, handleNavigate, handleBack, handleForward }: {
    urlInput: string;
    setUrlInput: (url: string) => void;
    handleNavigate: (event: React.FormEvent) => void;
    handleBack: () => void;
    handleForward: () => void;
  }) => (
    <form onSubmit={handleNavigate}>
      <input aria-label="Browser URL" value={urlInput}
        onChange={event => setUrlInput(event.target.value)} />
      <button type="submit">Navigate</button>
      <button type="button" onClick={handleBack}>Back</button>
      <button type="button" onClick={handleForward}>Forward</button>
    </form>
  ),
}));
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
  it('does not advertise a new URL when the native navigation request fails', async () => {
    const onUpdateTabUrl = vi.fn();
    const invoke = (window as any).__TAURI__.core.invoke as ReturnType<typeof vi.fn>;
    invoke.mockImplementation(async (command: string, args?: { js?: string }) => {
      if (command === 'eval_webview_js' && args?.js?.includes('window.location.assign')) {
        throw new Error('Native navigation rejected');
      }
      return 'http://localhost:3000/';
    });
    const rendered = render(<BrowserTab tab={tab} isActive={true} onUpdateTabUrl={onUpdateTabUrl} />);
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('textbox', { name: 'Browser URL' }), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Navigation failed'));
    expect((screen.getByRole('textbox', { name: 'Browser URL' }) as HTMLInputElement).value).toBe(tab.url);
    expect(onUpdateTabUrl).not.toHaveBeenCalled();
    rendered.unmount();
  });
  it('navigates to HTTPS and routes Back/Forward to the actual native webview', async () => {
    const onUpdateTabUrl = vi.fn();
    const rendered = render(<BrowserTab tab={tab} isActive={true} onUpdateTabUrl={onUpdateTabUrl} />);
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('textbox', { name: 'Browser URL' }), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
    await waitFor(() => expect(onUpdateTabUrl).toHaveBeenCalledWith('https://example.com/'));
    const invoke = (window as any).__TAURI__.core.invoke as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(invoke).toHaveBeenCalledWith('eval_webview_js', expect.objectContaining({ js: 'window.history.back()' }));
    expect(invoke).toHaveBeenCalledWith('eval_webview_js', expect.objectContaining({ js: 'window.history.forward()' }));
    rendered.unmount();
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
