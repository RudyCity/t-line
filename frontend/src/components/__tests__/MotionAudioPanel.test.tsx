import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionAudioPanel } from '../MotionAudioPanel';
import { motionStudioApi, type MotionProject } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({ motionStudioApi: { loadAudioUrl: vi.fn() } }));
const audioId = 'audio-' + 'f'.repeat(64);
const scene: MotionProject = {
  schemaVersion: 1, id: 'motion-' + 'd'.repeat(20), name: 'Audio Scene',
  workspaceRoot: 'D:/studio', revision: 2, createdAt: '', updatedAt: '',
  composition: {
    width: 1920, height: 1080, background: '#000000',
    durationFrames: 90, fps: { numerator: 30, denominator: 1 }, layers: [],
    audio: { assetId: audioId, startFrame: 10, volume: 1 },
  },
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const common = { project: scene, workspacePath: 'D:/studio', busy: false, isActive: true };
describe('Motion WAV timeline controls', () => {
  it('edits timing and volume through guarded scene operations', async () => {
    vi.mocked(motionStudioApi.loadAudioUrl).mockResolvedValue('blob:test-audio');
    const onEdit = vi.fn();
    render(<MotionAudioPanel {...common} onEdit={onEdit} onUpload={vi.fn()} onError={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Motion WAV preview')).toHaveAttribute('src', 'blob:test-audio'));
    fireEvent.change(screen.getByLabelText('Audio start frame'), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText('Audio volume'), { target: { value: '0.55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save audio' }));
    expect(onEdit).toHaveBeenCalledWith([{
      type: 'set-audio', audio: { assetId: audioId, startFrame: 18, volume: 0.55 },
    }], 'Audio timing updated');
    fireEvent.change(screen.getByLabelText('Audio start frame'), { target: { value: '91' } });
    expect(screen.getByRole('button', { name: 'Save audio' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove audio' }));
    expect(onEdit).toHaveBeenCalledWith([{ type: 'set-audio', audio: null }], 'Audio removed');
  });
  it('accepts local WAV file selection without leaking local paths', () => {
    const onUpload = vi.fn();
    const silent = { ...scene, composition: { ...scene.composition, audio: undefined } };
    render(<MotionAudioPanel {...common} project={silent} onEdit={vi.fn()}
      onUpload={onUpload} onError={vi.fn()} />);
    const file = new File([new Uint8Array(64)], 'music.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Select Motion WAV'), { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(screen.getByText(/One WAV track/)).toBeInTheDocument();
  });
});
