import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { SuperAgentTaskMonitor } from '../SuperAgentTaskMonitor';
import { fetchTlineTaskSnapshot } from '../SuperAgentTaskSnapshot';
import { checkTaskSseCapability, readTaskSseStream } from '../SuperAgentTaskEvents';
import { getTaskCancelCapability, requestTaskCancellation } from '../SuperAgentTaskControls';

vi.mock('../SuperAgentTaskSnapshot', () => ({
  fetchTlineTaskSnapshot: vi.fn(),
}));
vi.mock('../SuperAgentTaskEvents', () => ({
  checkTaskSseCapability: vi.fn(),
  readTaskSseStream: vi.fn(),
}));
vi.mock('../SuperAgentTaskControls', () => ({
  getTaskCancelCapability: vi.fn(),
  requestTaskCancellation: vi.fn(),
}));
vi.mock('../SuperAgentConsoleUtils', () => ({
  getAuthHeader: () => ({ Authorization: 'Bearer test' }),
}));

const task = (id: string) => ({
  schemaVersion: 1 as const, channel: 'cli' as const, taskId: id,
  sessionId: null, status: 'running' as const, evidence: 'unverified' as const,
  authorization: 'workspace_scoped', notification: 'not_configured', updatedAt: Date.now(),
});
const snapshot = (id: string, cancelEligible = false) => ({
  snapshot: { success: true as const, schemaVersion: 1 as const,
    scope: 'workspace' as const, source: 'bounded-polling' as const,
    changed: true, cursor: 'a'.repeat(64), tasks: [{ ...task(id), cancelEligible }],
    total: 1, incompleteSources: [], replaySupported: false as const },
  negotiated: true as const,
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(checkTaskSseCapability).mockRejectedValue(new Error('SSE unavailable'));
  vi.mocked(readTaskSseStream).mockResolvedValue();
  vi.mocked(getTaskCancelCapability).mockResolvedValue(false);
  vi.mocked(requestTaskCancellation).mockResolvedValue('Cancellation requested.');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SuperAgentTaskMonitor UI', () => {
  it('stays idle while collapsed, then polls and renders workspace-specific task evidence', async () => {
    vi.mocked(fetchTlineTaskSnapshot).mockResolvedValue(snapshot('job-my-project'));
    render(<SuperAgentTaskMonitor workspace="D:/my" sessionId="chat1" />);
    expect(fetchTlineTaskSnapshot).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Cross-channel tasks/ }));
    await waitFor(() => expect(screen.getByText('job-my-project')).toBeTruthy());
    expect(screen.getByText('unverified')).toBeTruthy();
    expect(vi.mocked(fetchTlineTaskSnapshot).mock.calls[0][0]).toBe('D:/my');
  });

  it('renders SSE frames and stops snapshot polling while streaming is connected', async () => {
    vi.mocked(fetchTlineTaskSnapshot).mockResolvedValue(snapshot('polling-initial'));
    vi.mocked(checkTaskSseCapability).mockResolvedValue();
    vi.mocked(readTaskSseStream).mockImplementation(async (_workspace, _session, _auth, onEvent, opts) => {
      onEvent({ type: 'snapshot', id: 'c'.repeat(16) + '.1', snapshot: {
        ...snapshot('live-from-sse').snapshot,
      } });
      await new Promise<void>(resolve => opts?.signal?.addEventListener('abort', () => resolve(), { once: true }));
    });
    render(<SuperAgentTaskMonitor workspace="D:/my" sessionId="chat1" />);
    fireEvent.click(screen.getByRole('button', { name: /Cross-channel tasks/ }));
    await waitFor(() => expect(screen.getByText('live-from-sse')).toBeTruthy());
    expect(screen.getByText(/SSE live, bounded replay/)).toBeTruthy();
    expect(vi.mocked(readTaskSseStream).mock.calls[0][1]).toBe('chat1');
  });

  it('hides task cancel by default and requires a direct user confirmation when operator enables it', async () => {
    const id = 'clj_1792480000000_deadbeef';
    vi.mocked(fetchTlineTaskSnapshot).mockResolvedValue(snapshot(id, true));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { rerender } = render(<SuperAgentTaskMonitor workspace="D:/mine" sessionId="sess_owner" />);
    fireEvent.click(screen.getByRole('button', { name: /Cross-channel tasks/ }));
    await waitFor(() => expect(screen.getByText(id)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Cancel task ' + id })).toBeNull();
    vi.mocked(getTaskCancelCapability).mockResolvedValue(true);
    fireEvent.click(screen.getByRole('button', { name: /Refresh task monitor/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel task ' + id })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel task ' + id }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(requestTaskCancellation).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel task ' + id }));
    await waitFor(() => expect(requestTaskCancellation).toHaveBeenCalledOnce());
    expect(vi.mocked(requestTaskCancellation).mock.calls[0].slice(0, 3))
      .toEqual(['D:/mine', 'sess_owner', id]);
    vi.mocked(getTaskCancelCapability).mockResolvedValue(false);
    rerender(<SuperAgentTaskMonitor workspace="D:/other" sessionId="sess_new" />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel task ' + id })).toBeNull());
  });

  it('discards a stale snapshot when the workspace changes before the response arrives', async () => {
    let resolveFirst!: (value: ReturnType<typeof snapshot>) => void;
    vi.mocked(fetchTlineTaskSnapshot)
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockResolvedValue(snapshot('job-second'));
    const { rerender } = render(<SuperAgentTaskMonitor workspace="D:/one" sessionId="chat1" />);
    fireEvent.click(screen.getByRole('button', { name: /Cross-channel tasks/ }));
    await waitFor(() => expect(fetchTlineTaskSnapshot).toHaveBeenCalledTimes(1));
    rerender(<SuperAgentTaskMonitor workspace="D:/two" sessionId="chat2" />);
    await waitFor(() => expect(screen.getByText('job-second')).toBeTruthy());
    resolveFirst(snapshot('job-secret-from-old-workspace'));
    await Promise.resolve();
    expect(screen.queryByText('job-secret-from-old-workspace')).toBeNull();
  });
});
