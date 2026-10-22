import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionRecoveryPanel } from '../MotionRecoveryPanel';
import { motionStudioApi } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({
  motionStudioApi: { history: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(motionStudioApi.history).mockResolvedValue({
    snapshots: [{ revision: 2, name: 'Original', updatedAt: '2026-10-22T02:00:00Z' },
      { revision: 1, name: 'Original', updatedAt: '2026-10-22T01:00:00Z' }],
  });
});
afterEach(() => cleanup());

describe('Motion recovery UI', () => {
  it('loads historical revisions and invokes explicit restore only when requested', async () => {
    const onRestore = vi.fn();
    render(<MotionRecoveryPanel workspacePath="D:/workspace" projectId={'motion-' + 'a'.repeat(20)}
      revision={3} busy={false} onRestore={onRestore} />);
    await screen.findByText('2 snapshots');
    fireEvent.click(screen.getByText('Auto-saved revisions'));
    expect(screen.getByText('Revision 2')).toBeInTheDocument();
    expect(onRestore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Motion revision 2' }));
    expect(onRestore).toHaveBeenCalledWith(2);
  });
  it('reloads history when committed revision changes and disables buttons while saving', async () => {
    const projectId = 'motion-' + 'a'.repeat(20);
    const onRestore = vi.fn();
    const ui = render(<MotionRecoveryPanel workspacePath="D:/workspace" projectId={projectId}
      revision={3} busy onRestore={onRestore} />);
    await screen.findByText('2 snapshots');
    fireEvent.click(screen.getByText('Auto-saved revisions'));
    expect(screen.getByRole('button', { name: 'Restore Motion revision 2' })).toBeDisabled();
    ui.rerender(<MotionRecoveryPanel workspacePath="D:/workspace" projectId={projectId}
      revision={4} busy={false} onRestore={onRestore} />);
    await waitFor(() => expect(motionStudioApi.history).toHaveBeenCalledTimes(2));
  });
});
