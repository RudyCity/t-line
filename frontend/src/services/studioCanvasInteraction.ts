import type { StudioEdit, StudioLayer, StudioProject } from './studioApi';
import { evaluateLayer, makeKeyframeTrack } from './studioScene';

export type CanvasPoint = { x: number; y: number };
export type CanvasGeometry = { left: number; top: number; width: number; height: number };
export type StudioCanvasMode = 'move' | 'rotate' | 'resize';
export type CanvasPreview = {
  layerId: string; x: number; y: number; rotation: number; width: number; height: number;
  centerGuideX: boolean; centerGuideY: boolean;
};

const limit = (n: number) => Math.max(-100_000, Math.min(100_000, n));
export function clientToStudioPoint(
  point: CanvasPoint, rect: CanvasGeometry, scene: { width: number; height: number },
): CanvasPoint {
  if (rect.width <= 0 || rect.height <= 0) throw new Error('Studio canvas has no measurable size');
  return {
    x: (point.x - rect.left) * scene.width / rect.width,
    y: (point.y - rect.top) * scene.height / rect.height,
  };
}
export function draggedCanvasPosition(
  start: CanvasPoint, current: CanvasPoint, origin: CanvasPoint,
  scene: { width: number; height: number }, layer: Pick<StudioLayer, 'width' | 'height'>, snapping: boolean,
): Pick<CanvasPreview, 'x' | 'y' | 'centerGuideX' | 'centerGuideY'> {
  let x = limit(origin.x + current.x - start.x);
  let y = limit(origin.y + current.y - start.y);
  const snapX = (scene.width - layer.width) / 2;
  const snapY = (scene.height - layer.height) / 2;
  const centerGuideX = snapping && Math.abs(x - snapX) <= 8;
  const centerGuideY = snapping && Math.abs(y - snapY) <= 8;
  if (snapping) {
    x = centerGuideX ? snapX : Math.round(x / 10) * 10;
    y = centerGuideY ? snapY : Math.round(y / 10) * 10;
  }
  return { x: limit(x), y: limit(y), centerGuideX, centerGuideY };
}
export function resizedCanvasDimensions(
  start: CanvasPoint, current: CanvasPoint, original: { width: number; height: number }, snapping: boolean,
): Pick<CanvasPreview, 'width' | 'height'> {
  const quantize = (value: number) => snapping ? Math.round(value / 10) * 10 : Math.round(value * 100) / 100;
  return {
    width: Math.max(1, Math.min(100_000, quantize(original.width + current.x - start.x))),
    height: Math.max(1, Math.min(100_000, quantize(original.height + current.y - start.y))),
  };
}
/**
 * Resize a rectangle along its rotated local X/Y axes while the opposite
 * (top-left) corner remains fixed in world coordinates.
 */
export function resizedRotatedRectangle(
  start: CanvasPoint, current: CanvasPoint,
  original: Pick<CanvasPreview, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  snapping: boolean,
): Pick<CanvasPreview, 'x' | 'y' | 'width' | 'height'> {
  const radians = original.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const localX = cos * dx + sin * dy;
  const localY = -sin * dx + cos * dy;
  const dimensions = resizedCanvasDimensions(
    { x: 0, y: 0 }, { x: localX, y: localY }, original, snapping,
  );
  const changeW = dimensions.width - original.width;
  const changeH = dimensions.height - original.height;
  // Rotation is around layer center, so changing dimensions moves the
  // unrotated top-left property even when world top-left is anchored.
  const x = original.x + ((cos - 1) * changeW - sin * changeH) / 2;
  const y = original.y + (sin * changeW + (cos - 1) * changeH) / 2;
  const round = (value: number) => Math.round(value * 100) / 100;
  return { ...dimensions, x: limit(round(x)), y: limit(round(y)) };
}
export function rotatedCanvasAngle(
  start: CanvasPoint, current: CanvasPoint, center: CanvasPoint,
  initialDegrees: number, snapping: boolean,
): number {
  const angle = (point: CanvasPoint) => Math.atan2(point.y - center.y, point.x - center.x);
  const delta = (angle(current) - angle(start)) * 180 / Math.PI;
  const unwrapped = initialDegrees + ((delta + 540) % 360 - 180);
  return limit(snapping ? Math.round(unwrapped / 15) * 15 : Math.round(unwrapped * 100) / 100);
}

/** Existing animated properties receive a current-frame keyframe, not a silent base-value edit. */
export function transformStudioEdits(
  project: StudioProject, layerId: string, frame: number,
  values: Partial<Pick<CanvasPreview, 'x' | 'y' | 'rotation' | 'width' | 'height'>>,
): StudioEdit[] {
  const layer = project.composition.layers.find(item => item.id === layerId);
  if (!layer) throw new Error('Studio layer no longer exists');
  const evaluated = evaluateLayer(layer, frame);
  const edits: StudioEdit[] = [];
  if (values.width !== undefined || values.height !== undefined) {
    const width = values.width ?? layer.width;
    const height = values.height ?? layer.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 100_000 || height > 100_000) {
      throw new Error('Invalid canvas layer size');
    }
    if (width !== layer.width || height !== layer.height) {
      const composition = structuredClone(project.composition);
      const target = composition.layers.find(item => item.id === layerId)!;
      target.width = width;
      target.height = height;
      for (const property of ['x', 'y'] as const) {
        const value = values[property];
        if (value === undefined || !Number.isFinite(value) ||
            value < -100_000 || value > 100_000 ||
            Math.abs(value - evaluated[property]) < 0.001) continue;
        const position = target.tracks.findIndex(track => track.property === property);
        if (position >= 0) target.tracks[position] = makeKeyframeTrack(layer, property, frame, value);
        else target[property] = value;
      }
      edits.push({ type: 'replace-composition', composition });
      return edits;
    }
  }
  for (const property of ['x', 'y', 'rotation'] as const) {
    const value = values[property];
    if (value === undefined || !Number.isFinite(value) || Math.abs(value - evaluated[property]) < 0.001) continue;
    if (layer.tracks.some(track => track.property === property)) {
      edits.push({ type: 'set-track', layerId, track: makeKeyframeTrack(layer, property, frame, value) });
    } else {
      edits.push({ type: 'set-property', layerId, property, value });
    }
  }
  return edits;
}
