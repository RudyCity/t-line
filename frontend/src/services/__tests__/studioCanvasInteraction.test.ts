import { describe, expect, it } from 'vitest';
import { clientToStudioPoint, draggedCanvasPosition, resizedCanvasDimensions, resizedRotatedRectangle, rotatedCanvasAngle, transformStudioEdits } from '../studioCanvasInteraction';
import type { StudioProject } from '../studioApi';

function scene(): StudioProject {
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
describe('Studio canvas coordinate and transform safety', () => {
  it('translates client coordinates into scene coordinates at a responsive zoom', () => {
    expect(clientToStudioPoint({ x: 340, y: 210 }, { left: 100, top: 75, width: 960, height: 540 }, { width: 1920, height: 1080 }))
      .toEqual({ x: 480, y: 270 });
    expect(() => clientToStudioPoint({ x: 1, y: 2 }, { left: 0, top: 0, width: 0, height: 20 }, { width: 100, height: 100 }))
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
    const edits = transformStudioEdits(project, 'animated', 0, { width: 250, height: 120 });
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ type: 'replace-composition', composition: {
      layers: [expect.objectContaining({ id: 'animated', width: 250, height: 120 })],
    } });
    expect(project.composition.layers[0].width).toBe(200);
    expect(() => transformStudioEdits(project, 'animated', 0, { width: 0 })).toThrow('Invalid canvas layer size');
  });
  it('resizes at 90 degrees in local axes without moving the opposite world corner', () => {
    const original = { x: 100, y: 100, width: 200, height: 100, rotation: 90 };
    const resized = resizedRotatedRectangle({ x: 150, y: 250 }, { x: 150, y: 290 }, original, true);
    expect(resized).toEqual({ x: 80, y: 120, width: 240, height: 100 });
    const worldCorner = (item: typeof original) => ({
      x: item.x + item.width / 2 - Math.cos(item.rotation * Math.PI / 180) * item.width / 2
        + Math.sin(item.rotation * Math.PI / 180) * item.height / 2,
      y: item.y + item.height / 2 - Math.sin(item.rotation * Math.PI / 180) * item.width / 2
        - Math.cos(item.rotation * Math.PI / 180) * item.height / 2,
    });
    expect(worldCorner({ ...original, ...resized }).x).toBeCloseTo(worldCorner(original).x, 4);
    expect(worldCorner({ ...original, ...resized }).y).toBeCloseTo(worldCorner(original).y, 4);
  });
  it.each([0, 30, 45, 90, 135, 180, -90])(
    'keeps the world-space opposite corner stable at %i degrees', rotation => {
      const original = { x: 320, y: 240, width: 280, height: 170, rotation };
      const rotated = resizedRotatedRectangle(
        { x: 100, y: 100 }, { x: 140, y: 120 }, original, false,
      );
      const topLeft = (item: typeof original) => {
        const theta = item.rotation * Math.PI / 180;
        const c = Math.cos(theta), si = Math.sin(theta);
        return {
          x: item.x + item.width / 2 - c * item.width / 2 + si * item.height / 2,
          y: item.y + item.height / 2 - si * item.width / 2 - c * item.height / 2,
        };
      };
      expect(topLeft({ ...original, ...rotated }).x).toBeCloseTo(topLeft(original).x, 1);
      expect(topLeft({ ...original, ...rotated }).y).toBeCloseTo(topLeft(original).y, 1);
    },
  );
  it('commits rotated resize dimensions and animated anchor offsets in one scene revision', () => {
    const project = scene();
    const layer = project.composition.layers[0];
    layer.rotation = 90;
    layer.tracks.push({ property: 'y', keyframes: [{ frame: 0, value: 150 }, { frame: 30, value: 190 }] });
    const snapshot = resizedRotatedRectangle(
      { x: 100, y: 100 }, { x: 100, y: 140 },
      { x: 200, y: 170, width: 200, height: 100, rotation: 90 }, false,
    );
    const edits = transformStudioEdits(project, layer.id, 15, snapshot);
    expect(edits).toHaveLength(1);
    expect(edits[0].type).toBe('replace-composition');
    if (edits[0].type !== 'replace-composition') return;
    const target = edits[0].composition.layers[0];
    expect(target.width).toBe(240);
    expect(target.height).toBe(100);
    expect(target.tracks.find(track => track.property === 'x')?.keyframes.find(k => k.frame === 15)?.value).toBe(180);
    expect(target.tracks.find(track => track.property === 'y')?.keyframes.find(k => k.frame === 15)?.value).toBe(190);
    expect(layer.tracks.find(track => track.property === 'x')?.keyframes).toHaveLength(2);
    expect(layer.tracks.find(track => track.property === 'y')?.keyframes).toHaveLength(2);
  });
  it('preserves animated x track and writes its active-frame keyframe, keeping y as base', () => {
    const project = scene();
    const edits = transformStudioEdits(project, 'animated', 15, { x: 240, y: 173 });
    expect(edits).toHaveLength(2);
    expect(edits[0]).toMatchObject({ type: 'set-track', layerId: 'animated', track: {
      property: 'x', keyframes: [{ frame: 0, value: 100 }, { frame: 15, value: 240 }, { frame: 30, value: 300 }],
    } });
    expect(edits[1]).toEqual({ type: 'set-property', layerId: 'animated', property: 'y', value: 173 });
    expect(project.composition.layers[0].tracks[0].keyframes).toHaveLength(2);
    expect(transformStudioEdits(project, 'animated', 15, { x: 200, y: 150, rotation: 0 })).toEqual([]);
    expect(() => transformStudioEdits(project, 'missing', 0, { x: 100 })).toThrow('no longer exists');
  });
});
