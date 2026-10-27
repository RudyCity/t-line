import { describe, it, expect } from 'vitest';
import {
  splitClipAtFrame,
  trimClip,
  calculateSnap,
  moveClip,
  rippleDeleteClip,
  deleteClip,
  syncClipsToComposition,
} from '../studioClipEdits';
import type { StudioMultiTrack } from '../studioControlTypes';
import type { StudioComposition } from '../studioApi';

describe('studioClipEdits', () => {
  const initialTracks: StudioMultiTrack[] = [
    {
      id: 'v1',
      name: 'Video 1',
      kind: 'video',
      index: 0,
      muted: false,
      locked: false,
      clips: [
        {
          id: 'clip-1',
          trackId: 'v1',
          layerId: 'layer-1',
          kind: 'video',
          name: 'Scene 1',
          startFrame: 0,
          durationFrames: 60,
          trimInFrames: 0,
          trimOutFrames: 60,
        },
        {
          id: 'clip-2',
          trackId: 'v1',
          layerId: 'layer-2',
          kind: 'video',
          name: 'Scene 2',
          startFrame: 60,
          durationFrames: 60,
          trimInFrames: 0,
          trimOutFrames: 60,
        },
      ],
    },
    {
      id: 'a1',
      name: 'Audio 1',
      kind: 'audio',
      index: 1,
      muted: false,
      locked: false,
      clips: [
        {
          id: 'clip-a1',
          trackId: 'a1',
          layerId: 'audio-track',
          assetId: 'asset-wav-1',
          kind: 'audio',
          name: 'Voiceover',
          startFrame: 0,
          durationFrames: 120,
          trimInFrames: 0,
          trimOutFrames: 120,
          volume: 0.8,
        },
      ],
    },
  ];

  it('splits clip at frame boundary into two contiguous clips', () => {
    const result = splitClipAtFrame(initialTracks, 'v1', 'clip-1', 25);
    const v1 = result.find(t => t.id === 'v1')!;

    expect(v1.clips).toHaveLength(3);
    expect(v1.clips[0].id).toBe('clip-1');
    expect(v1.clips[0].startFrame).toBe(0);
    expect(v1.clips[0].durationFrames).toBe(25);
    expect(v1.clips[0].trimOutFrames).toBe(25);

    expect(v1.clips[1].startFrame).toBe(25);
    expect(v1.clips[1].durationFrames).toBe(35);
    expect(v1.clips[1].trimInFrames).toBe(25);
    expect(v1.clips[1].trimOutFrames).toBe(60);
  });

  it('ignores split if splitFrame is outside the clip', () => {
    const result = splitClipAtFrame(initialTracks, 'v1', 'clip-1', 90);
    const v1 = result.find(t => t.id === 'v1')!;
    expect(v1.clips).toHaveLength(2);
  });

  it('trims in-point and out-point without reducing below 1 frame', () => {
    const trimmed = trimClip(initialTracks, 'v1', 'clip-1', 10, -5);
    const clip1 = trimmed.find(t => t.id === 'v1')!.clips[0];

    expect(clip1.startFrame).toBe(10);
    expect(clip1.durationFrames).toBe(45);
    expect(clip1.trimInFrames).toBe(10);
  });

  it('snaps magnetically to nearby clip edges and playhead', () => {
    const snap = calculateSnap(58, 30, initialTracks, 60, 5);
    expect(snap.snapped).toBe(true);
    expect(snap.startFrame).toBe(60); // Snapped to clip-2 startFrame / playhead
  });

  it('moves clip to a new position with sorting', () => {
    const moved = moveClip(initialTracks, 'v1', 'v1', 'clip-1', 150, undefined, false);
    const v1 = moved.find(t => t.id === 'v1')!;

    expect(v1.clips[0].id).toBe('clip-2');
    expect(v1.clips[1].id).toBe('clip-1');
    expect(v1.clips[1].startFrame).toBe(150);
  });

  it('prevents moving video clip to audio track', () => {
    const moved = moveClip(initialTracks, 'v1', 'a1', 'clip-1', 0);
    // Should be a no-op
    expect(moved).toEqual(initialTracks);
  });

  it('ripple deletes clip and shifts subsequent clips backwards', () => {
    const rippled = rippleDeleteClip(initialTracks, 'v1', 'clip-1');
    const v1 = rippled.find(t => t.id === 'v1')!;

    expect(v1.clips).toHaveLength(1);
    expect(v1.clips[0].id).toBe('clip-2');
    expect(v1.clips[0].startFrame).toBe(0); // Shifted from 60 to 0
  });

  it('lift delete leaves the gap intact', () => {
    const deleted = deleteClip(initialTracks, 'v1', 'clip-1');
    const v1 = deleted.find(t => t.id === 'v1')!;

    expect(v1.clips).toHaveLength(1);
    expect(v1.clips[0].id).toBe('clip-2');
    expect(v1.clips[0].startFrame).toBe(60); // Gap remains at 0..60
  });

  it('syncs multi-track arrangement back to StudioComposition', () => {
    const dummyComp: StudioComposition = {
      background: '#000000',
      fps: { numerator: 30, denominator: 1 },
      durationFrames: 60,
      width: 1920,
      height: 1080,
      layers: [],
    };

    const synced = syncClipsToComposition(initialTracks, dummyComp);
    expect(synced.durationFrames).toBe(120);
    expect(synced.audioTracks).toBeDefined();
    expect(synced.audioTracks![0].assetId).toBe('asset-wav-1');
  });
});
