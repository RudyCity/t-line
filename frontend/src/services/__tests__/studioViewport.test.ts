import { describe, expect, it } from 'vitest';
import { DEFAULT_MOTION_VIEWPORT, clampStudioZoom, zoomStudioViewport, panStudioViewport } from '../studioViewport';

describe('Studio viewport navigation', () => {
  it('clamps zoom to accessible limits and guards invalid numbers', () => {
    expect(clampStudioZoom(0.01)).toBe(0.25);
    expect(clampStudioZoom(100)).toBe(4);
    expect(clampStudioZoom(Number.NaN)).toBe(1);
  });
  it('zooms around cursor without moving the underlying scene point', () => {
    const bounds = { left: 100, top: 50, width: 900, height: 600 };
    const pointer = { x: 775, y: 275 };
    const transformed = zoomStudioViewport(DEFAULT_MOTION_VIEWPORT, 2, pointer, bounds);
    expect(transformed).toEqual({ zoom: 2, x: -225, y: 75 });
    const sceneOffsetBefore = { x: pointer.x - bounds.left - bounds.width / 2, y: pointer.y - bounds.top - bounds.height / 2 };
    expect((sceneOffsetBefore.x - transformed.x) / transformed.zoom).toBe(sceneOffsetBefore.x);
    expect((sceneOffsetBefore.y - transformed.y) / transformed.zoom).toBe(sceneOffsetBefore.y);
  });
  it('pans independently of zoom and leaves its input unmodified', () => {
    const original = { zoom: 1.5, x: 20, y: -30 };
    expect(panStudioViewport(original, { x: 15, y: -9 })).toEqual({ zoom: 1.5, x: 35, y: -39 });
    expect(original.x).toBe(20);
  });
});
