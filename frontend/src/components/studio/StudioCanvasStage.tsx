import React, { useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Hand, Magnet } from 'lucide-react';
import type { StudioProject, StudioEdit, StudioLayer } from '../../services/studioApi';
import { StudioCanvas } from '../StudioCanvas';
import { frameLabel } from '../../services/studioScene';
import {
  zoomStudioViewport,
  panStudioViewport,
  DEFAULT_MOTION_VIEWPORT,
  type StudioViewport,
} from '../../services/studioViewport';

interface Props {
  project: StudioProject;
  activeProject: StudioProject;
  frame: number;
  setFrame: (frame: number) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  totalFrames: number;
  fps: number;
  viewport: StudioViewport;
  setViewport: React.Dispatch<React.SetStateAction<StudioViewport>>;
  panMode: boolean;
  setPanMode: React.Dispatch<React.SetStateAction<boolean>>;
  canvasSnapping: boolean;
  setCanvasSnapping: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLayer: string | null;
  onSelectLayer: (layerId: string | null) => void;
  imageUrls: Record<string, string>;
  isActive: boolean;
  busy: boolean;
  hasPreview: boolean;
  onApplyEdits: (edits: StudioEdit[], note: string) => void;
  onLayerContextMenu?: (event: React.MouseEvent, layer: StudioLayer) => void;
  onCanvasContextMenu?: (event: React.MouseEvent) => void;
}

const action = 'inline-flex items-center gap-1 rounded-md border border-[#2a2d3d] bg-[#161822] px-2 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-[#202330] hover:border-cyan-500/40 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-40 disabled:pointer-events-none';
const primaryAction = 'inline-flex items-center gap-1 rounded-md border border-cyan-500/50 bg-cyan-950/40 px-2 py-1 text-xs font-medium text-cyan-300 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400';

export function StudioCanvasStage({
  project,
  activeProject,
  frame,
  setFrame,
  playing,
  setPlaying,
  totalFrames,
  fps,
  viewport,
  setViewport,
  panMode,
  setPanMode,
  canvasSnapping,
  setCanvasSnapping,
  selectedLayer,
  onSelectLayer,
  imageUrls,
  isActive,
  busy,
  hasPreview,
  onApplyEdits,
  onLayerContextMenu,
  onCanvasContextMenu,
}: Props) {
  const panGesture = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  return (
    <div className="flex min-h-[320px] min-w-0 flex-1 flex-col bg-[#0b0c10] select-none">
      {/* Monitor Viewport Header */}
      <div className="flex items-center justify-between border-b border-[#222533] bg-[#0e1017] px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/20" />
          <span
            className="font-mono font-medium text-zinc-200"
            title="Drag to move · corner handle resizes rotated rectangles · upper handle rotates · arrows nudge · Alt+arrows rotate · Ctrl+arrows resize rectangles"
          >
            Monitor · {project.composition.width} × {project.composition.height}{hasPreview ? ' · PREVIEW (not saved)' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 normal-case tracking-normal text-xs text-zinc-400 hover:text-zinc-200">
            <input
              type="checkbox"
              aria-label="Snap canvas position to grid and center"
              checked={canvasSnapping}
              onChange={event => setCanvasSnapping(event.target.checked)}
              className="accent-cyan-400"
            />
            <Magnet size={11} className={canvasSnapping ? 'text-cyan-400' : 'text-zinc-500'} />
            <span>Snap 10px</span>
          </label>

          <div className="h-3 w-px bg-[#2a2d3d]" />

          <button
            type="button"
            className={action}
            aria-label="Zoom out Studio canvas"
            onClick={() => setViewport(previous => zoomStudioViewport(previous, previous.zoom / 1.25, { x: 0, y: 0 }, { left: -1, top: -1, width: 2, height: 2 }))}
            title="Zoom out"
          >
            −
          </button>
          <span aria-label="Studio canvas zoom" className="font-mono text-xs text-zinc-200 min-w-[36px] text-center">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button
            type="button"
            className={action}
            aria-label="Zoom in Studio canvas"
            onClick={() => setViewport(previous => zoomStudioViewport(previous, previous.zoom * 1.25, { x: 0, y: 0 }, { left: -1, top: -1, width: 2, height: 2 }))}
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={action}
            aria-label="Reset Studio canvas view"
            onClick={() => setViewport(DEFAULT_MOTION_VIEWPORT)}
            title="Fit to view"
          >
            Fit
          </button>
          <button
            type="button"
            className={panMode ? primaryAction : action}
            aria-label="Toggle Studio canvas pan mode"
            aria-pressed={panMode}
            onClick={() => setPanMode(v => !v)}
            title="Pan mode"
          >
            <Hand size={11} className={panMode ? 'text-cyan-400' : ''} />
            <span>Pan</span>
          </button>

          <div className="h-3 w-px bg-[#2a2d3d]" />

          <span className="font-mono text-[10px] text-zinc-400">{fps.toFixed(2)} fps</span>
        </div>
      </div>

      {/* Viewport Canvas Stage */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#07080c] p-4 md:p-8"
        data-testid="motion-viewport"
        onWheel={event => {
          if (!isActive) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setViewport(previous => zoomStudioViewport(
            previous,
            previous.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12),
            { x: event.clientX, y: event.clientY },
            rect
          ));
        }}
        onPointerDown={event => {
          if (!isActive || (event.button !== 1 && !(panMode && event.button === 0))) return;
          panGesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture?.(event.pointerId);
          event.stopPropagation();
          event.preventDefault();
        }}
        onPointerMove={event => {
          const pending = panGesture.current;
          if (!pending || pending.pointerId !== event.pointerId) return;
          setViewport(previous => panStudioViewport(previous, {
            x: event.clientX - pending.x,
            y: event.clientY - pending.y,
          }));
          panGesture.current = { pointerId: pending.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerUp={event => {
          if (panGesture.current?.pointerId !== event.pointerId) return;
          panGesture.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={() => { panGesture.current = null; }}
        onLostPointerCapture={() => { panGesture.current = null; }}
        onContextMenu={event => {
          event.preventDefault();
          onCanvasContextMenu?.(event);
        }}
      >
        <div
          className="w-full max-w-[1000px] shadow-2xl shadow-black/80 rounded border border-[#1f2230] transition-transform duration-75 overflow-hidden"
          data-testid="motion-canvas"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <StudioCanvas
            key={project.id + ':' + project.revision + (hasPreview ? ':preview' : '')}
            project={activeProject}
            frame={frame}
            assetUrls={imageUrls}
            selectedLayer={selectedLayer}
            isActive={isActive && !hasPreview}
            busy={busy || panMode || hasPreview}
            snapping={canvasSnapping}
            onSelectLayer={onSelectLayer}
            onStopPlayback={() => setPlaying(false)}
            onEdit={onApplyEdits}
            onLayerContextMenu={onLayerContextMenu}
            onCanvasContextMenu={onCanvasContextMenu}
          />
        </div>
      </div>

      {/* Integrated Transport Bar */}
      <div className="flex items-center gap-3 border-t border-[#222533] bg-[#0e1017] px-4 py-2.5 shadow-sm">
        {/* Step Prev Frame */}
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setFrame(Math.max(0, frame - 1));
          }}
          title="Step back 1 frame"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2d3d] bg-[#161822] text-zinc-300 hover:bg-[#202330] hover:text-white transition-colors"
        >
          <SkipBack size={12} />
        </button>

        {/* Circular Play/Pause Button */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-zinc-950 shadow-md shadow-cyan-400/25 hover:bg-cyan-300 active:scale-95 transition-all"
          aria-label={playing ? 'Pause playback' : 'Play scene'}
          onClick={() => setPlaying(!playing)}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} className="fill-zinc-950" /> : <Play size={14} className="fill-zinc-950 ml-0.5" />}
        </button>

        {/* Step Next Frame */}
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setFrame(Math.min(totalFrames - 1, frame + 1));
          }}
          title="Step forward 1 frame"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2d3d] bg-[#161822] text-zinc-300 hover:bg-[#202330] hover:text-white transition-colors"
        >
          <SkipForward size={12} />
        </button>

        {/* Scrubbing Slider */}
        <input
          aria-label="Current frame"
          type="range"
          className="min-w-0 flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-[#202330] rounded-lg"
          min={0}
          max={totalFrames - 1}
          step={1}
          value={frame}
          onChange={event => {
            setPlaying(false);
            setFrame(Number(event.target.value));
          }}
        />

        {/* Timecode & Frame Indicator */}
        <div className="flex items-center gap-1.5 whitespace-nowrap font-mono text-xs font-semibold text-zinc-200 bg-[#161822] px-2.5 py-1 rounded-md border border-[#2a2d3d]">
          <span className="text-cyan-400">{frameLabel(project, frame)}</span>
          <span className="text-zinc-500 text-[10px]">({frame}/{totalFrames})</span>
        </div>
      </div>
    </div>
  );
}
