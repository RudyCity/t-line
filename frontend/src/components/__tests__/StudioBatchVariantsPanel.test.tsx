import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudioBatchVariantsPanel } from '../StudioBatchVariantsPanel';
import { studioApi, type StudioProject } from '../../services/studioApi';

vi.mock('../../services/studioApi', () => ({ studioApi: { batchVariants: vi.fn() } }));
const project = (): StudioProject => ({
  schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Original', revision: 4, createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  composition: { width: 1280, height: 720, durationFrames: 150,
    fps: { numerator: 30, denominator: 1 }, background: '#171B28', layers: [] },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(studioApi.batchVariants).mockResolvedValue({
    sourceProjectId: project().id, sourceRevision: 4,
    variants: [
      { aspectRatio: '1:1', projectId: 'motion-' + 'b'.repeat(20),
        revision: 2, jobId: 'motionjob-' + 'c'.repeat(24), jobStatus: 'queued' },
      { aspectRatio: '9:16', projectId: 'motion-' + 'd'.repeat(20),
        revision: 2, jobId: 'motionjob-' + 'e'.repeat(24), jobStatus: 'queued' },
    ],
  });
});
afterEach(() => cleanup());

describe('T-Line batch aspect variants', () => {
  it('queues only chosen ratios, reports new projects, and does not alter the source', async () => {
    const onQueued = vi.fn(), source = project();
    render(<StudioBatchVariantsPanel workspacePath="D:/studio" project={source}
      busy={false} onQueued={onQueued} />);
    fireEvent.click(screen.getByText('Batch Aspect Variants'));
    expect(screen.getByRole('checkbox', { name: 'Batch ratio 16:9' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Create and queue 2 variants' }));
    await waitFor(() => expect(studioApi.batchVariants).toHaveBeenCalledWith(
      'D:/studio', source.id, 4, ['1:1', '9:16'],
    ));
    await waitFor(() => expect(onQueued).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText(/Render queued/)).toHaveLength(2);
    expect(source.revision).toBe(4);
  });
  it('prevents empty batches and displays scheduler errors', async () => {
    vi.mocked(studioApi.batchVariants).mockRejectedValue(new Error('No render queue capacity'));
    render(<StudioBatchVariantsPanel workspacePath="D:/studio" project={project()}
      busy={false} onQueued={vi.fn()} />);
    fireEvent.click(screen.getByText('Batch Aspect Variants'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Batch ratio 1:1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Batch ratio 9:16' }));
    expect(screen.getByRole('button', { name: 'Create and queue 0 variants' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Batch ratio 16:9' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create and queue 1 variant' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No render queue capacity');
  });
});
