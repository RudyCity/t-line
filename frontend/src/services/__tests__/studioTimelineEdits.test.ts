import { describe, expect, it } from 'vitest';
import type { StudioProject } from '../studioApi';
import {
  moveStudioKeyframe, easeStudioKeyframe, deleteStudioKeyframe, motionFrameFromPointer,
} from '../studioTimelineEdits';

function fixture(): StudioProject {
  return {
    schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), workspaceRoot: 'D:/workspace',
    name: 'Timeline demo', revision: 4, createdAt: '2026-10-20', updatedAt: '2026-10-20',
    composition: {
      width: 1920, height: 1080, durationFrames: 90, background: '#000000',
      fps: { numerator: 30, denominator: 1 },
      layers: [{
        id: 'panel', kind: 'rect', x: 120, y: 180, width: 320, height: 110,
        rotation: 0, opacity: 1, fill: '#FFFFFF',
        tracks: [
          { property: 'x', keyframes: [
            { frame: 0, value: 120, easing: 'step' },
            { frame: 30, value: 300, easing: 'easeInOut' },
            { frame: 60, value: 420 },
          ] },
          { property: 'opacity', keyframes: [{ frame: 0, value: 0.5 }] },
        ],
      }],
    },
  };
}
describe('Studio timeline keyframe editing', () => {
  it('moves keyframes without losing values, easing, ordering, or mutating the original scene', () => {
    const project = fixture();
    const edits = moveStudioKeyframe(project, 'panel', 'x', 30, 45);
    expect(edits).toEqual([{ type: 'set-track', layerId: 'panel', track: {
      property: 'x', keyframes: [
        { frame: 0, value: 120, easing: 'step' },
        { frame: 45, value: 300, easing: 'easeInOut' },
        { frame: 60, value: 420 },
      ],
    } }]);
    expect(project.composition.layers[0].tracks[0].keyframes[1].frame).toBe(30);
    expect(moveStudioKeyframe(project, 'panel', 'x', 30, 30)).toEqual([]);
  });
  it('rejects duplicate, fractional, and out-of-range frames without changing the scene', () => {
    const project = fixture();
    expect(() => moveStudioKeyframe(project, 'panel', 'x', 30, 60)).toThrow('already occupies');
    expect(() => moveStudioKeyframe(project, 'panel', 'x', 30, 100)).toThrow('outside');
    expect(() => moveStudioKeyframe(project, 'panel', 'x', 30, 5.5)).toThrow('outside');
    expect(() => moveStudioKeyframe(project, 'panel', 'x', 5, 10)).toThrow('no longer exists');
    expect(project.revision).toBe(4);
  });
  it('updates outgoing easing only for the selected keyframe', () => {
    const project = fixture();
    const edits = easeStudioKeyframe(project, 'panel', 'x', 0, 'easeInOut');
    expect(edits[0]).toMatchObject({ type: 'set-track', layerId: 'panel', track: {
      keyframes: [expect.objectContaining({ frame: 0, easing: 'easeInOut' }),
        expect.objectContaining({ frame: 30, easing: 'easeInOut' }), expect.objectContaining({ frame: 60 })],
    } });
    expect(easeStudioKeyframe(project, 'panel', 'x', 0, 'step')).toEqual([]);
    expect(() => easeStudioKeyframe(project, 'panel', 'x', 0, 'bad' as never)).toThrow('Unsupported');
  });
  it('deletes one keyframe through set-track, and deletes the final track through scene replacement', () => {
    const project = fixture();
    const edits = deleteStudioKeyframe(project, 'panel', 'x', 30);
    expect(edits).toMatchObject([{ type: 'set-track', track: { keyframes: [
      expect.objectContaining({ frame: 0 }), expect.objectContaining({ frame: 60 }),
    ] } }]);
    const last = deleteStudioKeyframe(project, 'panel', 'opacity', 0);
    expect(last).toMatchObject([{ type: 'replace-composition', composition: {
      layers: [expect.objectContaining({ tracks: [expect.objectContaining({ property: 'x' })] })],
    } }]);
    expect(project.composition.layers[0].tracks).toHaveLength(2);
  });
  it('converts pointer positions to clamped whole frames and rejects zero-width lanes', () => {
    expect(motionFrameFromPointer(60, 10, 100, 11)).toBe(5);
    expect(motionFrameFromPointer(-100, 10, 100, 11)).toBe(0);
    expect(motionFrameFromPointer(999, 10, 100, 11)).toBe(10);
    expect(() => motionFrameFromPointer(10, 0, 0, 10)).toThrow('measurable');
  });
});
