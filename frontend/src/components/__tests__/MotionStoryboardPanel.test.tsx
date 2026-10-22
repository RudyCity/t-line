import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionStoryboardPanel } from '../MotionStoryboardPanel';
import { motionStudioApi, type MotionStoryboardPlan, type MotionProject } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({ motionStudioApi: {
  storyboardPlan: vi.fn(), storyboardPreview: vi.fn(), storyboardRender: vi.fn(),
} }));
const plan = (): MotionStoryboardPlan => ({
  name: 'Launch', durationSeconds: 3, background: '#171b28', artDirection: 'minimal',
  scenes: [{ headline: 'Fast SaaS', subtitle: 'Introducing AI', accent: '#ff9900', layout: 'left' }],
});
const preview = (): MotionProject => ({
  schemaVersion: 1, id: 'motion-' + '0'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Launch', revision: 1, createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  composition: { width: 1280, height: 720, durationFrames: 90,
    background: '#171b28', fps: { numerator: 30, denominator: 1 }, layers: [] },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(motionStudioApi.storyboardPlan).mockResolvedValue({ plan: plan(), preview: preview() });
  vi.mocked(motionStudioApi.storyboardPreview).mockResolvedValue({ preview: preview() });
  vi.mocked(motionStudioApi.storyboardRender).mockResolvedValue({
    project: preview(), outline: ['Fast SaaS'], limitations: [],
    job: { id: 'motionjob-' + 'a'.repeat(24), projectId: preview().id, status: 'queued' } as any,
  });
});
afterEach(() => cleanup());
describe('AI Motion Director storyboard approval', () => {
  it('plans without rendering, allows review/edit, refreshes preview, and requires approval', async () => {
    const onCreated = vi.fn();
    render(<MotionStoryboardPanel workspacePath="D:/studio" renderWidth={640} busy={false}
      onCreated={onCreated}/>);
    fireEvent.click(screen.getByText(/AI Motion Director 2.0/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Storyboard creative brief' }),
      { target: { value: 'Create a clean launch video' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plan storyboard' }));
    await waitFor(() => expect(motionStudioApi.storyboardPlan).toHaveBeenCalledWith(
      'D:/studio', 'Create a clean launch video'));
    expect(motionStudioApi.storyboardRender).not.toHaveBeenCalled();
    const name = await screen.findByRole('textbox', { name: 'Storyboard headline 0' });
    fireEvent.change(name, { target: { value: 'Ready to ship' } });
    expect(screen.getByRole('button', { name: 'Approve & render MP4' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Preview storyboard' }));
    await waitFor(() => expect(motionStudioApi.storyboardPreview).toHaveBeenCalledWith(
      'D:/studio', expect.objectContaining({
        scenes: [expect.objectContaining({ headline: 'Ready to ship' })],
      })));
    fireEvent.click(screen.getByRole('button', { name: 'Approve & render MP4' }));
    await waitFor(() => expect(motionStudioApi.storyboardRender).toHaveBeenCalledWith(
      'D:/studio', expect.objectContaining({ scenes: [expect.objectContaining({ headline: 'Ready to ship' })] }), 640));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });
  it('does not report a successful project when the model fails', async () => {
    vi.mocked(motionStudioApi.storyboardPlan).mockRejectedValue(new Error('AI model not connected'));
    const onCreated = vi.fn();
    render(<MotionStoryboardPanel workspacePath="D:/studio" renderWidth={640} busy={false}
      onCreated={onCreated}/>);
    fireEvent.click(screen.getByText(/AI Motion Director 2.0/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Storyboard creative brief' }),
      { target: { value: 'Create a video' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plan storyboard' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AI model not connected');
    expect(onCreated).not.toHaveBeenCalled();
  });
});
