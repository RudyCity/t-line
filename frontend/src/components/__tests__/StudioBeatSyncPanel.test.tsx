import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudioBeatSyncPanel } from '../StudioBeatSyncPanel';
import { studioApi, type StudioProject } from '../../services/studioApi';

vi.mock('../../services/studioApi', () => ({ studioApi: { beatSync: vi.fn() } }));
const scene = (): StudioProject => ({
  schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Audio', revision: 2, createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  composition: { width: 1280, height: 720, durationFrames: 150,
    fps: { numerator: 30, denominator: 1 }, background: '#171B28',
    layers: [{ id: 'title', kind: 'text', text: 'Hi', x: 20, y: 20, width: 500, height: 60,
      fontFamily: 'Arial', fontSize: 48, fill: '#FFFFFF', opacity: 1, rotation: 0, tracks: [] }],
    audioTracks: [{ assetId: 'audio-' + 'a'.repeat(64), startFrame: 0, volume: 1, role: 'music' }],
  },
});
beforeEach(() => { vi.clearAllMocks(); vi.mocked(studioApi.beatSync).mockResolvedValue({
  project: scene(), onsetFrames: [9, 21, 33], analysis: 'pcm16-transient-energy',
}); });
afterEach(() => cleanup());
describe('T-Line Audio Beat Sync', () => {
  it('previews without applying, then explicitly applies the detected track', async () => {
    const onPreview = vi.fn(), onApply = vi.fn();
    render(<StudioBeatSyncPanel workspacePath="D:/studio" project={scene()} selectedLayer="title"
      busy={false} preview={null} onPreview={onPreview} onApply={onApply} />);
    fireEvent.click(screen.getByText('Audio Beat Sync'));
    fireEvent.click(screen.getByRole('button', { name: 'Preview beats' }));
    await waitFor(() => expect(studioApi.beatSync).toHaveBeenCalledWith(
      'D:/studio', scene().id, 2, { targetLayerId: 'title', audioTrackIndex: 0, intensity: .35 }, true,
    ));
    expect(onApply).not.toHaveBeenCalled();
    expect(await screen.findByText(/3 transient\(s\) found/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply beat sync' }));
    expect(onApply).toHaveBeenCalledWith({ targetLayerId: 'title', audioTrackIndex: 0, intensity: .35 });
  });
  it('prevents edits without a selected layer', () => {
    render(<StudioBeatSyncPanel workspacePath="D:/studio" project={scene()} selectedLayer={null}
      busy={false} preview={null} onPreview={vi.fn()} onApply={vi.fn()} />);
    fireEvent.click(screen.getByText('Audio Beat Sync'));
    expect(screen.getByRole('button', { name: 'Apply beat sync' })).toBeDisabled();
  });
});
