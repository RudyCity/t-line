import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionPresetPanel } from '../MotionPresetPanel';
import { motionStudioApi, type MotionProject } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({
  motionStudioApi: { presets: vi.fn(), previewPreset: vi.fn(), applyPreset: vi.fn() },
}));
const project = (): MotionProject => ({
  schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Product launch', revision: 2, createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  composition: { width: 1280, height: 720, fps: { numerator: 30, denominator: 1 },
    durationFrames: 120, background: '#111827', layers: [
      { id: 'title', kind: 'text', text: 'Hello', fontFamily: 'Arial', fontSize: 64,
        fill: '#FFFFFF', x: 100, y: 100, width: 550, height: 70,
        rotation: 0, opacity: 1, tracks: [] },
      { id: 'rectangle', kind: 'rect', fill: '#F59E0B', x: 0, y: 0,
        width: 500, height: 60, rotation: 0, opacity: 1, tracks: [] },
    ] },
});
const presets = [
  { id: 'neon-impact', name: 'Neon Impact', description: 'Electric entrance', tags: ['neon'],
    entrance: 'entrance-whip-left', emphasis: 'kinetic-glitch-drift', exit: 'exit-whip-right',
    accent: 'accent-tech-callout' },
  { id: 'quiet-story', name: 'Quiet Story', description: 'Soft reveal', tags: ['calm'],
    entrance: 'entrance-fade-in', emphasis: 'kinetic-hover-sine', exit: 'exit-drift-slow' },
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(motionStudioApi.presets).mockResolvedValue({ count: presets.length, presets });
  vi.mocked(motionStudioApi.previewPreset).mockImplementation(async () => {
    const out = project();
    out.composition.layers[0].tracks = [{ property: 'x', keyframes: [
      { frame: 0, value: 50 }, { frame: 75, value: 100 },
    ] }];
    return out;
  });
});
afterEach(() => cleanup());
describe('T-Line Motion preset panel', () => {
  it('previews an unsaved composition and invokes Apply only on explicit commit', async () => {
    const onPreview = vi.fn(), onApply = vi.fn();
    render(<MotionPresetPanel workspacePath="D:/studio" project={project()} selectedLayer="title"
      busy={false} preview={null} onPreview={onPreview} onApply={onApply} />);
    const preset = await screen.findByRole('combobox', { name: 'Select Motion preset' });
    expect(screen.getByText('2 styles')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Preset intensity' }), { target: { value: '1.5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Preset duration' }), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(motionStudioApi.previewPreset).toHaveBeenCalledWith('D:/studio',
      project().id, 2, { presetId: 'neon-impact', targetLayerId: 'title',
        startFrame: 0, durationFrames: 60, intensity: 1.5 }));
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({
      composition: expect.objectContaining({ layers: expect.any(Array) }),
    })));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({
      presetId: 'neon-impact', targetLayerId: 'title', startFrame: 0, durationFrames: 60, intensity: 1.5,
    });
    expect(preset).toHaveValue('neon-impact');
  });
  it('does not permit non-text targets, invalid windows or out-of-bounds intensity', async () => {
    const onPreview = vi.fn(), onApply = vi.fn();
    const { rerender } = render(<MotionPresetPanel workspacePath="D:/studio" project={project()}
      selectedLayer="rectangle" busy={false} preview={null} onPreview={onPreview} onApply={onApply} />);
    await screen.findByText('2 styles');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    rerender(<MotionPresetPanel workspacePath="D:/studio" project={project()}
      selectedLayer="title" busy={false} preview={null} onPreview={onPreview} onApply={onApply} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Preset duration' }), { target: { value: '500' } });
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Preset duration' }), { target: { value: '40' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Preset intensity' }), { target: { value: '100' } });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(onApply).not.toHaveBeenCalled();
  });
  it('filters presets locally and does not allow a stale selection', async () => {
    const onPreview = vi.fn(), onApply = vi.fn();
    render(<MotionPresetPanel workspacePath="D:/studio" project={project()} selectedLayer="title"
      busy={false} preview={null} onPreview={onPreview} onApply={onApply} />);
    await screen.findByText('2 styles');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Motion presets' }), { target: { value: 'quiet' } });
    expect(screen.getByRole('combobox', { name: 'Select Motion preset' })).toHaveValue('quiet-story');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Motion presets' }), { target: { value: 'not-existing' } });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });
});
