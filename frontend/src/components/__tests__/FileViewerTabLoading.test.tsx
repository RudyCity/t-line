import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FileViewerTab } from '../FileViewerTab';

// Keep Monaco's bootstrap unresolved to test that file text is usable
// independently of the expensive editor bundle.
vi.mock('../monacoSetup', () => ({ monaco: {} }));
vi.mock('@monaco-editor/react', () => ({
  default: () => null,
  loader: { config: vi.fn(), init: vi.fn(() => new Promise(() => {})) },
}));

describe('FileViewerTab loading', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('displays editable content even while Monaco has not initialized', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: 'console.log("ready");', truncated: false }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<FileViewerTab filePath="D:/workspace/example.ts" token="test-token" />);
    const editor = await screen.findByRole('textbox', { name: 'File content editor' });
    expect(editor).toHaveValue('console.log("ready");');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/fs/read?path=D%3A%2Fworkspace%2Fexample.ts',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
    );
  });

  it('shows read errors and allows a retry without auto-saving an error placeholder', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: 'hello' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<FileViewerTab filePath="D:/workspace/test.txt" token="token" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 403');
    expect(screen.queryByRole('textbox', { name: 'File content editor' })).not.toBeInTheDocument();
    // Wait beyond the auto-save debounce: failed reads must never POST /write.
    await new Promise(resolve => setTimeout(resolve, 1200));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('textbox', { name: 'File content editor' })).toHaveValue('hello');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
