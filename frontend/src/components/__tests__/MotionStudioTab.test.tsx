import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MotionStudioTab } from '../MotionStudioTab';
import { motionStudioApi, type MotionProject } from '../../services/motionStudioApi';
import { evaluateLayer, evaluateTrack, makeKeyframeTrack } from '../../services/motionScene';

vi.mock('../../services/motionStudioApi', () => ({
  motionStudioApi: {
    list: vi.fn(), inspect: vi.fn(), create: vi.fn(), edit: vi.fn(),
    jobs: vi.fn(), scheduler: vi.fn(), storage: vi.fn(), render: vi.fn(), status: vi.fn(), cancel: vi.fn(), loadPreview: vi.fn(), uploadImage: vi.fn(), loadImageUrl: vi.fn(), uploadAudio: vi.fn(), loadAudioUrl: vi.fn(), loadAudioWaveform: vi.fn(),
  },
}));
const id = 'motion-' + 'a'.repeat(20);
const fixture = (name = 'Product intro'): MotionProject => ({
  schemaVersion: 1, id, workspaceRoot: 'D:/projects/studio', name, revision: 1,
  createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z',
  composition: {
    width: 1920, height: 1080, fps: { numerator: 30, denominator: 1 },
    durationFrames: 90, background: '#171B28',
    layers: [{ id: 'title', kind: 'text', text: 'Product intro', x: 120, y: 200,
      width: 1600, height: 100, rotation: 0, opacity: 1, fill: '#FFFFFF',
      fontSize: 70, fontFamily: 'Arial', tracks: [{ property: 'opacity', keyframes: [
        { frame: 0, value: 0, easing: 'easeInOut' }, { frame: 30, value: 1 },
      ] }],
    }],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(motionStudioApi.list).mockResolvedValue([{ id, name: 'Product intro', revision: 1 }]);
  vi.mocked(motionStudioApi.inspect).mockResolvedValue(fixture());
  vi.mocked(motionStudioApi.jobs).mockResolvedValue([]);
  vi.mocked(motionStudioApi.scheduler).mockResolvedValue({
    maxConcurrentRenders: 2, queueLimit: 12, queued: 1, active: 1,
    slots: [{ slot: 0, jobId: 'motionjob-' + 'b'.repeat(24), state: 'claimed_unverified' }, { slot: 1, state: 'free' }],
  });
  vi.mocked(motionStudioApi.storage).mockResolvedValue({
    jobs: { total: 3, queued: 0, running: 1, completed: 2, failed: 0, cancelled: 0, interrupted: 0 },
    completedArtifactBytes: 1048576, maintenance: { minAgeDays: 7, candidates: 0, blockedIds: [], reclaimableBytes: 0 },
  });
  vi.mocked(motionStudioApi.create).mockResolvedValue(fixture());
  vi.mocked(motionStudioApi.loadImageUrl).mockResolvedValue('blob:test-motion-image');
  vi.mocked(motionStudioApi.loadAudioUrl).mockResolvedValue('blob:test-motion-audio');
  vi.mocked(motionStudioApi.loadAudioWaveform).mockResolvedValue({ peaks: Array(96).fill(0.4), seconds: 1, channels: 1, sampleRate: 16000 });
  vi.mocked(motionStudioApi.edit).mockImplementation(async (_ws, _id, _rev, operations) => {
    const next = fixture();
    next.revision = 2;
    if (operations[0].type === 'set-text') {
      const layer = next.composition.layers[0];
      if (layer.kind === 'text') layer.text = operations[0].text;
    }
    return next;
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Motion Studio scene evaluation', () => {
  it('matches step and smooth interpolation and sorts inserted keyframes', () => {
    const layer = fixture().composition.layers[0];
    expect(evaluateLayer(layer, 0).opacity).toBe(0);
    expect(evaluateLayer(layer, 15).opacity).toBeCloseTo(0.5);
    expect(evaluateLayer(layer, 30).opacity).toBe(1);
    expect(evaluateTrack({ property: 'x', keyframes: [
      { frame: 0, value: 2, easing: 'step' }, { frame: 30, value: 9 },
    ] }, 15)).toBe(2);
    expect(makeKeyframeTrack(layer, 'opacity', 15, 0.4).keyframes.map(value => value.frame)).toEqual([0, 15, 30]);
  });
});

describe('Native T-Line Motion Studio editor', () => {
  it('loads a workspace-owned scene and saves revision-checked text edits', async () => {
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    expect(await screen.findByText('Choose a scene to edit')).toBeInTheDocument();
    expect(screen.getByText(/Queue 1\/12/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    expect(await screen.findByDisplayValue('Product intro')).toBeInTheDocument();
    expect(screen.getByTestId('motion-canvas')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'New campaign' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save text' }));
    await waitFor(() => {
      expect(motionStudioApi.edit).toHaveBeenCalledWith('D:/projects/studio', id, 1, [
        { type: 'set-text', layerId: 'title', text: 'New campaign' },
      ]);
    });
    expect(await screen.findByText('Text saved · revision 2')).toBeInTheDocument();
  });

  it('persists timeline easing and keyframe removal using revision-checked server edits', async () => {
    vi.mocked(motionStudioApi.edit).mockImplementation(async (_ws, _id, base, edits) => {
      const project = fixture();
      project.revision = base + 1;
      if (edits[0].type === 'set-track') {
        project.composition.layers[0].tracks = [edits[0].track];
      }
      if (edits[0].type === 'replace-composition') project.composition = edits[0].composition;
      return project;
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByTestId('motion-canvas');
    fireEvent.click(screen.getByRole('button', { name: 'title opacity frame 0' }));
    fireEvent.change(screen.getByLabelText('Outgoing easing'), { target: { value: 'step' } });
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith('D:/projects/studio', id, 1, [
      { type: 'set-track', layerId: 'title', track: expect.objectContaining({
        property: 'opacity', keyframes: [expect.objectContaining({ frame: 0, easing: 'step' }), expect.any(Object)],
      }) },
    ]));
    await screen.findByText('Keyframe easing updated · revision 2');
    fireEvent.click(screen.getByRole('button', { name: 'title opacity frame 30' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete keyframe' }));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith('D:/projects/studio', id, 2, [
      { type: 'set-track', layerId: 'title', track: expect.objectContaining({
        property: 'opacity', keyframes: [expect.objectContaining({ frame: 0, easing: 'step' })],
      }) },
    ]));
    expect(await screen.findByText('Keyframe deleted · revision 3')).toBeInTheDocument();
  });

  it('imports an authenticated WAV and adds a revision-guarded audio timeline track', async () => {
    const assetId = 'audio-' + 'e'.repeat(64);
    vi.mocked(motionStudioApi.uploadAudio).mockResolvedValue({ id: assetId, bytes: 120, seconds: 1, channels: 1, sampleRate: 16000 });
    vi.mocked(motionStudioApi.edit).mockImplementation(async (_ws, _id, base, edits) => {
      const next = fixture(); next.revision = base + 1;
      if (edits[0].type === 'set-audio-tracks') next.composition.audioTracks = edits[0].audioTracks;
      return next;
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByTestId('motion-canvas');
    const file = new File([new Uint8Array(120)], 'beat.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Select Motion WAV'), { target: { files: [file] } });
    await waitFor(() => expect(motionStudioApi.uploadAudio).toHaveBeenCalledWith('D:/projects/studio', file));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith('D:/projects/studio', id, 1, [
      { type: 'set-audio-tracks', audioTracks: [{ assetId, startFrame: 0, volume: 1 }] },
    ]));
    expect(await screen.findByText('Audio imported · revision 2')).toBeInTheDocument();
    await waitFor(() => expect(motionStudioApi.loadAudioUrl).toHaveBeenCalledWith('D:/projects/studio', assetId));
  });

  it('imports an authenticated image asset and inserts a revision-checked image layer', async () => {
    const assetId = 'asset-' + 'a'.repeat(64);
    vi.mocked(motionStudioApi.uploadImage).mockResolvedValue({ id: assetId, width: 80, height: 45, bytes: 170 });
    vi.mocked(motionStudioApi.edit).mockImplementation(async (_ws, _id, baseRevision, ops) => {
      const next = fixture(); next.revision = baseRevision + 1;
      if (ops[0].type === 'add-layer') next.composition.layers.push(ops[0].layer);
      return next;
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByTestId('motion-canvas');
    const file = new File([new Uint8Array(170)], 'photo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Select Motion image'), { target: { files: [file] } });
    await waitFor(() => expect(motionStudioApi.uploadImage).toHaveBeenCalledWith('D:/projects/studio', file));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith('D:/projects/studio', id, 1, [
      expect.objectContaining({ type: 'add-layer', layer: expect.objectContaining({
        kind: 'image', assetId, width: 80, height: 45,
      }) }),
    ]));
    expect(await screen.findByText('Image imported · revision 2')).toBeInTheDocument();
    await waitFor(() => expect(motionStudioApi.loadImageUrl).toHaveBeenCalledWith('D:/projects/studio', assetId));
    expect(screen.getByTestId('motion-canvas').querySelector('image')).toHaveAttribute('href', 'blob:test-motion-image');
  });

  it('zooms, pans and resets the viewport without modifying a scene revision', async () => {
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByTestId('motion-canvas');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in Motion canvas' }));
    expect(screen.getByLabelText('Motion canvas zoom')).toHaveTextContent('125%');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Motion canvas pan mode' }));
    expect(screen.getByRole('button', { name: 'Toggle Motion canvas pan mode' })).toHaveAttribute('aria-pressed', 'true');
    const viewport = screen.getByTestId('motion-viewport');
    fireEvent.pointerDown(viewport, { pointerId: 5, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 5, clientX: 120, clientY: 135 });
    fireEvent.pointerUp(viewport, { pointerId: 5 });
    expect(screen.getByTestId('motion-canvas').getAttribute('style')).toContain('translate(20px, 35px)');
    fireEvent.click(screen.getByRole('button', { name: 'Reset Motion canvas view' }));
    expect(screen.getByLabelText('Motion canvas zoom')).toHaveTextContent('100%');
    expect(screen.getByTestId('motion-canvas').getAttribute('style')).toContain('translate(0px, 0px)');
    expect(motionStudioApi.edit).not.toHaveBeenCalled();
  });

  it('starts detached render with a pinned project ID and handles render-job status', async () => {
    vi.mocked(motionStudioApi.render).mockResolvedValue({
      id: 'motionjob-' + 'b'.repeat(24), projectId: id, revision: 1,
      status: 'queued', framesCompleted: 0, profile: { frameCount: 90, width: 640, height: 360 },
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByTestId('motion-canvas');
    fireEvent.change(screen.getByLabelText('Current frame'), { target: { value: 25 } });
    expect(screen.getByText('0.83s · F25')).toBeInTheDocument();
    expect(screen.getByText(/3 jobs/)).toBeInTheDocument();
    expect(screen.getByLabelText('Render resolution')).toHaveValue('640');
    fireEvent.change(screen.getByLabelText('Render resolution'), { target: { value: '1920' } });
    fireEvent.click(screen.getByRole('button', { name: 'Render MP4' }));
    await waitFor(() => expect(motionStudioApi.render).toHaveBeenCalledWith('D:/projects/studio', id, 1920));
    expect(await screen.findByText('Render queued at revision 1 · 1920px wide')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('adds a rectangle and undoes the layer insertion with revision guard', async () => {
    vi.mocked(motionStudioApi.edit).mockImplementation(async (_ws, _id, base, ops) => {
      const next = fixture();
      next.revision = base + 1;
      if (ops[0].type === 'add-layer') next.composition.layers.push(ops[0].layer);
      if (ops[0].type === 'replace-composition') next.composition = ops[0].composition;
      return next;
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByTestId('motion-canvas');
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle layer' }));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith('D:/projects/studio', id, 1,
      [expect.objectContaining({ type: 'add-layer', layer: expect.objectContaining({ kind: 'rect' }) })]));
    await screen.findByText('Layer added · revision 2');
    fireEvent.click(screen.getByRole('button', { name: 'Undo scene change' }));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith('D:/projects/studio', id, 2,
      [{ type: 'replace-composition', composition: expect.objectContaining({ layers: expect.any(Array) }) }]));
    expect(await screen.findByText('Undo · revision 3')).toBeInTheDocument();
  });

  it('does not resurrect a pending workspace response after unmount', async () => {
    let resolveList: ((value: { id: string; name: string; revision: number }[]) => void) | undefined;
    vi.mocked(motionStudioApi.list).mockImplementation(() =>
      new Promise(resolve => { resolveList = resolve; }));
    const result = render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    result.unmount();
    await act(async () => { resolveList?.([{ id, name: 'Old scene', revision: 1 }]); });
    expect(motionStudioApi.inspect).not.toHaveBeenCalled();
  });
});
