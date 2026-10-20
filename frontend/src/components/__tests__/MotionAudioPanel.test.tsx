import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionAudioPanel } from '../MotionAudioPanel';
import { motionStudioApi, type MotionProject } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({ motionStudioApi: { loadAudioUrl: vi.fn(), loadAudioWaveform: vi.fn() } }));
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
beforeEach(() => {
  // Avoid late async React updates in tests that only exercise controls.
  vi.mocked(motionStudioApi.loadAudioWaveform).mockImplementation(() => new Promise(() => {}));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const waveform = { peaks: Array(96).fill(0.4), seconds: 1, sampleRate: 16000, channels: 1 };
const envelope = { peaks: Array.from({ length: 96 }, (_, i) => (i % 5) / 5),
  seconds: 1, sampleRate: 16000, channels: 1 };
vi.mocked(motionStudioApi.loadAudioWaveform).mockResolvedValue(envelope);
const common = { project: scene, workspacePath: 'D:/studio', busy: false, isActive: true };
describe('Motion WAV timeline controls', () => {
  it('draws a bounded waveform and seeks to the corresponding composition frame', async () => {
    vi.mocked(motionStudioApi.loadAudioUrl).mockResolvedValue('blob:test-audio');
    vi.mocked(motionStudioApi.loadAudioWaveform).mockResolvedValue(waveform);
    const onSeekFrame = vi.fn();
    render(<MotionAudioPanel {...common} frame={20} onSeekFrame={onSeekFrame}
      onEdit={vi.fn()} onUpload={vi.fn()} onError={vi.fn()} />);
    const seek = await screen.findByRole('button', { name: 'Seek audio waveform clip 1' });
    expect(screen.getByRole('img', { name: 'Waveform clip 1' }).querySelectorAll('rect')).toHaveLength(96);
    vi.spyOn(seek, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 0, right: 300, bottom: 40, width: 200, height: 40,
      x: 100, y: 0, toJSON: () => ({}),
    });
    fireEvent.click(seek, { clientX: 200 });
    expect(onSeekFrame).toHaveBeenCalledWith(25);
  });
  it('edits timing and volume through guarded scene operations', async () => {
    vi.mocked(motionStudioApi.loadAudioUrl).mockResolvedValue('blob:test-audio');
    const onEdit = vi.fn();
    render(<MotionAudioPanel {...common} onEdit={onEdit} onUpload={vi.fn()} onError={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Motion WAV preview')).toHaveAttribute('src', 'blob:test-audio'));
    fireEvent.change(screen.getByLabelText('Audio start frame'), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText('Audio volume'), { target: { value: '0.55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save audio' }));
    expect(onEdit).toHaveBeenCalledWith([{
      type: 'set-audio-tracks', audioTracks: [{ assetId: audioId, startFrame: 18,
        volume: 0.55, fadeInFrames: 0, fadeOutFrames: 0 }],
    }], 'Audio timing updated');
    fireEvent.change(screen.getByLabelText('Audio start frame'), { target: { value: '91' } });
    expect(screen.getByRole('button', { name: 'Save audio' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove audio' }));
    expect(onEdit).toHaveBeenCalledWith([{ type: 'set-audio-tracks', audioTracks: [] }], 'Audio removed');
  });
  it('adjusts the second clip and preserves the first with independent fade values', async () => {
    // No fetched-media completion is needed for form semantics.
    vi.mocked(motionStudioApi.loadAudioUrl).mockImplementation(() => new Promise(() => {}));
    const onEdit = vi.fn();
    const twoClips: MotionProject = { ...scene, composition: {
      ...scene.composition, audio: undefined, audioTracks: [
        { assetId: audioId, startFrame: 10, volume: 1 },
        { assetId: 'audio-' + 'a'.repeat(64), startFrame: 20, volume: 0.5 },
      ],
    } };
    render(<MotionAudioPanel {...common} project={twoClips} onEdit={onEdit}
      onUpload={vi.fn()} onError={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Audio start frame 2'), { target: { value: '35' } });
    fireEvent.change(screen.getByLabelText('Audio fade in frames 2'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Audio fade out frames 2'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save audio 2' }));
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'set-audio-tracks', audioTracks: [
        { assetId: audioId, startFrame: 10, volume: 1 },
        { assetId: 'audio-' + 'a'.repeat(64), startFrame: 35, volume: 0.5,
          fadeInFrames: 4, fadeOutFrames: 5 },
      ] },
    ], 'Audio timing updated');
    fireEvent.click(screen.getByRole('button', { name: 'Remove audio 2' }));
    expect(onEdit).toHaveBeenCalledWith([{
      type: 'set-audio-tracks', audioTracks: [{ assetId: audioId, startFrame: 10, volume: 1 }],
    }], 'Audio removed');
  });
  it('disables uploading a fifth clip', () => {
    vi.mocked(motionStudioApi.loadAudioUrl).mockImplementation(() => new Promise(() => {}));
    const many: MotionProject = { ...scene, composition: {
      ...scene.composition, audio: undefined,
      audioTracks: Array.from({ length: 4 }, (_, index) =>
        ({ assetId: 'audio-' + String(index).repeat(64), startFrame: 0, volume: 1 })),
    } };
    render(<MotionAudioPanel {...common} project={many} onEdit={vi.fn()}
      onUpload={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add WAV' })).toBeDisabled();
  });

  it('accepts local WAV file selection without leaking local paths', () => {
    const onUpload = vi.fn();
    const silent = { ...scene, composition: { ...scene.composition, audio: undefined } };
    render(<MotionAudioPanel {...common} project={silent} onEdit={vi.fn()}
      onUpload={onUpload} onError={vi.fn()} />);
    const file = new File([new Uint8Array(64)], 'music.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Select Motion WAV'), { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(screen.getByText(/Up to four PCM16 WAV tracks/)).toBeInTheDocument();
  });
});
