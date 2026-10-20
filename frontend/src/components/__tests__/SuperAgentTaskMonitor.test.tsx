import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { SuperAgentTaskMonitor } from '../SuperAgentTaskMonitor';
import { fetchTlineTaskSnapshot } from '../SuperAgentTaskSnapshot';

vi.mock('../SuperAgentTaskSnapshot', () => ({
  fetchTlineTaskSnapshot: vi.fn(),
}));
vi.mock('../SuperAgentConsoleUtils', () => ({
  getAuthHeader: () => ({ Authorization: 'Bearer test' }),
}));

const task = (id: string) => ({
  schemaVersion: 1 as const, channel: 'cli' as const, taskId: id,
  sessionId: null, status: 'running' as const, evidence: 'unverified' as const,
  authorization: 'workspace_scoped', notification: 'not_configured', updatedAt: Date.now(),
});
const snapshot = (id: string) => ({
  snapshot: { success: true as const, schemaVersion: 1 as const,
    scope: 'workspace' as const, source: 'bounded-polling' as const,
    changed: true, cursor: 'a'.repeat(64), tasks: [task(id)],
    total: 1, incompleteSources: [], replaySupported: false as const },
  negotiated: true as const,
});
beforeEach(() => vi.resetAllMocks());
afterEach(() => cleanup());

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
