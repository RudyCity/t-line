/**
 * Pure NLE clip manipulation operations for multi-track timeline editing.
 * Implements non-destructive split, trim, move with magnetic snapping, ripple delete,
 * and bidirectional synchronization with canonical StudioComposition.
 */

import type { StudioComposition } from './studioApi';
import type { StudioMultiTrack, StudioTrackClip } from './studioControlTypes';

/**
 * Split a clip at a given frame boundary into two contiguous clips.
 * Returns a new tracks array with the split clips.
 */
export function splitClipAtFrame(
  tracks: StudioMultiTrack[],
  trackId: string,
  clipId: string,
  splitFrame: number
): StudioMultiTrack[] {
  return tracks.map(track => {
    if (track.id !== trackId || track.locked) return track;

    const clipIndex = track.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return track;

    const clip = track.clips[clipIndex];
    const clipEnd = clip.startFrame + clip.durationFrames;

    // Split frame must fall strictly within the clip interior
    if (splitFrame <= clip.startFrame || splitFrame >= clipEnd) {
      return track;
    }

    const firstDuration = splitFrame - clip.startFrame;
    const secondDuration = clipEnd - splitFrame;

    const firstClip: StudioTrackClip = {
      ...clip,
      durationFrames: firstDuration,
      trimOutFrames: clip.trimInFrames + firstDuration,
    };

    const secondClip: StudioTrackClip = {
      ...clip,
      id: `${clip.id}-split-${Date.now()}`,
      startFrame: splitFrame,
      durationFrames: secondDuration,
      trimInFrames: clip.trimInFrames + firstDuration,
      trimOutFrames: clip.trimOutFrames,
    };

    const newClips = [...track.clips];
    newClips.splice(clipIndex, 1, firstClip, secondClip);

    return { ...track, clips: newClips };
  });
}

/**
 * Trim a clip's in-point or out-point.
 * Positive deltaIn shortens from head; positive deltaOut lengthens from tail.
 * Minimum clip length is 1 frame.
 */
export function trimClip(
  tracks: StudioMultiTrack[],
  trackId: string,
  clipId: string,
  deltaIn: number,
  deltaOut: number
): StudioMultiTrack[] {
  return tracks.map(track => {
    if (track.id !== trackId || track.locked) return track;

    const clipIndex = track.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return track;

    const clip = track.clips[clipIndex];
    let newStart = clip.startFrame + deltaIn;
    let newDuration = clip.durationFrames - deltaIn + deltaOut;
    let newTrimIn = clip.trimInFrames + deltaIn;
    let newTrimOut = clip.trimOutFrames + deltaOut;

    // Enforce constraints
    if (newStart < 0) {
      newStart = 0;
      newDuration = clip.durationFrames + deltaOut;
      newTrimIn = 0;
    }

    if (newDuration < 1) {
      newDuration = 1;
      newTrimOut = newTrimIn + 1;
    }

    const updatedClip: StudioTrackClip = {
      ...clip,
      startFrame: newStart,
      durationFrames: newDuration,
      trimInFrames: Math.max(0, newTrimIn),
      trimOutFrames: Math.max(1, newTrimOut),
    };

    const newClips = [...track.clips];
    newClips[clipIndex] = updatedClip;

    return { ...track, clips: newClips };
  });
}

export interface SnapResult {
  startFrame: number;
  snapped: boolean;
  snapTargetFrame?: number;
}

/**
 * Calculate magnetic snapping to clip edges or playhead across tracks.
 */
export function calculateSnap(
  candidateFrame: number,
  clipDuration: number,
  tracks: StudioMultiTrack[],
  playheadFrame?: number,
  tolerance = 8,
  excludeClipId?: string
): SnapResult {
  const snapPoints = new Set<number>();
  if (playheadFrame !== undefined && playheadFrame >= 0) {
    snapPoints.add(playheadFrame);
  }
  snapPoints.add(0);

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      snapPoints.add(clip.startFrame);
      snapPoints.add(clip.startFrame + clip.durationFrames);
    }
  }

  const candidateEnd = candidateFrame + clipDuration;

  let bestSnap = candidateFrame;
  let minDiff = tolerance + 1;
  let snapped = false;
  let target: number | undefined;

  for (const point of snapPoints) {
    // Snap clip head to point
    const headDiff = Math.abs(candidateFrame - point);
    if (headDiff <= tolerance && headDiff < minDiff) {
      minDiff = headDiff;
      bestSnap = point;
      snapped = true;
      target = point;
    }

    // Snap clip tail to point
    const tailDiff = Math.abs(candidateEnd - point);
    if (tailDiff <= tolerance && tailDiff < minDiff) {
      minDiff = tailDiff;
      bestSnap = point - clipDuration;
      snapped = true;
      target = point;
    }
  }

  return {
    startFrame: Math.max(0, bestSnap),
    snapped,
    snapTargetFrame: target,
  };
}

/**
 * Move a clip to a new start frame and optionally to a different track of matching kind.
 */
export function moveClip(
  tracks: StudioMultiTrack[],
  fromTrackId: string,
  toTrackId: string,
  clipId: string,
  newStartFrame: number,
  playheadFrame?: number,
  snap = true
): StudioMultiTrack[] {
  const sourceTrack = tracks.find(t => t.id === fromTrackId);
  const targetTrack = tracks.find(t => t.id === toTrackId);
  if (!sourceTrack || !targetTrack || sourceTrack.locked || targetTrack.locked) return tracks;
  if (sourceTrack.kind !== targetTrack.kind) return tracks; // Cannot move video clip to audio track

  const clip = sourceTrack.clips.find(c => c.id === clipId);
  if (!clip) return tracks;

  let finalStart = Math.max(0, newStartFrame);
  if (snap) {
    const snapRes = calculateSnap(finalStart, clip.durationFrames, tracks, playheadFrame, 8, clipId);
    finalStart = snapRes.startFrame;
  }

  const updatedClip: StudioTrackClip = {
    ...clip,
    trackId: toTrackId,
    startFrame: finalStart,
  };

  return tracks.map(track => {
    if (track.id === fromTrackId && fromTrackId === toTrackId) {
      return {
        ...track,
        clips: track.clips
          .map(c => (c.id === clipId ? updatedClip : c))
          .sort((a, b) => a.startFrame - b.startFrame),
      };
    }

    if (track.id === fromTrackId) {
      return {
        ...track,
        clips: track.clips.filter(c => c.id !== clipId),
      };
    }

    if (track.id === toTrackId) {
      return {
        ...track,
        clips: [...track.clips, updatedClip].sort((a, b) => a.startFrame - b.startFrame),
      };
    }

    return track;
  });
}

/**
 * Ripple delete: removes the clip and shifts all subsequent clips on the track backwards by clip duration.
 */
export function rippleDeleteClip(
  tracks: StudioMultiTrack[],
  trackId: string,
  clipId: string
): StudioMultiTrack[] {
  return tracks.map(track => {
    if (track.id !== trackId || track.locked) return track;

    const clipIndex = track.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return track;

    const deleted = track.clips[clipIndex];
    const shiftAmount = deleted.durationFrames;

    const remainingClips = track.clips
      .filter(c => c.id !== clipId)
      .map(c => {
        if (c.startFrame > deleted.startFrame) {
          return {
            ...c,
            startFrame: Math.max(0, c.startFrame - shiftAmount),
          };
        }
        return c;
      });

    return { ...track, clips: remainingClips };
  });
}

/**
 * Standard delete (lift): removes the clip leaving the timeline gap intact.
 */
export function deleteClip(
  tracks: StudioMultiTrack[],
  trackId: string,
  clipId: string
): StudioMultiTrack[] {
  return tracks.map(track => {
    if (track.id !== trackId || track.locked) return track;
    return {
      ...track,
      clips: track.clips.filter(c => c.id !== clipId),
    };
  });
}

/**
 * Synchronize the multi-track clip arrangement back to canonical StudioComposition.
 * Reconciles composition duration, audio tracks, and layer visibility/bounds.
 */
export function syncClipsToComposition(
  tracks: StudioMultiTrack[],
  currentComp: StudioComposition
): StudioComposition {
  const comp: StudioComposition = structuredClone(currentComp);

  // Compute maximum duration needed across all tracks
  let maxEndFrame = 1;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = clip.startFrame + clip.durationFrames;
      if (end > maxEndFrame) maxEndFrame = end;
    }
  }

  comp.durationFrames = Math.max(1, maxEndFrame);
  comp.tracks = structuredClone(tracks);

  // Reconcile audio tracks
  const audioTrack = tracks.find(t => t.kind === 'audio');
  if (audioTrack && audioTrack.clips.length > 0) {
    comp.audioTracks = audioTrack.clips.map(c => ({
      assetId: c.assetId || '',
      startFrame: c.startFrame,
      volume: c.volume ?? 1,
      role: c.name.toLowerCase().includes('voice') ? 'voiceover' : 'music',
    }));
  }

  return comp;
}
