import { describe, expect, it } from 'vitest';
import type { StudioLayer, StudioTrack } from '../studioApi';
import { evaluateLayer, evaluateTrack } from '../studioScene';

describe('Studio scene evaluator', () => {
  it('evaluates track keyframes with signature Apple velocity curve and easeOutExpo', () => {
    const appleTrack: StudioTrack = {
      property: 'x',
      keyframes: [
        { frame: 0, value: 0, easing: 'apple' },
        { frame: 60, value: 600 },
      ],
    };
    expect(evaluateTrack(appleTrack, 0)).toBe(0);
    expect(evaluateTrack(appleTrack, 60)).toBe(600);
    // At midpoint (t = 0.5), apple easing = 1 - (1 - 0.5)^3.8 ≈ 0.928
    const midApple = evaluateTrack(appleTrack, 30);
    expect(midApple).toBeGreaterThan(500); // Front-loaded burst
    expect(midApple).toBeCloseTo(600 * (1 - Math.pow(0.5, 3.8)), 2);

    const expoTrack: StudioTrack = {
      property: 'x',
      keyframes: [
        { frame: 0, value: 0, easing: 'easeOutExpo' },
        { frame: 60, value: 600 },
      ],
    };
    expect(evaluateTrack(expoTrack, 0)).toBe(0);
    expect(evaluateTrack(expoTrack, 60)).toBe(600);
    const midExpo = evaluateTrack(expoTrack, 30);
    expect(midExpo).toBeCloseTo(600 * (1 - Math.pow(2, -5)), 2);
  });

  it('evaluates scale, scaleX, scaleY, and strokeDashoffset properties across tracks', () => {
    const layer: StudioLayer = {
      id: 'chart-ring',
      kind: 'path',
      x: 100,
      y: 150,
      width: 200,
      height: 200,
      rotation: 0,
      opacity: 1,
      scale: 1,
      fill: 'none',
      stroke: '#00ffff',
      strokeWidth: 4,
      d: 'M 100 100 m -75 0 a 75 75 0 1 0 150 0 a 75 75 0 1 0 -150 0',
      tracks: [
        {
          property: 'scale',
          keyframes: [
            { frame: 0, value: 0.5 },
            { frame: 30, value: 1.2 },
          ],
        },
        {
          property: 'strokeDashoffset',
          keyframes: [
            { frame: 0, value: 500 },
            { frame: 30, value: 100 },
          ],
        },
      ],
    };

    const atFrame0 = evaluateLayer(layer, 0);
    expect(atFrame0.scale).toBe(0.5);
    expect(atFrame0.scaleX).toBe(0.5);
    expect(atFrame0.scaleY).toBe(0.5);
    expect(atFrame0.strokeDashoffset).toBe(500);

    const atFrame30 = evaluateLayer(layer, 30);
    expect(atFrame30.scale).toBe(1.2);
    expect(atFrame30.scaleX).toBe(1.2);
    expect(atFrame30.scaleY).toBe(1.2);
    expect(atFrame30.strokeDashoffset).toBe(100);
  });
});
