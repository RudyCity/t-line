import React, { useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import type { StudioProject, StudioEdit } from '../../services/studioApi';
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
}

const action = 'inline-flex items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';
const primaryAction = 'inline-flex items-center gap-1 rounded border border-[var(--color-primary)] bg-[var(--color-primary)]/20 px-2 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

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
}: Props) {
  const panGesture = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  return (
    <div className="flex min-h-[320px] min-w-0 flex-1 flex-col bg-[var(--bg-main)]">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        <span
          className="font-medium"
          title="Drag to move · corner handle resizes rotated rectangles · upper handle rotates · arrows nudge · Alt+arrows rotate · Ctrl+arrows resize rectangles"
        >
          Composition · {project.composition.width} × {project.composition.height}{hasPreview ? ' · PREVIEW (not saved)' : ''}
        </span>

        <div className="flex items-center gap-2.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 normal-case tracking-normal text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <input
              type="checkbox"
              aria-label="Snap canvas position to grid and center"
              checked={canvasSnapping}
              onChange={event => setCanvasSnapping(event.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Snap 10px
          </label>

          <div className="h-3 w-px bg-[var(--border-color)]" />

          <button
            type="button"
            className={action}
            aria-label="Zoom out Studio canvas"
            onClick={() => setViewport(previous => zoomStudioViewport(previous, previous.zoom / 1.25, { x: 0, y: 0 }, { left: -1, top: -1, width: 2, height: 2 }))}
            title="Zoom out"
          >
            −
          </button>
          <span aria-label="Studio canvas zoom" className="font-mono text-xs text-[var(--text-main)] min-w-[36px] text-center">
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
            Pan
          </button>

          <div className="h-3 w-px bg-[var(--border-color)]" />

          <span className="font-mono text-[10px] text-[var(--text-muted)]">{fps.toFixed(2)} fps</span>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#0a0d14] p-4 md:p-8"
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
      >
        <div
          className="w-full max-w-[1000px] shadow-2xl transition-transform duration-75"
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
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-2.5 shadow-sm">
        <button
          className={action + ' px-3 py-1.5'}
          aria-label={playing ? 'Pause playback' : 'Play scene'}
          onClick={() => setPlaying(!playing)}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} className="text-amber-400" /> : <Play size={14} className="text-[var(--color-primary)]" />}
        </button>

        <input
          aria-label="Current frame"
          type="range"
          className="min-w-0 flex-1 accent-[var(--color-primary)] cursor-pointer"
          min={0}
          max={totalFrames - 1}
          step={1}
          value={frame}
          onChange={event => {
            setPlaying(false);
            setFrame(Number(event.target.value));
          }}
        />

        <span className="whitespace-nowrap font-mono text-xs font-semibold text-[var(--text-main)] bg-[var(--bg-card)] px-2.5 py-1 rounded border border-[var(--border-color)]">
          {frameLabel(project, frame)}
        </span>
      </div>
    </div>
  );
}
