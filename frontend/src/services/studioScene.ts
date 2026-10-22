import type { StudioLayer, StudioProject, StudioProperty, StudioTrack } from './studioApi';

/** Mirrors SuperAgent scene evaluator v1 exactly. Pure values; no HTML execution. */
export function evaluateTrack(track: StudioTrack, frame: number): number {
  const keys = track.keyframes;
  if (!keys.length) throw new Error('Keyframes are required');
  if (frame <= keys[0].frame) return keys[0].value;
  for (let index = 1; index < keys.length; index++) {
    const left = keys[index - 1], right = keys[index];
    if (frame <= right.frame) {
      const t = (frame - left.frame) / (right.frame - left.frame);
      const u = t - 1;
      const eased = left.easing === 'step' ? 0 : left.easing === 'easeInOut' ? t * t * (3 - 2 * t) :
        left.easing === 'easeOutBack' ? 1 + 2.70158 * u * u * u + 1.70158 * u * u : t;
      return left.value + (right.value - left.value) * eased;
    }
  }
  return keys[keys.length - 1].value;
}
export function evaluateLayer(layer: StudioLayer, frame: number): Record<StudioProperty, number> {
  const values = { x: layer.x, y: layer.y, opacity: layer.opacity, rotation: layer.rotation };
  for (const track of layer.tracks) values[track.property] = evaluateTrack(track, frame);
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
