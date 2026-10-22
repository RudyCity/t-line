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
          : { sessions };
    return { ok: true, json: async () => response };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
});
