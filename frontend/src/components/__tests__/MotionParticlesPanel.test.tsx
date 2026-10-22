import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionParticlesPanel } from '../MotionParticlesPanel';
import { motionStudioApi, type MotionProject } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({ motionStudioApi: { particles: vi.fn() } }));
const scene = (): MotionProject => ({
  schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Particles', revision: 2, createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  composition: { width: 1280, height: 720, durationFrames: 90,
    fps: { numerator: 30, denominator: 1 }, background: '#171B28', layers: [] },
});
beforeEach(() => { vi.clearAllMocks(); vi.mocked(motionStudioApi.particles).mockResolvedValue(scene()); });
afterEach(() => cleanup());
describe('Native procedural particle overlay controls', () => {
  it('previews scene without saving, then applies only after confirmation', async () => {
    const onPreview = vi.fn(), onApply = vi.fn();
    render(<MotionParticlesPanel workspacePath="D:/studio" project={scene()}
      busy={false} preview={null} onPreview={onPreview} onApply={onApply}/>);
    fireEvent.click(screen.getByText('Procedural Particle Accents'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Motion particle style' }),
      { target: { value: 'snow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(motionStudioApi.particles).toHaveBeenCalledWith(
      'D:/studio', scene().id, 2, { kind: 'snow', count: 20, color: '#38bdf8' }, true,
    ));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({ kind: 'snow', count: 20, color: '#38bdf8' });
  });
  it('disables invalid layer-count requests', () => {
    render(<MotionParticlesPanel workspacePath="D:/studio" project={scene()}
      busy={false} preview={null} onPreview={vi.fn()} onApply={vi.fn()}/>);
    fireEvent.click(screen.getByText('Procedural Particle Accents'));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Motion particle count' }),
      { target: { value: '100' } });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });
});
