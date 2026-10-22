import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudioRecoveryPanel } from '../StudioRecoveryPanel';
import { studioApi } from '../../services/studioApi';

vi.mock('../../services/studioApi', () => ({
  studioApi: { history: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(studioApi.history).mockResolvedValue({
    snapshots: [{ revision: 2, name: 'Original', updatedAt: '2026-10-22T02:00:00Z' },
      { revision: 1, name: 'Original', updatedAt: '2026-10-22T01:00:00Z' }],
  });
});
afterEach(() => cleanup());

describe('Studio recovery UI', () => {
  it('loads historical revisions and invokes explicit restore only when requested', async () => {
    const onRestore = vi.fn();
    render(<StudioRecoveryPanel workspacePath="D:/workspace" projectId={'motion-' + 'a'.repeat(20)}
      revision={3} busy={false} onRestore={onRestore} />);
    await screen.findByText('2 snapshots');
    fireEvent.click(screen.getByText('Auto-saved revisions'));
    expect(screen.getByText('Revision 2')).toBeInTheDocument();
    expect(onRestore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Studio revision 2' }));
    expect(onRestore).toHaveBeenCalledWith(2);
  });
  it('reloads history when committed revision changes and disables buttons while saving', async () => {
    const projectId = 'motion-' + 'a'.repeat(20);
    const onRestore = vi.fn();
    const ui = render(<StudioRecoveryPanel workspacePath="D:/workspace" projectId={projectId}
      revision={3} busy onRestore={onRestore} />);
    await screen.findByText('2 snapshots');
    fireEvent.click(screen.getByText('Auto-saved revisions'));
    expect(screen.getByRole('button', { name: 'Restore Studio revision 2' })).toBeDisabled();
    ui.rerender(<StudioRecoveryPanel workspacePath="D:/workspace" projectId={projectId}
      revision={4} busy={false} onRestore={onRestore} />);
    await waitFor(() => expect(studioApi.history).toHaveBeenCalledTimes(2));
  });
});
