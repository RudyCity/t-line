import { describe, expect, it } from 'vitest';
import { clientToMotionPoint, draggedCanvasPosition, resizedCanvasDimensions, rotatedCanvasAngle, transformMotionEdits } from '../motionCanvasInteraction';
import type { MotionProject } from '../motionStudioApi';

function scene(): MotionProject {
  return {
    schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), workspaceRoot: 'D:/studio', revision: 4,
    name: 'Direct manipulation', createdAt: '', updatedAt: '',
    composition: {
      width: 1920, height: 1080, durationFrames: 90,
      fps: { numerator: 30, denominator: 1 }, background: '#000000',
      layers: [
        { id: 'animated', kind: 'rect', x: 100, y: 150, width: 200, height: 100,
          rotation: 0, opacity: 1, fill: '#FFFFFF',
          tracks: [{ property: 'x', keyframes: [{ frame: 0, value: 100 }, { frame: 30, value: 300 }] }] },
      ],
    },
  };
}
describe('Motion canvas coordinate and transform safety', () => {
  it('translates client coordinates into scene coordinates at a responsive zoom', () => {
    expect(clientToMotionPoint({ x: 340, y: 210 }, { left: 100, top: 75, width: 960, height: 540 }, { width: 1920, height: 1080 }))
      .toEqual({ x: 480, y: 270 });
    expect(() => clientToMotionPoint({ x: 1, y: 2 }, { left: 0, top: 0, width: 0, height: 20 }, { width: 100, height: 100 }))
      .toThrow('no measurable size');
  });
  it('snaps to grid, favors center alignment and supports unsnapped precision', () => {
    const layer = { width: 200, height: 100 };
    const sc = { width: 1920, height: 1080 };
    const start = { x: 100, y: 100 };
    const origin = { x: 100, y: 150 };
    expect(draggedCanvasPosition(start, { x: 125, y: 133 }, origin, sc, layer, true))
      .toMatchObject({ x: 130, y: 180, centerGuideX: false });
    expect(draggedCanvasPosition(start, { x: 859, y: 430 }, origin, sc, layer, true))
      .toMatchObject({ x: 860, y: 480, centerGuideX: true, centerGuideY: false });
    expect(draggedCanvasPosition(start, { x: 125, y: 133 }, origin, sc, layer, false))
      .toMatchObject({ x: 125, y: 183, centerGuideX: false, centerGuideY: false });
  });
  it('snaps rotation to 15 degrees and allows precise rotation without snapping', () => {
    const center = { x: 100, y: 100 };
    expect(rotatedCanvasAngle({ x: 100, y: 50 }, { x: 120, y: 60 }, center, 0, true)).toBe(30);
    expect(rotatedCanvasAngle({ x: 100, y: 50 }, { x: 120, y: 60 }, center, 0, false)).toBeCloseTo(26.57);
  });
  it('resizes dimensions with grid snapping and persists changes through a guarded scene snapshot', () => {
    expect(resizedCanvasDimensions({ x: 10, y: 10 }, { x: 52, y: 37 }, { width: 200, height: 100 }, true))
      .toEqual({ width: 240, height: 130 });
    expect(resizedCanvasDimensions({ x: 10, y: 10 }, { x: 13.25, y: 14.5 }, { width: 200, height: 100 }, false))
      .toEqual({ width: 203.25, height: 104.5 });
    const project = scene();
    const edits = transformMotionEdits(project, 'animated', 0, { width: 250, height: 120 });
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ type: 'replace-composition', composition: {
      layers: [expect.objectContaining({ id: 'animated', width: 250, height: 120 })],
    } });
    expect(project.composition.layers[0].width).toBe(200);
    expect(() => transformMotionEdits(project, 'animated', 0, { width: 0 })).toThrow('Invalid canvas layer size');
  });
  it('preserves animated x track and writes its active-frame keyframe, keeping y as base', () => {
    const project = scene();
    const edits = transformMotionEdits(project, 'animated', 15, { x: 240, y: 173 });
    expect(edits).toHaveLength(2);
    expect(edits[0]).toMatchObject({ type: 'set-track', layerId: 'animated', track: {
      property: 'x', keyframes: [{ frame: 0, value: 100 }, { frame: 15, value: 240 }, { frame: 30, value: 300 }],
    } });
    expect(edits[1]).toEqual({ type: 'set-property', layerId: 'animated', property: 'y', value: 173 });
    expect(project.composition.layers[0].tracks[0].keyframes).toHaveLength(2);
    expect(transformMotionEdits(project, 'animated', 15, { x: 200, y: 150, rotation: 0 })).toEqual([]);
    expect(() => transformMotionEdits(project, 'missing', 0, { x: 100 })).toThrow('no longer exists');
  });
});
