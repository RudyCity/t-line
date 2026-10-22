import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SuperAgentBrainExplorer } from '../SuperAgentBrainExplorer';

const sessions = [{ sessionId: 'sess_local', createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T02:00:00Z' }];
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const response = String(url).includes('/file?')
      ? { content: 'analyzed data' }
      : String(url).endsWith('/files')
        ? { files: [{ path: 'artifacts/report.md', bytes: 13 }] }
        : String(url).endsWith('/jobs')
          ? { jobs: [{ jobId: 'clj_1792638000000_deadbeef', cli: 'agy', status: 'succeeded', completionState: 'artifacts_verified', startedAt: 1, updatedAt: 2 }] }
          : String(url).endsWith('/storage')
            ? { totalBytes: 13, areas: [{ area: 'artifacts', bytes: 13, files: 1 }] }
            : String(url).endsWith('/projects')
              ? { projects: [{ id: 'sample-project', name: 'Sample Project' }] }
              : String(url).includes('/retention/preview')
                ? { days: 30, dryRun: true, autoDelete: false, candidates: [], totalCandidateBytes: 0 }
                : { sessions };
    return { ok: true, json: async () => response };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('T-Line Brain Explorer UI', () => {
  it('loads local sessions, file list and preview without switching projects', async () => {
    const onClose = vi.fn();
    render(<SuperAgentBrainExplorer activeSessionId="sess_local" onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('sess_local')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('artifacts/report.md')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('agy · clj_1792638000000_deadbeef')).toBeTruthy());
    fireEvent.click(screen.getByText('artifacts/report.md'));
    await waitFor(() => expect(screen.getByTestId('brain-preview').textContent).toBe('analyzed data'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Brain Explorer' }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(3));
    fireEvent.click(screen.getByRole('button', { name: 'Close Brain Explorer' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('requires explicit UI confirmation for cleanup and publish and sends no direct project path', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(fetch).mockImplementation(async (url: any, init: any) => {
      const text = String(url);
      if (text.endsWith('/cleanup/prepare')) return { ok: true, json: async () => ({ challenge: 'a'.repeat(48), preview: { files: 1, bytes: 9, retained: ['artifacts/'] } }) } as any;
      if (text.endsWith('/publish/prepare')) return { ok: true, json: async () => ({ challenge: 'b'.repeat(48), preview: { bytes: 13, projectRoot: 'D:/approved', destinationPath: 'docs/report.md', overwrite: false } }) } as any;
      if (text.endsWith('/cleanup/confirm') || text.endsWith('/publish/confirm')) return { ok: true, json: async () => ({ success: true }) } as any;
      return original(url, init);
    });
    render(<SuperAgentBrainExplorer activeSessionId="sess_local" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('artifacts/report.md')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Preview cleanup' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/cleanup/confirm'))).toHaveLength(0);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText('artifacts/report.md'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Destination relative path' }), { target: { value: 'docs/report.md' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview publish' }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/publish/confirm'))).toBe(true));
    const published = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/publish/prepare'))!;
    const body = JSON.parse(String(published[1]?.body));
    expect(body.projectId).toBe('sample-project');
    expect(body.filePath).toBe('artifacts/report.md');
    expect(body.destinationPath).toBe('docs/report.md');
    expect(body.projectRoot).toBeUndefined();
  });

  it('searches indexed Brain results and saves a summary only in the selected session', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url: any, init: any) => {
      if (String(url).includes('/search?q=generated')) return { ok: true, json: async () => ({
        records: [{sessionId:'sess_local',path:'artifacts/report.md',summary:'Generated analysis',tags:['report'],bytes:13}],
      }) } as any;
      if (String(url).endsWith('/annotate')) return { ok: true, json: async () => ({ sessionId:'sess_local' }) } as any;
      return original(url, init);
    });
    render(<SuperAgentBrainExplorer activeSessionId="sess_local" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('artifacts/report.md')).toBeTruthy());
    fireEvent.change(screen.getByRole('textbox', {name:'Search Brain artifacts'}), { target: { value:'generated' } });
    fireEvent.click(screen.getByRole('button', {name:'Find'}));
    await waitFor(() => expect(screen.getByText('Generated analysis')).toBeTruthy());
    fireEvent.click(screen.getByText('Generated analysis'));
    fireEvent.change(screen.getByRole('textbox', {name:'Brain artifact summary'}), {target:{value:'Human reviewed report'}});
    fireEvent.click(screen.getByRole('button', {name:'Save annotation'}));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/annotate'))).toBe(true));
    const args = vi.mocked(fetch).mock.calls.find(([url])=>String(url).endsWith('/annotate'))!;
    expect(JSON.parse(String(args[1]?.body))).toMatchObject({filePath:'artifacts/report.md',summary:'Human reviewed report'});
  });

  it('uploads an explicitly selected binary artifact to the current Brain only', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url: any, init: any) => {
      if (String(url).includes('/artifacts/import')) return { ok: true, json: async () => ({ success: true }) } as any;
      return original(url, init);
    });
    render(<SuperAgentBrainExplorer activeSessionId="sess_local" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('sess_local')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Import Brain artifact'), { target: { files: [new File(['binary'], 'preview.png', { type: 'image/png' })] } });
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/artifacts/import?name=preview.png'))).toBe(true));
    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/artifacts/import?name=preview.png'))!;
    expect(call[1]?.method).toBe('POST');
    expect(call[1]?.headers).toMatchObject({ 'Content-Type': 'application/octet-stream' });
  });
});
