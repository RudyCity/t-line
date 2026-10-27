/**
 * Typed contracts for desktop Studio control, agent intent, receipts, and multi-track NLE.
 * SuperAgent Core remains the single source of truth for project state and revisions.
 */

import type { StudioComposition, StudioEdit } from './studioApi';

export type StudioControlAction =
  | { type: 'focus_studio'; workspacePath: string; projectId?: string }
  | { type: 'open_project'; workspacePath: string; projectId: string }
  | { type: 'select_clip'; workspacePath: string; projectId: string; clipId?: string; layerId?: string }
  | { type: 'seek_timecode'; workspacePath: string; projectId: string; timeSeconds?: number; frame?: number }
  | { type: 'select_panel'; workspacePath: string; panel: 'media' | 'inspector' | 'timeline' | 'effects' | 'audio' };

export interface StudioEditIntent {
  intentId: string;
  workspacePath: string;
  projectId: string;
  expectedRevision: number;
  description: string;
  destructive: boolean;
  requiresApproval: boolean;
  operations: StudioEdit[];
  metadata?: Record<string, unknown>;
}

export interface StudioOperationReceipt {
  operationId: string;
  timestamp: string;
  actor: 'assistant' | 'human';
  projectId: string;
  projectName: string;
  revisionBefore: number;
  revisionAfter: number;
  summary: string;
  affectedEntities: {
    tracks?: string[];
    clips?: string[];
    layers?: string[];
  };
  jobId?: string;
  reversible: boolean;
}

export type StudioProjectEventType =
  | 'project_revision_changed'
  | 'media_indexed'
  | 'clip_modified'
  | 'render_progress'
  | 'render_completed'
  | 'operation_error';

export interface StudioProjectEvent {
  sequenceId: number;
  timestamp: string;
  workspacePath: string;
  projectId: string;
  type: StudioProjectEventType;
  payload: Record<string, unknown>;
}

/** Multi-track clip representation for the timeline NLE */
export interface StudioTrackClip {
  id: string;
  trackId: string;
  layerId: string;
  assetId?: string;
  kind: 'video' | 'audio' | 'text' | 'image' | 'graphic';
  name: string;
  startFrame: number;
  durationFrames: number;
  trimInFrames: number;
  trimOutFrames: number;
  volume?: number;
  opacity?: number;
  speed?: number;
}

export interface StudioMultiTrack {
  id: string;
  name: string;
  kind: 'video' | 'audio';
  index: number;
  muted: boolean;
  locked: boolean;
  clips: StudioTrackClip[];
}

export interface StudioClipNleComposition {
  version: 2;
  tracks: StudioMultiTrack[];
}

/** Helper to derive clip tracks from a standard StudioComposition */
export function deriveClipsFromComposition(comp: StudioComposition): StudioMultiTrack[] {
  if (comp.tracks && Array.isArray(comp.tracks) && comp.tracks.length > 0) {
    return structuredClone(comp.tracks);
  }

  const videoTrack: StudioMultiTrack = {
    id: 'track-v1',
    name: 'Video 1',
    kind: 'video',
    index: 0,
    muted: false,
    locked: false,
    clips: [],
  };

  const audioTrack: StudioMultiTrack = {
    id: 'track-a1',
    name: 'Audio 1',
    kind: 'audio',
    index: 1,
    muted: false,
    locked: false,
    clips: [],
  };

  // Convert composition layers to video track clips
  comp.layers.forEach((layer, idx) => {
    const startFrame = 0;
    const duration = comp.durationFrames;
    videoTrack.clips.push({
      id: `clip-layer-${layer.id}`,
      trackId: videoTrack.id,
      layerId: layer.id,
      assetId: layer.kind === 'image' || layer.kind === 'video' ? (layer as any).assetId : undefined,
      kind: layer.kind === 'text' ? 'text' : layer.kind === 'image' ? 'image' : layer.kind === 'video' ? 'video' : 'graphic',
      name: layer.kind === 'text' ? (layer as any).text.slice(0, 20) || `Text ${idx + 1}` : `${layer.kind} ${idx + 1}`,
      startFrame,
      durationFrames: duration,
      trimInFrames: 0,
      trimOutFrames: duration,
      opacity: layer.opacity ?? 1,
    });
  });

  // Convert audio tracks to audio track clips
  const audioSources = comp.audioTracks ?? (comp.audio ? [comp.audio] : []);
  audioSources.forEach((audio, idx) => {
    audioTrack.clips.push({
      id: `clip-audio-${audio.assetId}-${idx}`,
      trackId: audioTrack.id,
      layerId: `audio-${audio.assetId}`,
      assetId: audio.assetId,
      kind: 'audio',
      name: audio.role === 'voiceover' ? 'Voiceover' : `Music ${idx + 1}`,
      startFrame: audio.startFrame ?? 0,
      durationFrames: Math.max(1, comp.durationFrames - (audio.startFrame ?? 0)),
      trimInFrames: 0,
      trimOutFrames: Math.max(1, comp.durationFrames - (audio.startFrame ?? 0)),
      volume: audio.volume ?? 1,
    });
  });

  return [videoTrack, audioTrack];
}
