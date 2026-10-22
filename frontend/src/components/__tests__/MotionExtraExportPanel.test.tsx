import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionExtraExportPanel } from '../MotionExtraExportPanel';
import { motionStudioApi } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({ motionStudioApi: { loadExtraExport: vi.fn() } }));
const jobId = 'motionjob-' + 'a'.repeat(24);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(motionStudioApi.loadExtraExport).mockResolvedValue('blob:test-motion-export');
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});
afterEach(() => cleanup());
describe('Motion extra exports', () => {
  it('converts only after explicit request and presents a downloadable asset', async () => {
    render(<MotionExtraExportPanel workspacePath="D:/studio" jobId={jobId} filename="My-Video"/>);
    expect(motionStudioApi.loadExtraExport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Convert to GIF' }));
    await waitFor(() => expect(motionStudioApi.loadExtraExport).toHaveBeenCalledWith('D:/studio', jobId, 'gif'));
    const link = await screen.findByRole('link', { name: 'Download GIF' });
    expect(link).toHaveAttribute('download', 'My-Video.gif');
    expect(link).toHaveAttribute('href', 'blob:test-motion-export');
  });
  it('reports conversion failures without incorrectly offering the file', async () => {
    vi.mocked(motionStudioApi.loadExtraExport).mockRejectedValue(new Error('Export limit'));
    render(<MotionExtraExportPanel workspacePath="D:/studio" jobId={jobId} filename="Demo"/>);
    fireEvent.click(screen.getByRole('button', { name: 'Convert to WEBM' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Export limit');
    expect(screen.queryByRole('link', { name: 'Download WEBM' })).toBeNull();
  });
});
