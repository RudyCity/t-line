import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MotionStudioTab } from '../MotionStudioTab';
import { motionStudioApi, type MotionProject } from '../../services/motionStudioApi';
import { evaluateLayer, evaluateTrack, makeKeyframeTrack } from '../../services/motionScene';

vi.mock('../../services/motionStudioApi', () => ({
  motionStudioApi: {
    list: vi.fn(), inspect: vi.fn(), create: vi.fn(), edit: vi.fn(),
    presets: vi.fn(), presetInfo: vi.fn(), previewPreset: vi.fn(), applyPreset: vi.fn(),
    effectsPage: vi.fn(), previewEffect: vi.fn(), applyEffect: vi.fn(), changeStack: vi.fn(),
    history: vi.fn(), restoreHistory: vi.fn(),
    jobs: vi.fn(), capabilities: vi.fn(), quality: vi.fn(), loadFrameSnapshot: vi.fn(), visionReview: vi.fn(), visionRepair: vi.fn(), captions: vi.fn(), generate: vi.fn(), revise: vi.fn(), scheduler: vi.fn(), supervisor: vi.fn(), storage: vi.fn(), queueRecovery: vi.fn(), render: vi.fn(), status: vi.fn(), cancel: vi.fn(), loadPreview: vi.fn(), uploadImage: vi.fn(), loadImageUrl: vi.fn(), uploadAudio: vi.fn(), loadAudioUrl: vi.fn(), loadAudioWaveform: vi.fn(),
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
  vi.mocked(motionStudioApi.quality).mockResolvedValue({
    passed: true,
    samples: [{ frame: 45, scene: 0, visibleHeadlines: ['Product intro'] }],
    issues: [{ severity: 'warning', code: 'low-contrast-subtitle', scene: 0,
      message: 'Accent may be hard to read' }],
  });
  vi.mocked(motionStudioApi.capabilities).mockResolvedValue({ capabilities: {
    aiPromptDirector: 'short-text-motion-preview', aiSemanticRevision: true,
    aiWorkspaceMedia: 'uploaded-image-wav',
  } });
  vi.mocked(motionStudioApi.list).mockResolvedValue([{ id, name: 'Product intro', revision: 1 }]);
  vi.mocked(motionStudioApi.inspect).mockResolvedValue(fixture());
  vi.mocked(motionStudioApi.jobs).mockResolvedValue([]);
  vi.mocked(motionStudioApi.scheduler).mockResolvedValue({
    maxConcurrentRenders: 2, queueLimit: 12, queued: 1, active: 1,
    slots: [{ slot: 0, jobId: 'motionjob-' + 'b'.repeat(24), state: 'claimed_unverified' }, { slot: 1, state: 'free' }],
  });
  vi.mocked(motionStudioApi.supervisor).mockResolvedValue({
    mode: 'opt-in-fifo', queuedSupervised: 2, occupied: 0, maxConcurrentRenders: 2,
    leader: 'claimed_unverified', automaticRecoveryOfRenderingJobs: false,
  });
  vi.mocked(motionStudioApi.queueRecovery).mockResolvedValue({
    minAgeSeconds: 30, queued: 2, eligible: 1, blocked: 1,
    items: [
      { jobId: 'motionjob-' + 'b'.repeat(24), createdAt: '2026-10-20T00:00:00Z', state: 'eligible' },
      { jobId: 'motionjob-' + 'c'.repeat(24), createdAt: '2026-10-20T00:00:00Z', state: 'blocked', reason: 'worker claim exists' },
    ],
    warning: 'Read-only; inspection only',
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
  it('round-trips an editable rounded rectangle through authorized revisioned canvas', async () => {
    const scene = fixture();
    scene.composition.layers = [{
      id: 'rounded-card', kind: 'rect', x: 100, y: 200, width: 200, height: 100,
      rotation: 0, opacity: 1, fill: '#FFFFFF', tracks: [], cornerRadius: 10,
    }];
    vi.mocked(motionStudioApi.inspect).mockResolvedValue(scene);
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    const corner = await screen.findByLabelText('Rounded corner radius');
    expect(corner).toHaveValue(10);
    const layer = screen.getByTestId('motion-canvas').querySelector('[data-motion-layer="rounded-card"] rect');
    expect(layer).toHaveAttribute('rx', '10');
    fireEvent.change(corner, { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rounded corners' }));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith(
      'D:/projects/studio', id, 1,
      [{ type: 'replace-composition', composition: expect.objectContaining({
        layers: [expect.objectContaining({ id: 'rounded-card', cornerRadius: 35 })],
      }) }],
    ));
  });

  it('makes one explicit visual improvement request with revision guard and updates selected project', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({ capabilities: {
      aiPromptDirector: 'short-text-motion-preview',
      boundedModelVisionRepair: 'one-review-one-revision',
    } });
    const changed = { ...fixture(), revision: 2 };
    vi.mocked(motionStudioApi.visionRepair).mockResolvedValue({
      changed: true,
      review: {
        type: 'model-vision-sampled-frames', projectId: id, revision: 1, reviewedFrames: [45],
        passed: false, issues: [], limitations: [],
      },
      result: {
        project: changed,
        outline: ['Product intro'], limitations: [],
        job: {
          id: 'motionjob-' + 'd'.repeat(24), projectId: id, revision: 2,
          status: 'queued', framesCompleted: 0, profile: { frameCount: 90, width: 640, height: 360 },
        },
      },
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    fireEvent.click(await screen.findByText(/Quality checks · Structure OK/));
    fireEvent.click(screen.getByRole('button', { name: 'Review & auto-improve once' }));
    await waitFor(() => expect(motionStudioApi.visionRepair).toHaveBeenCalledWith(
      'D:/projects/studio', id, 1, 640,
    ));
    expect(await screen.findByText(/Bounded AI visual repair applied/)).toBeInTheDocument();
    expect(screen.getByText('r2')).toBeInTheDocument();
  });

  it('does not mutate editor when one-pass visual review finds no blocking errors', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({ capabilities: {
      aiPromptDirector: 'short-text-motion-preview',
      boundedModelVisionRepair: 'one-review-one-revision',
    } });
    vi.mocked(motionStudioApi.visionRepair).mockResolvedValue({
      changed: false,
      reason: 'No blocking issues',
      review: {
        type: 'model-vision-sampled-frames', projectId: id, revision: 1, reviewedFrames: [45],
        passed: true, issues: [], limitations: [],
      },
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    fireEvent.click(await screen.findByText(/Quality checks · Structure OK/));
    fireEvent.click(screen.getByRole('button', { name: 'Review & auto-improve once' }));
    expect(await screen.findByText('No blocking issues')).toBeInTheDocument();
    expect(screen.getByText('r1')).toBeInTheDocument();
  });

  it('shows explicit AI-model vision findings and stages edits instead of running untrusted suggestions', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({ capabilities: {
      aiPromptDirector: 'short-text-motion-preview', sampledModelVisionReview: 'on-demand-vision-model-required',
    } });
    vi.mocked(motionStudioApi.visionReview).mockResolvedValue({
      type: 'model-vision-sampled-frames', projectId: id, revision: 1, reviewedFrames: [45],
      passed: false,
      issues: [{
        frame: 45, category: 'readability', severity: 'error',
        explanation: 'Headline too small', suggestion: 'Move headline to safe canvas region',
      }],
      limitations: ['Sampled frame only'],
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    fireEvent.click(await screen.findByText(/Quality checks · Structure OK/));
    fireEvent.click(screen.getByRole('button', { name: 'AI Vision Review (uses configured model)' }));
    expect(await screen.findByText('Headline too small')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare suggested revision' }));
    expect(screen.getByLabelText('Motion prompt')).toHaveValue(
      'Improve the current motion at frame 45 for readability: Move headline to safe canvas region',
    );
    expect(motionStudioApi.revise).not.toHaveBeenCalled();
  });
  it('renders and revokes authorized raster frame samples only when supported', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({ capabilities: {
      aiPromptDirector: 'short-text-motion-preview',
      authenticatedFrameSnapshots: true, aiAspectRatios: ['16:9', '1:1', '9:16'],
    } });
    vi.mocked(motionStudioApi.loadFrameSnapshot).mockResolvedValue('blob:sample-45');
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    expect(await screen.findByLabelText('Motion aspect ratio')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motion aspect ratio'), { target: { value: '9:16' } });
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    expect(await screen.findByText(/Quality checks · Structure OK/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Quality checks · Structure OK/));
    fireEvent.click(screen.getByRole('button', { name: 'Review actual rendered frames' }));
    await waitFor(() => expect(motionStudioApi.loadFrameSnapshot).toHaveBeenCalledWith(
      'D:/projects/studio', id, 45,
    ));
    expect(await screen.findByAltText('Rendered frame 45')).toHaveAttribute('src', 'blob:sample-45');
  });

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
    expect(await screen.findByText(/Quality checks · Structure OK/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Quality checks · Structure OK/));
    expect(screen.getByText(/low-contrast-subtitle/)).toBeInTheDocument();
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
    expect(screen.getByText(/FIFO 2 queued/)).toBeInTheDocument();
    expect(screen.getByText(/3 jobs/)).toBeInTheDocument();
    expect(screen.getByText(/Queue recovery: 1 eligible · 1 blocked/)).toBeInTheDocument();
    expect(screen.getByLabelText('Render resolution')).toHaveValue('640');
    fireEvent.change(screen.getByLabelText('Render resolution'), { target: { value: '1920' } });
    fireEvent.click(screen.getByRole('button', { name: 'Render MP4' }));
    await waitFor(() => expect(motionStudioApi.render).toHaveBeenCalledWith('D:/projects/studio', id, 1920, false));
    expect(await screen.findByText('Render queued at revision 1 · 1920px wide')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Use FIFO supervisor'));
    expect(screen.getByLabelText('Use FIFO supervisor')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Render MP4' }));
    await waitFor(() => expect(motionStudioApi.render).toHaveBeenCalledWith('D:/projects/studio', id, 1920, true));
    expect(await screen.findByText(/awaiting separate SuperAgent FIFO supervisor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('generates from a natural-language brief and revises through the same prompt area', async () => {
    const newJob = { id: 'motionjob-' + 'f'.repeat(24), projectId: id, revision: 2,
      status: 'queued' as const, framesCompleted: 0, profile: { frameCount: 90, width: 640, height: 360 } };
    const revisedProject = { ...fixture(), revision: 2 };
    vi.mocked(motionStudioApi.generate).mockResolvedValue({
      project: revisedProject, job: newJob, outline: ['Laris cepat'], limitations: ['Preview text only'],
    });
    vi.mocked(motionStudioApi.revise).mockResolvedValue({
      project: { ...fixture(), revision: 3 }, job: { ...newJob, revision: 3 },
      outline: ['Laris cepat!'], limitations: [],
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Motion prompt'), { target: { value: 'Buat video promosi Laris' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }));
    await waitFor(() => expect(motionStudioApi.generate).toHaveBeenCalledWith(
      'D:/projects/studio', 'Buat video promosi Laris', 640, {},
    ));
    expect(await screen.findByText(/AI Motion created revision 2/)).toBeInTheDocument();
    expect(screen.getByText('Buat video promosi Laris')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motion prompt'), { target: { value: 'Percepat animasi teks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revise with AI' }));
    await waitFor(() => expect(motionStudioApi.revise).toHaveBeenCalledWith(
      'D:/projects/studio', id, 'Percepat animasi teks', 640, {},
    ));
    expect(screen.getByText('Percepat animasi teks')).toBeInTheDocument();
  });

  it('uploads attached image and WAV assets before AI generation and resets them after success', async () => {
    const imageId = 'asset-' + 'a'.repeat(64);
    const audioId = 'audio-' + 'b'.repeat(64);
    vi.mocked(motionStudioApi.uploadImage).mockResolvedValue({ id: imageId, width: 200, height: 100, bytes: 200 });
    vi.mocked(motionStudioApi.uploadAudio).mockResolvedValue({
      id: audioId, sampleRate: 16000, channels: 1, seconds: 1, bytes: 300,
    });
    const newJob = { id: 'motionjob-' + 'f'.repeat(24), projectId: id, revision: 2,
      status: 'queued' as const, framesCompleted: 0, profile: { frameCount: 90, width: 640, height: 360 } };
    vi.mocked(motionStudioApi.generate).mockResolvedValue({
      project: { ...fixture(), revision: 2 }, job: newJob, outline: ['Produk baru'], limitations: [],
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    const image = new File([new Uint8Array(32)], 'logo.png', { type: 'image/png' });
    const audio = new File([new Uint8Array(50)], 'music.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Attach motion image'), { target: { files: [image] } });
    await waitFor(() => expect(motionStudioApi.uploadImage).toHaveBeenCalledWith('D:/projects/studio', image));
    expect(await screen.findByText(/Image: logo.png/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Attach motion WAV'), { target: { files: [audio] } });
    await waitFor(() => expect(motionStudioApi.uploadAudio).toHaveBeenCalledWith('D:/projects/studio', audio));
    expect(await screen.findByText(/WAV: music.wav/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Prompt audio gain'), { target: { value: '0.6' } });
    fireEvent.change(screen.getByLabelText('Motion prompt'), { target: { value: 'Buat video dengan logo dan musik' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }));
    await waitFor(() => expect(motionStudioApi.generate).toHaveBeenCalledWith(
      'D:/projects/studio', 'Buat video dengan logo dan musik', 640,
      { imageAssetId: imageId, audioAssetId: audioId, audioGain: 0.6 },
    ));
    expect(screen.queryByText(/Image: logo.png/)).not.toBeInTheDocument();
    expect(screen.queryByText(/WAV: music.wav/)).not.toBeInTheDocument();
  });

  it('sends three ordered product images and looping soundtrack with opt-in local voiceover', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({ capabilities: {
      aiPromptDirector: 'short-text-motion-preview', aiWorkspaceMedia: 'uploaded-image-wav',
      aiSceneImagesMax: 3, aiAudioLoop: true, localVoiceoverConfigured: true,
    } });
    const ids = ['a', 'b', 'c'].map(hex => 'asset-' + hex.repeat(64));
    vi.mocked(motionStudioApi.uploadImage).mockImplementation(async (_workspace, file) => ({
      id: ids[Number(file.name[0]) - 1], width: 300, height: 160, bytes: 300,
    }));
    vi.mocked(motionStudioApi.uploadAudio).mockResolvedValue({
      id: 'audio-' + 'f'.repeat(64), channels: 1, sampleRate: 16000, seconds: 0.5, bytes: 400,
    });
    vi.mocked(motionStudioApi.generate).mockResolvedValue({
      project: { ...fixture(), revision: 2 }, outline: ['Produk 1', 'Produk 2', 'Produk 3'], limitations: [],
      job: { id: 'motionjob-' + 'f'.repeat(24), projectId: id, revision: 2,
        status: 'queued', framesCompleted: 0, profile: { frameCount: 90, width: 640, height: 360 } },
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    await waitFor(() => expect(screen.getByLabelText('Attach motion image')).toHaveAttribute('multiple'));
    const files = [1,2,3].map(i => new File([new Uint8Array(25)], i + '.png', { type: 'image/png' }));
    fireEvent.change(screen.getByLabelText('Attach motion image'), { target: { files } });
    await waitFor(() => expect(motionStudioApi.uploadImage).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/Image: 3.png/)).toBeInTheDocument();
    const wav = new File([new Uint8Array(50)], 'music.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Attach motion WAV'), { target: { files: [wav] } });
    expect(await screen.findByText(/WAV: music.wav/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Loop prompt soundtrack'));
    fireEvent.change(screen.getByLabelText('Motion voice-over script'), {
      target: { value: 'Halo, ini tiga produk favorit.' },
    });
    fireEvent.change(screen.getByLabelText('Motion voice-over gain'), { target: { value: '0.7' } });
    fireEvent.change(screen.getByLabelText('Motion prompt'), { target: { value: 'Video tiga scene' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }));
    await waitFor(() => expect(motionStudioApi.generate).toHaveBeenCalledWith(
      'D:/projects/studio', 'Video tiga scene', 640, {
        sceneImageAssetIds: ids, audioAssetId: 'audio-' + 'f'.repeat(64),
        audioGain: 1, audioLoop: true, voiceoverText: 'Halo, ini tiga produk favorit.', voiceoverGain: 0.7,
      },
    ));
    expect(screen.queryByText(/Image: 3.png/)).not.toBeInTheDocument();
  });

  it('disables attachments for older SuperAgent servers instead of silently omitting media', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({
      capabilities: { aiPromptDirector: 'short-text-motion-preview' },
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    expect(await screen.findByText(/Media attachments require an updated SuperAgent server/)).toBeInTheDocument();
    expect(screen.getByLabelText('Attach motion image')).toBeDisabled();
    expect(screen.getByLabelText('Attach motion WAV')).toBeDisabled();
  });

  it('leaves manual editor usable when the connected SuperAgent server lacks Motion Director', async () => {
    vi.mocked(motionStudioApi.capabilities).mockRejectedValue(new Error('404'));
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    expect(await screen.findByText(/needs an updated SuperAgent server/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motion prompt'), { target: { value: 'Buat video' } });
    expect(screen.getByRole('button', { name: 'Generate with AI' })).toBeDisabled();
    expect(screen.getByLabelText('Select Motion project')).toBeEnabled();
    expect(motionStudioApi.generate).not.toHaveBeenCalled();
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

  it('previews and applies a compound preset with revision-safe undo', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({
      capabilities: { aiPromptDirector: 'short-text-motion-preview', compoundPresets: true },
    });
    vi.mocked(motionStudioApi.presets).mockResolvedValue({
      count: 1, presets: [{ id: 'neon-impact', name: 'Neon Impact', description: 'Bright',
        tags: ['neon'], entrance: 'entrance-whip-left',
        emphasis: 'kinetic-glitch-drift', exit: 'exit-whip-right' }],
    });
    vi.mocked(motionStudioApi.previewPreset).mockImplementation(async () => {
      const preview = fixture();
      preview.composition.layers[0].tracks.push({ property: 'x',
        keyframes: [{ frame: 0, value: 140 }, { frame: 30, value: 120 }] });
      return preview;
    });
    vi.mocked(motionStudioApi.applyPreset).mockImplementation(async () => {
      const applied = fixture();
      applied.revision = 2;
      applied.composition.layers[0].tracks.push({
        property: 'x', keyframes: [{ frame: 0, value: 140 }, { frame: 30, value: 120 }],
      });
      return applied;
    });
    vi.mocked(motionStudioApi.edit).mockImplementation(async (_ws, _id, base, ops) => {
      const restored = fixture();
      restored.revision = base + 1;
      if (ops[0].type === 'replace-composition') restored.composition = ops[0].composition;
      return restored;
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByLabelText('Select Motion preset');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(motionStudioApi.previewPreset).toHaveBeenCalledWith(
      'D:/projects/studio', id, 1, expect.objectContaining({ presetId: 'neon-impact', targetLayerId: 'title' }),
    ));
    expect(await screen.findByText(/PREVIEW \(not saved\)/)).toBeInTheDocument();
    expect(motionStudioApi.applyPreset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(motionStudioApi.applyPreset).toHaveBeenCalledWith(
      'D:/projects/studio', id, 1, expect.objectContaining({ presetId: 'neon-impact' }),
    ));
    expect(await screen.findByText(/Applied neon-impact · revision 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo scene change' }));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith(
      'D:/projects/studio', id, 2,
      [{ type: 'replace-composition', composition: expect.objectContaining({ layers: expect.any(Array) }) }],
    ));
    expect(await screen.findByText('Undo · revision 3')).toBeInTheDocument();
  });

  it('previews, applies and undoes one individual effect through the shared editor history', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({
      capabilities: { aiPromptDirector: 'short-text-motion-preview', effectsEngine: true },
    });
    vi.mocked(motionStudioApi.effectsPage).mockResolvedValue({
      count: 1, filteredTotal: 1, hasMore: false,
      effects: [{
        id: 'entrance-fade-in', name: 'Fade In', category: 'entrance',
        description: 'Smooth fade', tags: [], targetKinds: ['text'],
        parameters: {},
      }],
    });
    vi.mocked(motionStudioApi.previewEffect).mockImplementation(async () => {
      const value = fixture();
      value.composition.layers[0].tracks.push({
        property: 'x', keyframes: [{ frame: 0, value: 110 }, { frame: 45, value: 120 }],
      });
      return value;
    });
    vi.mocked(motionStudioApi.applyEffect).mockImplementation(async () => {
      const value = fixture();
      value.revision = 2;
      value.composition.layers[0].tracks.push({
        property: 'x', keyframes: [{ frame: 0, value: 110 }, { frame: 45, value: 120 }],
      });
      return value;
    });
    vi.mocked(motionStudioApi.edit).mockImplementation(async (_ws, _id, revision, ops) => {
      const value = fixture(); value.revision = revision + 1;
      if (ops[0].type === 'replace-composition') value.composition = ops[0].composition;
      return value;
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByText('1 effects');
    fireEvent.click(screen.getByText(/Effects Library/));
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(motionStudioApi.previewEffect).toHaveBeenCalledWith(
      'D:/projects/studio', id, 1,
      expect.objectContaining({ effectId: 'entrance-fade-in', targetLayerId: 'title' }),
    ));
    expect(await screen.findByText(/PREVIEW \(not saved\)/)).toBeInTheDocument();
    expect(motionStudioApi.applyEffect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(motionStudioApi.applyEffect).toHaveBeenCalledWith(
      'D:/projects/studio', id, 1, expect.objectContaining({ effectId: 'entrance-fade-in' }),
    ));
    expect(await screen.findByText('Applied entrance-fade-in · revision 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo scene change' }));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith(
      'D:/projects/studio', id, 2,
      [{ type: 'replace-composition', composition: expect.objectContaining({ layers: expect.any(Array) }) }],
    ));
    expect(await screen.findByText('Undo · revision 3')).toBeInTheDocument();
  });

  it('adds a single effect to a non-destructive stack and can undo the insertion', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({
      capabilities: { effectsEngine: true, nondestructiveEffectStack: true },
    });
    vi.mocked(motionStudioApi.effectsPage).mockResolvedValue({
      count: 1, filteredTotal: 1, hasMore: false,
      effects: [{ id: 'entrance-fade-in', name: 'Fade In', category: 'entrance',
        description: 'Smooth fade', tags: [], targetKinds: ['text'], parameters: {} }],
    });
    vi.mocked(motionStudioApi.changeStack).mockImplementation(async () => {
      const result = fixture(); result.revision = 2;
      result.composition.effectStack = [
        { id: 'fx-example', effectId: 'entrance-fade-in', enabled: true, targetLayerId: 'title', startFrame: 0, durationFrames: 75 },
      ];
      return result;
    });
    vi.mocked(motionStudioApi.edit).mockImplementation(async (_ws, _id, rev, ops) => {
      const result = fixture(); result.revision = rev + 1;
      if (ops[0].type === 'replace-composition') result.composition = ops[0].composition;
      return result;
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByText('1 effects');
    fireEvent.click(screen.getByText('Effects Library'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(motionStudioApi.changeStack).toHaveBeenCalledWith(
      'D:/projects/studio', id, 1, expect.objectContaining({
        type: 'add',
        entry: expect.objectContaining({ effectId: 'entrance-fade-in', enabled: true, targetLayerId: 'title' }),
      }),
    ));
    expect(motionStudioApi.applyEffect).not.toHaveBeenCalled();
    await screen.findByText('Updated Motion effect stack · revision 2').catch(() => screen.findByText('Applied entrance-fade-in · revision 2'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo scene change' }));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith(
      'D:/projects/studio', id, 2, [{ type: 'replace-composition', composition: expect.objectContaining({ layers: expect.any(Array) }) }],
    ));
  });
  it('restores a saved project revision and pushes prior composition onto Undo history', async () => {
    vi.mocked(motionStudioApi.capabilities).mockResolvedValue({
      capabilities: { motionRevisionHistory: true },
    });
    vi.mocked(motionStudioApi.history).mockResolvedValue({
      snapshots: [{ revision: 1, name: 'Product intro', updatedAt: '2026-10-21T00:00:00.000Z' }],
    });
    const current = fixture(); current.revision = 3;
    vi.mocked(motionStudioApi.inspect).mockResolvedValue(current);
    vi.mocked(motionStudioApi.restoreHistory).mockImplementation(async () => {
      const restored = fixture(); restored.revision = 4; return restored;
    });
    vi.mocked(motionStudioApi.edit).mockImplementation(async (_ws, _id, rev, ops) => {
      const restored = fixture(); restored.revision = rev + 1;
      if (ops[0].type === 'replace-composition') restored.composition = ops[0].composition;
      return restored;
    });
    render(<MotionStudioTab workspacePath="D:/projects/studio" isActive />);
    await screen.findByText('Choose a scene to edit');
    fireEvent.change(screen.getByLabelText('Select Motion project'), { target: { value: id } });
    await screen.findByText('1 snapshots');
    fireEvent.click(screen.getByText('Auto-saved revisions'));
    fireEvent.click(screen.getByRole('button', { name: 'Restore Motion revision 1' }));
    await waitFor(() => expect(motionStudioApi.restoreHistory).toHaveBeenCalledWith(
      'D:/projects/studio', id, 3, 1,
    ));
    expect(await screen.findByText('Restored saved revision 1 · new revision 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo scene change' }));
    await waitFor(() => expect(motionStudioApi.edit).toHaveBeenCalledWith(
      'D:/projects/studio', id, 4,
      [{ type: 'replace-composition', composition: expect.objectContaining({ layers: expect.any(Array) }) }],
    ));
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
