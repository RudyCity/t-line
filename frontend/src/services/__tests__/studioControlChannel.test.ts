import { describe, it, expect, beforeEach, vi } from 'vitest';
import { studioControlChannel } from '../studioControlChannel';
import { deriveClipsFromComposition, type StudioControlAction } from '../studioControlTypes';
import type { StudioComposition } from '../studioApi';

describe('studioControlChannel & studioControlTypes', () => {
  beforeEach(() => {
    studioControlChannel.reset();
  });

  it('dispatches typed desktop control actions to registered handlers', () => {
    const handler = vi.fn();
    const unsubscribe = studioControlChannel.onAction(handler);

    const action: StudioControlAction = {
      type: 'open_project',
      workspacePath: '/test/workspace',
      projectId: 'studio-12345678901234567890',
    };

    studioControlChannel.dispatchAction(action);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(action);

    unsubscribe();
    studioControlChannel.dispatchAction(action);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores actions without a workspacePath', () => {
    const handler = vi.fn();
    studioControlChannel.onAction(handler);

    studioControlChannel.dispatchAction({
      type: 'focus_studio',
      workspacePath: '',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('broadcasts project events with monotonic sequence IDs', () => {
    const handler = vi.fn();
    studioControlChannel.onEvent(handler);

    const event1 = studioControlChannel.emitEvent(
      '/test/workspace',
      'studio-p1',
      'project_revision_changed',
      { revision: 2 }
    );

    const event2 = studioControlChannel.emitEvent(
      '/test/workspace',
      'studio-p1',
      'clip_modified',
      { clipId: 'clip-1' }
    );

    expect(event1.sequenceId).toBe(1);
    expect(event2.sequenceId).toBe(2);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(event1.type).toBe('project_revision_changed');
    expect(event2.type).toBe('clip_modified');
  });

  it('derives multi-track clips from a studio composition', () => {
    const comp: StudioComposition = {
      width: 1920,
      height: 1080,
      fps: { numerator: 30, denominator: 1 },
      durationFrames: 90,
      background: '#000000',
      layers: [
        {
          id: 'layer-text-1',
          kind: 'text',
          text: 'Welcome to T-Line',
          fontSize: 48,
          fontFamily: 'sans-serif',
          x: 100,
          y: 200,
          width: 400,
          height: 100,
          rotation: 0,
          opacity: 1,
          fill: '#ffffff',
          tracks: [],
        },
      ],
      audioTracks: [
        {
          assetId: 'audio-abc123',
          startFrame: 0,
          volume: 0.8,
          role: 'music',
        },
      ],
    };

    const tracks = deriveClipsFromComposition(comp);
    expect(tracks.length).toBe(2);
    expect(tracks[0].kind).toBe('video');
    expect(tracks[0].clips.length).toBe(1);
    expect(tracks[0].clips[0].name).toBe('Welcome to T-Line');
    expect(tracks[0].clips[0].durationFrames).toBe(90);

    expect(tracks[1].kind).toBe('audio');
    expect(tracks[1].clips.length).toBe(1);
    expect(tracks[1].clips[0].assetId).toBe('audio-abc123');
    expect(tracks[1].clips[0].volume).toBe(0.8);
  });
});
