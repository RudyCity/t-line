import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Magnet,
  Trash2,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
  Film,
  Music,
  Type,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { StudioComposition } from '../../services/studioApi';
import type { StudioMultiTrack, StudioTrackClip } from '../../services/studioControlTypes';
import { deriveClipsFromComposition } from '../../services/studioControlTypes';
import {
  splitClipAtFrame,
  rippleDeleteClip,
  deleteClip,
  syncClipsToComposition,
} from '../../services/studioClipEdits';

interface Props {
  workspacePath: string;
  projectId: string;
  composition: StudioComposition;
  currentFrame: number;
  fps: number;
  isPlaying: boolean;
  onSeek: (frame: number) => void;
  onTogglePlay: () => void;
  onCompositionChange?: (updated: StudioComposition) => void;
  onSelectLayer?: (layerId: string) => void;
}

export function StudioMultiTrackTimeline({
  workspacePath,
  projectId,
  composition,
  currentFrame,
  fps,
  isPlaying,
  onSeek,
  onTogglePlay,
  onCompositionChange,
  onSelectLayer,
}: Props) {
  // Derive initial tracks from composition
  const [tracks, setTracks] = useState<StudioMultiTrack[]>(() =>
    deriveClipsFromComposition(composition)
  );

  // Sync tracks whenever composition changes externally (e.g. agent edits or project reloads)
  useEffect(() => {
    setTracks(deriveClipsFromComposition(composition));
  }, [composition]);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(1); // pixels per frame multiplier (default 1 = ~2px/frame)
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const timelineRulerRef = useRef<HTMLDivElement>(null);

  const pixelsPerFrame = useMemo(() => Math.max(0.5, Math.min(8, 2 * zoom)), [zoom]);
  const totalDuration = composition.durationFrames || 180;
  const timelineWidth = Math.max(600, totalDuration * pixelsPerFrame);

  // Format frame to HH:MM:SS:FF or SS.ff
  const formatTimecode = (frame: number) => {
    const validFps = fps > 0 ? fps : 30;
    const totalSecs = Math.floor(frame / validFps);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const frames = frame % validFps;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  const handleSeekFromClientX = useCallback(
    (clientX: number) => {
      if (!timelineRulerRef.current) return;
      const rect = timelineRulerRef.current.getBoundingClientRect();
      const offsetX = Math.max(0, clientX - rect.left);
      const targetFrame = Math.min(
        totalDuration,
        Math.max(0, Math.round(offsetX / pixelsPerFrame))
      );
      onSeek(targetFrame);
    },
    [pixelsPerFrame, totalDuration, onSeek]
  );

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    setDraggingPlayhead(true);
    handleSeekFromClientX(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingPlayhead) {
        handleSeekFromClientX(e.clientX);
      }
    };
    const handleMouseUp = () => {
      if (draggingPlayhead) {
        setDraggingPlayhead(false);
      }
    };

    if (draggingPlayhead) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingPlayhead, handleSeekFromClientX]);

  // Split selected clip or clip under playhead
  const handleSplitAtPlayhead = () => {
    let targetTrack: StudioMultiTrack | undefined;
    let targetClip: StudioTrackClip | undefined;

    if (selectedClipId) {
      for (const t of tracks) {
        const c = t.clips.find(clip => clip.id === selectedClipId);
        if (c) {
          targetTrack = t;
          targetClip = c;
          break;
        }
      }
    }

    if (!targetClip) {
      for (const t of tracks) {
        const c = t.clips.find(
          clip => currentFrame > clip.startFrame && currentFrame < clip.startFrame + clip.durationFrames
        );
        if (c) {
          targetTrack = t;
          targetClip = c;
          break;
        }
      }
    }

    if (targetTrack && targetClip) {
      const updated = splitClipAtFrame(tracks, targetTrack.id, targetClip.id, currentFrame);
      setTracks(updated);
      if (onCompositionChange) {
        onCompositionChange(syncClipsToComposition(updated, composition));
      }
    }
  };

  // Ripple delete selected clip
  const handleRippleDelete = () => {
    if (!selectedClipId) return;
    for (const t of tracks) {
      if (t.clips.some(c => c.id === selectedClipId)) {
        const updated = rippleDeleteClip(tracks, t.id, selectedClipId);
        setTracks(updated);
        setSelectedClipId(null);
        if (onCompositionChange) {
          onCompositionChange(syncClipsToComposition(updated, composition));
        }
        break;
      }
    }
  };

  // Standard delete selected clip
  const handleDelete = () => {
    if (!selectedClipId) return;
    for (const t of tracks) {
      if (t.clips.some(c => c.id === selectedClipId)) {
        const updated = deleteClip(tracks, t.id, selectedClipId);
        setTracks(updated);
        setSelectedClipId(null);
        if (onCompositionChange) {
          onCompositionChange(syncClipsToComposition(updated, composition));
        }
        break;
      }
    }
  };

  // Toggle track mute or lock
  const toggleMute = (trackId: string) => {
    setTracks(prev =>
      prev.map(t => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  const toggleLock = (trackId: string) => {
    setTracks(prev =>
      prev.map(t => (t.id === trackId ? { ...t, locked: !t.locked } : t))
    );
  };

  // Time marks for ruler
  const rulerMarks = useMemo(() => {
    const marks: { frame: number; label: string; major: boolean }[] = [];
    const validFps = fps > 0 ? fps : 30;
    const intervalSec = zoom >= 2 ? 1 : zoom >= 0.8 ? 2 : 5;
    const frameStep = validFps * intervalSec;

    for (let f = 0; f <= totalDuration; f += frameStep) {
      const sec = Math.floor(f / validFps);
      marks.push({
        frame: f,
        label: `${sec}s`,
        major: true,
      });
    }
    return marks;
  }, [totalDuration, fps, zoom]);

  const getClipIcon = (kind: string) => {
    switch (kind) {
      case 'video':
        return <Film className="w-3 h-3 text-cyan-400 shrink-0" />;
      case 'audio':
        return <Music className="w-3 h-3 text-emerald-400 shrink-0" />;
      case 'text':
        return <Type className="w-3 h-3 text-amber-400 shrink-0" />;
      case 'image':
        return <ImageIcon className="w-3 h-3 text-fuchsia-400 shrink-0" />;
      default:
        return <Film className="w-3 h-3 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div
      className="flex h-full w-full flex-col bg-[var(--bg-main)] text-[var(--text-main)] border-t border-[var(--border-color)] select-none"
      role="region"
      aria-label="Multi-track timeline"
      data-workspace={workspacePath}
      data-project={projectId}
    >
      {/* NLE Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex h-6 w-6 items-center justify-center rounded bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)] text-[var(--text-main)] transition-colors"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentFrame - (fps > 0 ? fps : 30)))}
            aria-label="Step back 1s"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--surface-overlay-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.min(totalDuration, currentFrame + (fps > 0 ? fps : 30)))}
            aria-label="Step forward 1s"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--surface-overlay-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Timecode display */}
          <div className="ml-2 flex items-baseline gap-1 font-mono text-[11px] bg-[var(--bg-main)] px-2 py-0.5 rounded border border-[var(--border-color)]">
            <span className="text-cyan-400 font-semibold">{formatTimecode(currentFrame)}</span>
            <span className="text-[var(--text-muted)] text-[9px]">/ {formatTimecode(totalDuration)}</span>
          </div>
        </div>

        {/* Edit Action Tools */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSplitAtPlayhead}
            title="Split Clip at Playhead (S)"
            aria-label="Split clip at playhead"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)] text-[var(--text-main)] text-[10px] font-sans font-medium transition-colors"
          >
            <Scissors className="w-3 h-3 text-cyan-400" />
            <span>Split</span>
          </button>

          <button
            type="button"
            onClick={handleRippleDelete}
            disabled={!selectedClipId}
            title="Ripple Delete Selected Clip"
            aria-label="Ripple delete clip"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] hover:bg-red-950/40 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-300 text-[10px] font-sans font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
            <span>Ripple Del</span>
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!selectedClipId}
            title="Delete Selected Clip (Lift)"
            aria-label="Delete clip"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] hover:bg-red-950/40 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-300 text-[10px] font-sans font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <span>Lift Del</span>
          </button>

          <button
            type="button"
            onClick={() => setSnapEnabled(!snapEnabled)}
            aria-pressed={snapEnabled}
            title="Magnetic Snap"
            aria-label="Toggle magnetic snapping"
            className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
              snapEnabled
                ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)]'
            }`}
          >
            <Magnet className="w-3 h-3" />
          </button>

          {/* Zoom controls */}
          <div className="ml-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}
              aria-label="Zoom out"
              className="p-1 rounded hover:bg-[var(--surface-overlay-hover)] text-[var(--text-muted)]"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[9px] text-[var(--text-muted)] w-8 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(3, z + 0.2))}
              aria-label="Zoom in"
              className="p-1 rounded hover:bg-[var(--surface-overlay-hover)] text-[var(--text-muted)]"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Track List + Canvas Container */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Track Header Column */}
        <div className="w-36 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] flex flex-col">
          {/* Top spacer matching ruler height */}
          <div className="h-6 shrink-0 border-b border-[var(--border-color)] px-2 flex items-center text-[10px] text-[var(--text-muted)] font-mono">
            Tracks
          </div>

          {/* Track Headers */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {tracks.map(track => (
              <div
                key={track.id}
                className="h-14 border-b border-[var(--border-color)] px-2.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[11px] font-semibold text-[var(--text-main)] uppercase">
                    {track.name}
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] capitalize">
                    {track.kind}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleMute(track.id)}
                    aria-label={`Toggle mute ${track.name}`}
                    className={`p-1 rounded hover:bg-[var(--surface-overlay-hover)] ${
                      track.muted ? 'text-amber-400' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLock(track.id)}
                    aria-label={`Toggle lock ${track.name}`}
                    className={`p-1 rounded hover:bg-[var(--surface-overlay-hover)] ${
                      track.locked ? 'text-red-400' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Scrollable Timeline Tracks + Playhead Area */}
        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden custom-scrollbar relative">
          <div style={{ width: `${timelineWidth}px` }} className="relative h-full flex flex-col">
            {/* Timecode Ruler */}
            <div
              ref={timelineRulerRef}
              onMouseDown={handleRulerMouseDown}
              className="h-6 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-main)] cursor-pointer relative"
            >
              {rulerMarks.map(m => (
                <div
                  key={m.frame}
                  style={{ left: `${m.frame * pixelsPerFrame}px` }}
                  className="absolute top-0 bottom-0 border-l border-[var(--border-color)] pl-1 text-[9px] font-mono text-[var(--text-muted)] select-none pointer-events-none"
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Playhead Indicator Line */}
            <div
              style={{ left: `${currentFrame * pixelsPerFrame}px` }}
              className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
            >
              <div className="w-3 h-3 bg-cyan-400 rotate-45 -mt-1.5 shadow-sm" />
              <div className="w-px flex-1 bg-cyan-400 shadow-sm" />
            </div>

            {/* Track Lanes */}
            <div className="flex-1 flex flex-col">
              {tracks.map(track => (
                <div
                  key={track.id}
                  className={`h-14 border-b border-[var(--border-color)] relative ${
                    track.locked ? 'bg-black/20 opacity-70' : 'bg-[var(--bg-main)]'
                  }`}
                >
                  {track.clips.map(clip => {
                    const isSelected = clip.id === selectedClipId;
                    const left = clip.startFrame * pixelsPerFrame;
                    const width = Math.max(12, clip.durationFrames * pixelsPerFrame);

                    return (
                      <div
                        key={clip.id}
                        onClick={() => {
                          setSelectedClipId(clip.id);
                          if (clip.layerId && onSelectLayer) {
                            onSelectLayer(clip.layerId);
                          }
                        }}
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                        }}
                        className={`absolute top-1.5 bottom-1.5 rounded border px-2 py-1 flex items-center justify-between text-xs cursor-pointer transition-colors shadow-xs ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-950/60 ring-1 ring-cyan-400/50 text-white'
                            : clip.kind === 'audio'
                            ? 'border-emerald-800/80 bg-emerald-950/40 hover:border-emerald-700 text-emerald-100'
                            : 'border-slate-700 bg-slate-900/80 hover:border-slate-600 text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {getClipIcon(clip.kind)}
                          <span className="font-mono text-[10px] font-medium truncate">
                            {clip.name}
                          </span>
                        </div>

                        {width > 60 && (
                          <span className="font-mono text-[9px] text-[var(--text-muted)] shrink-0">
                            {Math.round(clip.durationFrames / (fps || 30))}s
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
