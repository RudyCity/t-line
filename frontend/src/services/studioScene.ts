import type { StudioLayer, StudioProject, StudioProperty, StudioTrack } from './studioApi';

function ease(t: number, kind: string): number {
  if (kind === 'step') return 0;
  if (kind === 'easeIn') return t * t;
  if (kind === 'easeOut') return t * (2 - t);
  if (kind === 'easeInOut') return t * t * (3 - 2 * t);
  if (kind === 'easeOutCubic') { const u = 1 - t; return 1 - u * u * u; }
  if (kind === 'easeOutQuart') { const u = 1 - t; return 1 - u * u * u * u; }
  if (kind === 'easeOutExpo') { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  if (kind === 'apple') {
    const u = 1 - t;
    return 1 - Math.pow(u, 3.8);
  }
  if (kind === 'spring') {
    const damping = 9;
    const frequency = 4.2;
    return 1 - Math.exp(-damping * t * 0.5) * Math.cos(frequency * t * Math.PI);
  }
  if (kind === 'easeOutBack') { const u = t - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; }
  if (kind === 'bounce') {
    const n1 = 7.5625;
    const d1 = 2.75;
    let x = t;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
    if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
    x -= 2.625 / d1;
    return n1 * x * x + 0.984375;
  }
  return t;
}

/** Mirrors SuperAgent scene evaluator v1 exactly. Pure values; no HTML execution. */
export function evaluateTrack(track: StudioTrack, frame: number): number {
  const keys = track.keyframes;
  if (!keys.length) throw new Error('Keyframes are required');
  if (frame <= keys[0].frame) return keys[0].value;
  for (let index = 1; index < keys.length; index++) {
    const left = keys[index - 1], right = keys[index];
    if (frame <= right.frame) {
      const t = (frame - left.frame) / (right.frame - left.frame);
      const eased = ease(t, left.easing ?? 'linear');
      return left.value + (right.value - left.value) * eased;
    }
  }
  return keys[keys.length - 1].value;
}

export function evaluateLayer(layer: StudioLayer, frame: number): Record<StudioProperty, number> {
  const defaultScale = layer.scale ?? 1;
  const values: Record<StudioProperty, number> = {
    x: layer.x,
    y: layer.y,
    opacity: layer.opacity,
    rotation: layer.rotation,
    scale: defaultScale,
    scaleX: layer.scaleX ?? defaultScale,
    scaleY: layer.scaleY ?? defaultScale,
    strokeDashoffset: (layer as any).strokeDashoffset ?? 0,
  };
  for (const track of layer.tracks) {
    const val = evaluateTrack(track, frame);
    values[track.property] = val;
    if (track.property === 'scale') {
      values.scaleX = val;
      values.scaleY = val;
    }
  }
  return values;
}

export function fpsOf(project: StudioProject): number {
  return project.composition.fps.numerator / project.composition.fps.denominator;
}

export function frameLabel(project: StudioProject, frame: number): string {
  const seconds = Math.max(0, frame) / fpsOf(project);
  return seconds.toFixed(2) + 's · F' + frame;
}

export function makeKeyframeTrack(layer: StudioLayer, property: StudioProperty, frame: number, value: number): StudioTrack {
  const original = layer.tracks.find(item => item.property === property);
  const map = new Map((original?.keyframes || []).map(item => [item.frame, item]));
  map.set(frame, { frame, value, easing: 'linear' as const });
  return { property, keyframes: [...map.values()].sort((a, b) => a.frame - b.frame) };
}
