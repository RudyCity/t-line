export interface MotionViewport { zoom: number; x: number; y: number }
export interface ViewPoint { x: number; y: number }
export const MOTION_MIN_ZOOM = 0.25;
export const MOTION_MAX_ZOOM = 4;
export const DEFAULT_MOTION_VIEWPORT: MotionViewport = { zoom: 1, x: 0, y: 0 };
export function clampMotionZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MOTION_MAX_ZOOM, Math.max(MOTION_MIN_ZOOM, value));
}
/** Pointer-anchored zoom for a canvas transformed around its center. */
export function zoomMotionViewport(
  viewport: MotionViewport, nextZoom: number, pointer: ViewPoint,
  bounds: { left: number; top: number; width: number; height: number },
): MotionViewport {
  if (bounds.width <= 0 || bounds.height <= 0) return viewport;
  const zoom = clampMotionZoom(nextZoom);
  const offsetX = pointer.x - bounds.left - bounds.width / 2;
  const offsetY = pointer.y - bounds.top - bounds.height / 2;
  const ratio = zoom / viewport.zoom;
  return {
    zoom,
    x: offsetX - (offsetX - viewport.x) * ratio,
    y: offsetY - (offsetY - viewport.y) * ratio,
  };
}
export function panMotionViewport(viewport: MotionViewport, delta: ViewPoint): MotionViewport {
  return { ...viewport, x: viewport.x + delta.x, y: viewport.y + delta.y };
}
