import type { MotionEdit, MotionEasing, MotionKeyframe, MotionProject, MotionProperty, MotionTrack } from './motionStudioApi';

function trackFor(project: MotionProject, layerId: string, property: MotionProperty): MotionTrack {
  const layer = project.composition.layers.find(item => item.id === layerId);
  const track = layer?.tracks.find(item => item.property === property);
  if (!track) throw new Error('Motion animation track no longer exists');
  return track;
}
function existingFrame(track: MotionTrack, frame: number): MotionKeyframe {
  const key = track.keyframes.find(item => item.frame === frame);
  if (!key) throw new Error('Motion keyframe no longer exists');
  return key;
}

/** Deterministic, lossless track changes. Never mutate the authoritative project. */
export function moveMotionKeyframe(
  project: MotionProject, layerId: string, property: MotionProperty, frame: number, target: number,
): MotionEdit[] {
  const track = trackFor(project, layerId, property);
  existingFrame(track, frame);
  if (!Number.isSafeInteger(target) || target < 0 || target >= project.composition.durationFrames) {
    throw new Error('Target keyframe is outside the composition');
  }
  if (frame === target) return [];
  if (track.keyframes.some(item => item.frame === target)) throw new Error('Another keyframe already occupies this frame');
  const next = structuredClone(track);
  next.keyframes.find(item => item.frame === frame)!.frame = target;
  next.keyframes.sort((a, b) => a.frame - b.frame);
  return [{ type: 'set-track', layerId, track: next }];
}
export function easeMotionKeyframe(
  project: MotionProject, layerId: string, property: MotionProperty, frame: number, easing: MotionEasing,
): MotionEdit[] {
  if (!(['linear', 'step', 'easeInOut', 'easeOutBack'] as const).includes(easing)) throw new Error('Unsupported keyframe easing');
  if (property === 'opacity' && easing === 'easeOutBack') throw new Error('Overshoot easing cannot affect opacity');
  const track = trackFor(project, layerId, property);
  const current = existingFrame(track, frame);
  if ((current.easing ?? 'linear') === easing) return [];
  const next = structuredClone(track);
  next.keyframes.find(item => item.frame === frame)!.easing = easing;
  return [{ type: 'set-track', layerId, track: next }];
}
export function setMotionKeyframeValue(
  project: MotionProject, layerId: string, property: MotionProperty, frame: number, value: number,
): MotionEdit[] {
  if (!Number.isFinite(value) || Math.abs(value) > 100000 ||
      (property === 'opacity' && (value < 0 || value > 1))) {
    throw new Error('Keyframe value is outside allowed bounds');
  }
  const track = trackFor(project, layerId, property);
  const current = existingFrame(track, frame);
  if (current.value === value) return [];
  const updated = structuredClone(track);
  updated.keyframes.find(item => item.frame === frame)!.value = value;
  return [{ type: 'set-track', layerId, track: updated }];
}
export function deleteMotionKeyframe(
  project: MotionProject, layerId: string, property: MotionProperty, frame: number,
): MotionEdit[] {
  const track = trackFor(project, layerId, property);
  existingFrame(track, frame);
  if (track.keyframes.length > 1) {
    const next = structuredClone(track);
    next.keyframes = next.keyframes.filter(item => item.frame !== frame);
    return [{ type: 'set-track', layerId, track: next }];
  }
  // Tracks cannot contain zero keyframes. Remove the entire track transactionally.
  const composition = structuredClone(project.composition);
  const layer = composition.layers.find(item => item.id === layerId)!;
  layer.tracks = layer.tracks.filter(item => item.property !== property);
  return [{ type: 'replace-composition', composition }];
}
export function motionFrameFromPointer(clientX: number, left: number, width: number, durationFrames: number): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(left) || !Number.isFinite(width) || width <= 0) {
    throw new Error('Timeline track has no measurable width');
  }
  return Math.max(0, Math.min(durationFrames - 1, Math.round((clientX - left) / width * (durationFrames - 1))));
}
