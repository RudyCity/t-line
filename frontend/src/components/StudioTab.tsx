import { useEffect, useState, useRef } from 'react';
import { STUDIO_DISPLAY_NAME } from '../services/studioBranding';
import { useStudioState } from './studio/useStudioState';
import { useStudioLayoutResize } from './studio/useStudioLayoutResize';
import { StudioTopBar } from './studio/StudioTopBar';
import { StudioInspectorSection } from './studio/StudioInspectorSection';
import { StudioCanvasStage } from './studio/StudioCanvasStage';
import { StudioRenderFooter } from './studio/StudioRenderFooter';
import { StudioPresetPanel } from './StudioPresetPanel';
import { StudioEffectLibrary } from './StudioEffectLibrary';
import { StudioEffectStackPanel } from './StudioEffectStackPanel';
import { StudioRecoveryPanel } from './StudioRecoveryPanel';
import { StudioBrandKitPanel } from './StudioBrandKitPanel';
import { StudioTemplatePanel } from './StudioTemplatePanel';
import { StudioBatchVariantsPanel } from './StudioBatchVariantsPanel';
import { StudioBeatSyncPanel } from './StudioBeatSyncPanel';
import { StudioStoryboardPanel } from './StudioStoryboardPanel';
import { StudioParticlesPanel } from './StudioParticlesPanel';
import { StudioTypographyPanel } from './StudioTypographyPanel';
import { StudioTimeline } from './StudioTimeline';
import { StudioMultiTrackTimeline } from './studio/StudioMultiTrackTimeline';
import { StudioMediaBin } from './studio/StudioMediaBin';
import { StudioAudioPanel } from './StudioAudioPanel';
import { StudioInteractionPanel } from './StudioInteractionPanel';
import { StudioVideoToCodePanel } from './StudioVideoToCodePanel';
import { StudioCodeToVideoPanel } from './StudioCodeToVideoPanel';
import { studioApi, type StudioLayer, type StudioProperty } from '../services/studioApi';
import { studioControlChannel } from '../services/studioControlChannel';
import type { StudioTrackClip } from '../services/studioControlTypes';
import { DEFAULT_MOTION_VIEWPORT } from '../services/studioViewport';
import { StudioContextMenu, type StudioMenuItem } from './studio/StudioContextMenu';
import {
  AlertCircle,
  CheckCircle2,
  Film,
  Loader2,
  Plus,
  X,
  ChevronRight,
  FolderOpen,
  Type,
  Music,
  Sparkles,
  LayoutTemplate,
  Wand2,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  Copy,
  Trash2,
  Scissors,
  Play,
  Pause,
  Square,
  Image as ImageIcon,
  Maximize2,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Crosshair,
} from 'lucide-react';

interface Props {
  workspacePath: string;
  isActive: boolean;
}

export type StudioRailTab = 'all' | 'media' | 'text' | 'audio' | 'effects' | 'templates' | 'ai';

const control = 'rounded-md border border-[#2a2d3d] bg-[#161822] px-2.5 py-1.5 text-xs text-zinc-100 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400';
const action = 'inline-flex items-center gap-1.5 rounded-md border border-[#2a2d3d] bg-[#1a1d28] px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-[#232736] hover:border-cyan-500/40 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-40 disabled:pointer-events-none';

export function StudioTab({ workspacePath, isActive }: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const layout = useStudioLayoutResize(containerRef);
  const s = useStudioState(workspacePath, isActive);
  const [selectedTimelineClipId, setSelectedTimelineClipId] = useState<string | null>(null);
  const [activeRailTab, setActiveRailTab] = useState<StudioRailTab>('all');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    title?: string;
    items: StudioMenuItem[];
  } | null>(null);

  // Context Menu Handlers across all Studio areas
  const handleLayerContextMenu = (e: React.MouseEvent, layer: StudioLayer) => {
    e.preventDefault();
    e.stopPropagation();
    s.setSelectedLayer(layer.id);

    const label = layer.kind === 'text' ? layer.text || layer.id : layer.id;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: `Layer: ${label}`,
      items: [
        {
          id: 'duplicate',
          label: 'Duplicate Layer',
          icon: <Copy size={13} />,
          shortcut: 'Ctrl+D',
          onClick: () => s.duplicateLayer(layer.id),
        },
        {
          id: 'center',
          label: 'Center on Stage',
          icon: <Crosshair size={13} />,
          onClick: () => s.centerLayer(layer.id),
        },
        {
          id: 'reset-transform',
          label: 'Reset Transform (0°)',
          icon: <RotateCcw size={13} />,
          onClick: () => s.resetLayerTransform(layer.id),
        },
        {
          id: 'bring-front',
          label: 'Bring to Front',
          icon: <ChevronsUp size={13} />,
          dividerBefore: true,
          onClick: () => s.moveLayerToExtreme('front', layer.id),
        },
        {
          id: 'send-back',
          label: 'Send to Back',
          icon: <ChevronsDown size={13} />,
          onClick: () => s.moveLayerToExtreme('back', layer.id),
        },
        {
          id: 'move-up',
          label: 'Move Up',
          icon: <ArrowUp size={13} />,
          onClick: () => s.reorderLayer(1),
        },
        {
          id: 'move-down',
          label: 'Move Down',
          icon: <ArrowDown size={13} />,
          onClick: () => s.reorderLayer(-1),
        },
        {
          id: 'delete',
          label: 'Delete Layer',
          icon: <Trash2 size={13} />,
          shortcut: 'Del',
          danger: true,
          dividerBefore: true,
          onClick: () => s.removeSelectedLayer(layer.id),
        },
      ],
    });
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: 'Canvas Stage',
      items: [
        {
          id: 'add-text',
          label: 'Add Text Layer',
          icon: <Type size={13} />,
          onClick: () => s.insertLayer('text'),
        },
        {
          id: 'add-rect',
          label: 'Add Rectangle Layer',
          icon: <Square size={13} />,
          onClick: () => s.insertLayer('rect'),
        },
        {
          id: 'add-image',
          label: 'Import Image Layer',
          icon: <ImageIcon size={13} />,
          onClick: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png,image/jpeg,image/webp';
            input.onchange = ev => {
              const file = (ev.target as HTMLInputElement).files?.[0];
              if (file) s.importImage(file);
            };
            input.click();
          },
        },
        {
          id: 'toggle-play',
          label: s.playing ? 'Pause Playback' : 'Play Video',
          icon: s.playing ? <Pause size={13} /> : <Play size={13} />,
          shortcut: 'Space',
          dividerBefore: true,
          onClick: () => s.setPlaying(!s.playing),
        },
        {
          id: 'fit-viewport',
          label: 'Reset Zoom (100%)',
          icon: <Maximize2 size={13} />,
          onClick: () => s.setViewport(DEFAULT_MOTION_VIEWPORT),
        },
      ],
    });
  };

  const handleMediaContextMenu = (e: React.MouseEvent, item: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: `Media: ${item.name}`,
      items: [
        {
          id: 'add-to-canvas',
          label: 'Insert into Canvas',
          icon: <Plus size={13} />,
          onClick: () => {
            if (item.layerId) {
              s.setSelectedLayer(item.layerId);
            } else if (item.kind === 'text') {
              s.insertLayer('text');
            } else if (item.kind === 'image') {
              s.insertLayer('rect');
            }
          },
        },
        {
          id: 'select-layer',
          label: 'Select Layer in Scene',
          icon: <Crosshair size={13} />,
          disabled: !item.layerId,
          onClick: () => {
            if (item.layerId) s.setSelectedLayer(item.layerId);
          },
        },
        {
          id: 'copy-name',
          label: 'Copy Asset Name',
          icon: <Copy size={13} />,
          dividerBefore: true,
          onClick: () => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              void navigator.clipboard.writeText(item.name);
            }
          },
        },
      ],
    });
  };

  const handlePropertyContextMenu = (
    e: React.MouseEvent,
    property: StudioProperty,
    value: number | string
  ) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: `Property: ${property}`,
      items: [
        {
          id: 'keyframe-prop',
          label: `Keyframe ${property} at frame ${s.frame}`,
          icon: <Plus size={13} />,
          onClick: () => s.keyframe(),
        },
        {
          id: 'copy-val',
          label: `Copy Value (${value})`,
          icon: <Copy size={13} />,
          onClick: () => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              void navigator.clipboard.writeText(String(value));
            }
          },
        },
        {
          id: 'reset-prop',
          label: `Reset to Default`,
          icon: <RotateCcw size={13} />,
          dividerBefore: true,
          onClick: () => {
            const defaults: Record<string, string> = {
              x: '100',
              y: '100',
              opacity: '1',
              rotation: '0',
              scale: '1',
              scaleX: '1',
              scaleY: '1',
            };
            if (defaults[property]) {
              s.setPropertyDraft({ field: property, value: defaults[property] });
              s.saveProperty();
            }
          },
        },
      ],
    });
  };

  const handleClipContextMenu = (
    e: React.MouseEvent,
    clip: StudioTrackClip,
    trackId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTimelineClipId(clip.id);
    if (clip.layerId) {
      s.setSelectedLayer(clip.layerId);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: `Clip: ${clip.name}`,
      items: [
        {
          id: 'split-clip',
          label: `Split at Frame ${s.frame}`,
          icon: <Scissors size={13} />,
          shortcut: 'Ctrl+B',
          disabled:
            s.frame <= clip.startFrame ||
            s.frame >= clip.startFrame + clip.durationFrames,
          onClick: () => {
            s.applyEditorEdits(
              [
                {
                  type: 'split-clip',
                  trackId,
                  clipId: clip.id,
                  splitFrame: s.frame,
                },
              ],
              `Split clip ${clip.id} at frame ${s.frame}`
            );
          },
        },
        {
          id: 'delete-clip',
          label: 'Delete Clip',
          icon: <Trash2 size={13} />,
          shortcut: 'Del',
          danger: true,
          onClick: () => {
            s.applyEditorEdits(
              [{ type: 'delete-clip', trackId, clipId: clip.id }],
              `Delete clip ${clip.id}`
            );
          },
        },
        {
          id: 'ripple-delete',
          label: 'Ripple Delete',
          icon: <Trash2 size={13} />,
          shortcut: 'Shift+Del',
          danger: true,
          onClick: () => {
            s.applyEditorEdits(
              [{ type: 'delete-clip', trackId, clipId: clip.id, ripple: true }],
              `Ripple delete clip ${clip.id}`
            );
          },
        },
      ],
    });
  };

  const handleTimelineContextMenu = (e: React.MouseEvent, frameAtMouse: number) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: `Timeline (Frame ${frameAtMouse})`,
      items: [
        {
          id: 'seek-here',
          label: `Seek Playhead to Frame ${frameAtMouse}`,
          icon: <Crosshair size={13} />,
          onClick: () => {
            s.setPlaying(false);
            s.setFrame(frameAtMouse);
          },
        },
        {
          id: 'toggle-play',
          label: s.playing ? 'Pause Playback' : 'Play Video',
          icon: s.playing ? <Pause size={13} /> : <Play size={13} />,
          shortcut: 'Space',
          dividerBefore: true,
          onClick: () => s.setPlaying(!s.playing),
        },
        {
          id: 'go-to-start',
          label: 'Jump to Start (Frame 0)',
          icon: <RotateCcw size={13} />,
          onClick: () => {
            s.setPlaying(false);
            s.setFrame(0);
          },
        },
      ],
    });
  };

  // Wire up desktop Studio control channel for assistant coordination
  useEffect(() => {
    return studioControlChannel.onAction(act => {
      if (act.workspacePath !== workspacePath) return;
      if (act.type === 'open_project') {
        s.setSelectedId(act.projectId);
      } else if (act.type === 'seek_timecode') {
        if (act.projectId && act.projectId !== 'active' && act.projectId !== s.project?.id) {
          s.setSelectedId(act.projectId);
        }
        if (act.frame !== undefined) {
          s.setPlaying(false);
          s.setFrame(act.frame);
        } else if (act.timeSeconds !== undefined && s.fps > 0) {
          s.setPlaying(false);
          s.setFrame(Math.round(act.timeSeconds * s.fps));
        }
      } else if (act.type === 'select_clip') {
        if (act.projectId && act.projectId !== 'active' && act.projectId !== s.project?.id) {
          s.setSelectedId(act.projectId);
        }
        if (act.clipId) {
          setSelectedTimelineClipId(act.clipId);
        }
        if (act.layerId) {
          s.setSelectedLayer(act.layerId);
        }
      }
    }, { replayRecent: true });
  }, [workspacePath, s.fps, s.project?.id]);

  // Broadcast project revision updates to desktop channel
  useEffect(() => {
    if (s.project) {
      studioControlChannel.emitEvent(workspacePath, s.project.id, 'project_revision_changed', {
        revision: s.project.revision,
        projectName: s.project.name,
      });
    }
  }, [workspacePath, s.project?.id, s.project?.revision]);

  if (!workspacePath) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500 bg-[#0a0c10]">
        Choose a local workspace to open {STUDIO_DISPLAY_NAME}.
      </div>
    );
  }

  const railTabs: { id: StudioRailTab; label: string; icon: any }[] = [
    { id: 'all', label: 'All', icon: Layers },
    { id: 'media', label: 'Media', icon: FolderOpen },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'effects', label: 'Effects', icon: Sparkles },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'ai', label: 'AI Suite', icon: Wand2 },
  ];

  return (
    <section
      ref={containerRef}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0a0c10] text-zinc-100 font-sans select-none"
      aria-label={STUDIO_DISPLAY_NAME}
    >
      <StudioTopBar
        workspacePath={workspacePath}
        projects={s.projects}
        selectedId={s.selectedId}
        onSelectProject={s.setSelectedId}
        project={s.project}
        supervisor={s.supervisor}
        scheduler={s.scheduler}
        queueRecovery={s.queueRecovery}
        storage={s.storage}
        busy={s.busy}
        onRefresh={() =>
          void s.operation(async () => {
            const [_, latestJobs, latestScheduler, latestStorage, latestRecovery, latestSupervisor] = await Promise.all([
              s.refreshProjects(),
              studioApi.jobs(workspacePath),
              studioApi.scheduler(workspacePath).catch(() => null),
              studioApi.storage(workspacePath).catch(() => null),
              studioApi.queueRecovery(workspacePath).catch(() => null),
              studioApi.supervisor(workspacePath).catch(() => null),
            ]);
            s.setJobs(latestJobs);
            if (latestScheduler) s.scheduler;
            if (latestStorage) s.storage;
            if (latestRecovery) s.queueRecovery;
            if (latestSupervisor) s.supervisor;
            if (s.selectedId) s.setProject(await studioApi.inspect(workspacePath, s.selectedId));
          })
        }
        creating={s.creating}
        onToggleCreating={() => s.setCreating(v => !v)}
        undoDisabled={!s.project || s.busy || s.undoStack.length === 0}
        redoDisabled={!s.project || s.busy || s.redoStack.length === 0}
        onUndo={() => s.restoreHistory('undo')}
        onRedo={() => s.restoreHistory('redo')}
        renderWidth={s.renderWidth}
        onChangeRenderWidth={s.setRenderWidth}
        supervisedRender={s.supervisedRender}
        onToggleSupervisedRender={s.setSupervisedRender}
        onRender={s.render}
        projectName={s.projectName}
        onChangeProjectName={s.setProjectName}
        onCreateProject={s.createProject}
        onCancelCreating={() => s.setCreating(false)}
        layoutPreset={layout.currentPreset}
        onLayoutPreset={layout.applyPreset}
      />

      {(s.error || s.success) && (
        <div
          role={s.error ? 'alert' : 'status'}
          className={
            'flex items-center gap-2 border-b px-4 py-2 text-xs font-medium transition-all ' +
            (s.error ? 'border-red-800 bg-red-950/60 text-red-300' : 'border-teal-800 bg-teal-950/50 text-teal-300')
          }
        >
          {s.error ? <AlertCircle size={14} className="shrink-0 text-red-400" /> : <CheckCircle2 size={14} className="shrink-0 text-teal-400" />}
          <span className="min-w-0 flex-1 break-words">{s.error || s.success}</span>
          <button
            aria-label="Dismiss notice"
            className="rounded p-0.5 hover:bg-white/10"
            onClick={() => {
              s.setError('');
              s.setSuccess('');
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Tools & Reconstruct Drawers */}
      {(s.storyboardAvailable || s.multiVideoAvailable) && (
        <div className="border-b border-[#222533] bg-[#0d0f16] px-4 py-1.5 text-xs space-y-1">
          {s.storyboardAvailable && (
            <StudioStoryboardPanel
              workspacePath={workspacePath}
              busy={s.busy}
              renderWidth={s.renderWidth}
              onCreated={result => {
                s.setProjects(prev => [
                  { id: result.project.id, name: result.project.name, revision: result.project.revision },
                  ...prev.filter(item => item.id !== result.project.id),
                ]);
                s.setSelectedId(result.project.id);
                s.setProject(result.project);
                s.setSelectedLayer(result.project.composition.layers.find(item => item.kind === 'text')?.id ?? null);
                s.setFrame(0);
                s.setUndoStack([]);
                s.setRedoStack([]);
                s.setJobs(prev => [result.job, ...prev.filter(item => item.id !== result.job.id)]);
                s.setActiveJobId(result.job.id);
                s.setQuality(result.quality ?? null);
                s.setSuccess(
                  result.job.status === 'failed' ? 'Approved storyboard saved, but MP4 render failed to start' : 'Approved storyboard saved · MP4 rendering queued'
                );
              }}
            />
          )}

          {s.multiVideoAvailable && (
            <details className="py-0.5">
              <summary className="cursor-pointer font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5">
                <Film size={12} className="text-cyan-400" />
                <span>Video → Editable Studio Code (Experimental shapes/OCR)</span>
              </summary>
              <div className="mt-2 pt-2 border-t border-[#222533]">
                <StudioVideoToCodePanel
                  key={workspacePath}
                  workspacePath={workspacePath}
                  ocrAvailable={s.textOcrAvailable}
                  ocrTimelineAvailable={s.textOcrTimelineAvailable}
                  onUpdated={(next, layerId, at) => {
                    if (s.selectedId === next.id && s.project && s.project.revision === next.revision - 1)
                      s.setUndoStack(prev => [...prev.slice(-29), structuredClone(s.project!.composition)]);
                    else s.setUndoStack([]);
                    s.setRedoStack([]);
                    s.setProject(next);
                    s.setSelectedId(next.id);
                    s.setSelectedLayer(layerId);
                    s.setFrame(at);
                    s.setProjects(prev => prev.map(item => (item.id === next.id ? { id: next.id, name: next.name, revision: next.revision } : item)));
                    s.setSuccess('Tracked layer correction saved at frame ' + at);
                  }}
                  onCreated={result => {
                    s.setProjects(prev => [
                      {
                        id: result.projectId,
                        name: 'Reconstructed video shapes',
                        revision: result.revision,
                      },
                      ...prev.filter(item => item.id !== result.projectId),
                    ]);
                    s.setSelectedId(result.projectId);
                    s.setSuccess(
                      result.status === 'experimental-ocr'
                        ? 'Video OCR extracted ' + result.lines.length + ' editable text layers'
                        : result.status === 'experimental-ocr-timeline'
                        ? 'Video timeline reconstructed into ' + result.captions.length + ' editable captions'
                        : 'Video reconstructed into ' + result.objects.length + ' editable Studio layers'
                    );
                  }}
                />
              </div>
            </details>
          )}
        </div>
      )}

      {!s.project ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left Column: Project Browser & Creator */}
          <div className="flex min-h-0 flex-col border-b border-[#222533] bg-[#0e1017] lg:border-b-0 lg:border-r overflow-y-auto p-3 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#222533]">
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
                Studio Projects
              </span>
              <button
                type="button"
                onClick={() => s.setCreating(true)}
                disabled={s.busy}
                className="inline-flex items-center gap-1 rounded-md bg-cyan-500 px-2.5 py-1 text-xs font-bold text-zinc-950 shadow-sm hover:bg-cyan-400 disabled:opacity-50 transition-all"
              >
                <Plus size={12} />
                <span>New Project</span>
              </button>
            </div>

            {s.projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#2a2d3d] p-5 text-center text-xs text-zinc-400 space-y-2 bg-[#12141e]">
                <p>No Studio projects found in this workspace.</p>
                <p className="text-[11px] text-zinc-500">Click "New Project" above or ask the Assistant in chat to create one.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {s.projects.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => s.setSelectedId(p.id)}
                    className="w-full text-left rounded-lg border border-[#222533] bg-[#141620] hover:bg-[#1a1e2b] hover:border-cyan-500/40 p-2.5 transition-all group flex items-center justify-between shadow-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-zinc-200 truncate group-hover:text-cyan-400">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {p.id} • rev {p.revision}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-zinc-500 group-hover:text-cyan-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center & Bottom: Video Monitor Stage + Timeline Standby */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#07080c]">
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 relative">
              <div className="w-full max-w-2xl aspect-video rounded-2xl border border-[#222533] bg-[#10121a] shadow-2xl shadow-cyan-950/20 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-950/40 shadow-lg text-cyan-400 mb-3">
                  <Film size={26} />
                </div>
                <h3 className="text-sm font-bold tracking-wide text-zinc-100">
                  {s.projects.length ? 'Choose a scene to edit' : 'Your motion workspace is empty'}
                </h3>
                <p className="max-w-md mt-1.5 text-xs text-zinc-400 leading-relaxed">
                  Create a project to edit built-in text and rectangle layers, animate keyframes, and render a local MP4 preview.
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => s.setCreating(true)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-teal-400 to-cyan-400 px-3.5 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-cyan-500/20 hover:brightness-110 active:scale-95 transition-all"
                  >
                    <Plus size={12} className="stroke-[2.5]" /> Create Blank Scene
                  </button>
                </div>

                {s.busy && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-medium text-cyan-400">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Generating motion scene…</span>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Standby Dock */}
            <div className="border-t border-[#222533] bg-[#0e1017] p-3 text-xs text-zinc-400 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="flex h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/20" />
                <span className="text-zinc-300">Timeline Standby · Tracks and keyframes will populate upon scene creation</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500">00:00:00 / 00:00:00</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main Workstation: NLE Workstation Layout (Left Rail + Context Drawer + Center Monitor + Right Inspector) */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* 1. Slim Left Activity Rail (56px) */}
            <aside className="w-14 shrink-0 flex flex-col items-center py-2.5 border-r border-[#222533] bg-[#0c0d13] z-10 gap-1 select-none">
              <div className="flex flex-col items-center gap-1.5 w-full px-1 flex-1">
                {railTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeRailTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveRailTab(prev => (prev === tab.id ? 'all' : tab.id));
                        if (!drawerOpen) setDrawerOpen(true);
                      }}
                      className={`flex flex-col items-center justify-center w-full py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-cyan-950/60 text-cyan-300 font-semibold shadow-xs border border-cyan-500/40'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161822]'
                      }`}
                      title={tab.label}
                    >
                      <Icon size={18} className={isActive ? 'text-cyan-400' : 'text-zinc-400'} />
                      <span className="text-[9px] mt-1 font-mono tracking-tight">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Drawer Collapse / Expand Button */}
              <button
                type="button"
                onClick={() => setDrawerOpen(v => !v)}
                className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-[#161822] rounded-lg transition-colors"
                title={drawerOpen ? 'Collapse Drawer' : 'Expand Drawer'}
                aria-label={drawerOpen ? 'Collapse Drawer' : 'Expand Drawer'}
              >
                {drawerOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </button>
            </aside>

            {/* 2. Contextual Resource Drawer */}
            <div
              className={`studio-drawer-panel transition-all duration-75 border-r border-[#222533] bg-[#0e1017] flex flex-col min-h-0 overflow-hidden ${
                drawerOpen ? 'shrink-0' : 'w-0 border-r-0'
              }`}
              style={{ width: drawerOpen ? `${layout.drawerWidth}px` : 0 }}
            >
              {/* Drawer Top Header */}
              <div className="h-9 shrink-0 px-3.5 border-b border-[#222533] bg-[#11131c] flex items-center justify-between text-xs font-bold uppercase tracking-wider font-mono text-zinc-200">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 ring-2 ring-cyan-400/20" />
                  {railTabs.find(t => t.id === activeRailTab)?.label}
                </span>
                <span className="text-[10px] text-zinc-500 font-normal lowercase font-mono">
                  {activeRailTab === 'all' ? 'all suites' : 'suite'}
                </span>
              </div>

              {/* Drawer Body with Category Panels (All kept in DOM for full accessibility & test coverage) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Media Suite */}
                <div style={{ display: activeRailTab === 'all' || activeRailTab === 'media' ? 'block' : 'none' }} className="h-full">
                  <StudioMediaBin
                    workspacePath={workspacePath}
                    project={s.project}
                    busy={s.busy}
                    selectedLayer={s.selectedLayer}
                    onSelectLayer={s.setSelectedLayer}
                    onInsertLayer={s.insertLayer}
                    onImportImage={s.importImage}
                    onReorderLayer={s.reorderLayer}
                    onMoveLayer={(layerId, toIndex) => {
                      s.applyEditorEdits([{ type: 'move-layer', layerId, toIndex }], 'Layer reordered');
                    }}
                    onRemoveSelectedLayer={s.removeSelectedLayer}
                    onImportAudio={s.importAudio}
                    captionsAvailable={s.captionsAvailable}
                    onExportCaptions={s.exportCaptions}
                    visionAvailable={s.visionAvailable}
                    onReviewVision={s.reviewVision}
                    visionRepairAvailable={s.visionRepairAvailable}
                    onRepairVision={s.repairVision}
                    onLayerContextMenu={handleLayerContextMenu}
                    onMediaContextMenu={handleMediaContextMenu}
                  />
                </div>

                {/* Text & Typography Suite */}
                <div style={{ display: activeRailTab === 'all' || activeRailTab === 'text' ? 'block' : 'none' }} className="p-3 space-y-3">
                  {s.typographyAvailable && (
                    <StudioTypographyPanel
                      key={s.project.id}
                      workspacePath={workspacePath}
                      project={s.project}
                      selectedLayer={s.selectedLayer}
                      busy={s.busy}
                      preview={s.typographyPreview}
                      onPreview={next => {
                        s.setTypographyPreview(next);
                        if (next) {
                          s.setParticlePreview(null);
                          s.setBeatPreview(null);
                          s.setTemplatePreview(null);
                          s.setPresetPreview(null);
                          s.setEffectPreview(null);
                        }
                      }}
                      onApply={s.applyTypography}
                    />
                  )}
                </div>

                {/* Audio & BeatSync Suite */}
                <div style={{ display: activeRailTab === 'all' || activeRailTab === 'audio' ? 'block' : 'none' }} className="p-3 space-y-3">
                  {s.beatAvailable && (
                    <StudioBeatSyncPanel
                      key={s.project.id}
                      workspacePath={workspacePath}
                      project={s.project}
                      selectedLayer={s.selectedLayer}
                      busy={s.busy}
                      preview={s.beatPreview}
                      onPreview={next => {
                        s.setBeatPreview(next);
                        if (next) {
                          s.setTemplatePreview(null);
                          s.setPresetPreview(null);
                          s.setEffectPreview(null);
                          s.setParticlePreview(null);
                        }
                      }}
                      onApply={s.applyAudioBeatSync}
                    />
                  )}

                  <div className="pt-2 border-t border-[#222533]">
                    <StudioAudioPanel
                      project={s.project}
                      workspacePath={workspacePath}
                      busy={s.busy}
                      isActive={isActive}
                      frame={s.frame}
                      playing={s.playing}
                      onSeekFrame={next => {
                        s.setPlaying(false);
                        s.setFrame(next);
                      }}
                      onUpload={s.importAudio}
                      onEdit={s.applyEditorEdits}
                      onError={s.message}
                    />
                  </div>
                </div>

                {/* Effects & Particles Suite */}
                <div style={{ display: activeRailTab === 'all' || activeRailTab === 'effects' ? 'block' : 'none' }} className="p-3 space-y-3">
                  {s.stackAvailable && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-[#222533] bg-[#11131c] px-3 py-2 rounded-lg">
                      <label htmlFor="motion-resize-ratio" className="text-xs text-zinc-300 font-medium">
                        Smart Resize
                      </label>
                      <select
                        id="motion-resize-ratio"
                        aria-label="Studio output aspect ratio"
                        className={control + ' max-w-[90px] text-[11px]'}
                        value={s.resizeRatio}
                        onChange={event => s.setResizeRatio(event.target.value as '16:9' | '1:1' | '9:16')}
                      >
                        <option value="16:9">16:9</option>
                        <option value="1:1">1:1</option>
                        <option value="9:16">9:16</option>
                      </select>
                      <button className={action} disabled={s.busy} onClick={s.resizeProject}>
                        Resize scene
                      </button>

                      <div className="mx-1 h-3.5 w-px bg-[#2a2d3d]" />

                      <label htmlFor="motion-upscale-target" className="text-xs text-zinc-300 font-medium">
                        Upscale
                      </label>
                      <select
                        id="motion-upscale-target"
                        aria-label="Studio upscale target"
                        className={control + ' max-w-[100px] text-[11px]'}
                        value={s.upscaleTarget}
                        onChange={event => s.setUpscaleTarget(event.target.value as '2x' | '4x' | '1080p' | '2k' | '4k')}
                      >
                        <option value="2x">2× (Factor)</option>
                        <option value="4x">4× (Factor)</option>
                        <option value="1080p">1080p (FHD)</option>
                        <option value="2k">2K (1440p)</option>
                        <option value="4k">4K (2160p UHD)</option>
                      </select>
                      <button className={action} disabled={s.busy} onClick={s.upscaleProject}>
                        Upscale scene
                      </button>
                    </div>
                  )}

                  {s.stackAvailable && <StudioEffectStackPanel project={s.project} busy={s.busy} onChange={s.changeEffectStack} />}

                  {s.effectsAvailable && (
                    <StudioEffectLibrary
                      key={workspacePath + ':' + s.project.id}
                      workspacePath={workspacePath}
                      project={s.project}
                      selectedLayer={s.selectedLayer}
                      busy={s.busy}
                      preview={s.effectPreview}
                      onPreview={next => {
                        s.setEffectPreview(next);
                        if (next) {
                          s.setPresetPreview(null);
                          s.setTemplatePreview(null);
                          s.setFrame(0);
                          s.setPlaying(true);
                        } else {
                          s.setPlaying(false);
                        }
                      }}
                      onApply={s.applySingleEffect}
                    />
                  )}

                  {s.particlesAvailable && (
                    <StudioParticlesPanel
                      key={s.project.id}
                      workspacePath={workspacePath}
                      project={s.project}
                      busy={s.busy}
                      preview={s.particlePreview}
                      onPreview={next => {
                        s.setParticlePreview(next);
                        if (next) {
                          s.setBeatPreview(null);
                          s.setTemplatePreview(null);
                          s.setPresetPreview(null);
                          s.setEffectPreview(null);
                        }
                      }}
                      onApply={s.applyParticleOverlay}
                    />
                  )}
                </div>

                {/* Templates & Brand Suite */}
                <div style={{ display: activeRailTab === 'all' || activeRailTab === 'templates' ? 'block' : 'none' }} className="p-3 space-y-3">
                  {s.brandAvailable && <StudioBrandKitPanel workspacePath={workspacePath} />}

                  {s.templatesAvailable && (
                    <StudioTemplatePanel
                      key={workspacePath + ':' + s.project.id}
                      workspacePath={workspacePath}
                      project={s.project}
                      busy={s.busy}
                      preview={s.templatePreview}
                      onPreview={next => {
                        s.setTemplatePreview(next);
                        if (next) {
                          s.setPresetPreview(null);
                          s.setEffectPreview(null);
                        }
                      }}
                      onApply={s.applySceneTemplate}
                    />
                  )}

                  {s.compoundAvailable && (
                    <StudioPresetPanel
                      key={s.project.id}
                      workspacePath={workspacePath}
                      project={s.project}
                      selectedLayer={s.selectedLayer}
                      busy={s.busy}
                      preview={s.presetPreview}
                      onPreview={next => {
                        s.setPresetPreview(next);
                        if (next) {
                          s.setEffectPreview(null);
                          s.setTemplatePreview(null);
                        }
                      }}
                      onApply={s.applyCompound}
                    />
                  )}

                  {s.batchAvailable && (
                    <StudioBatchVariantsPanel
                      key={s.project.id}
                      workspacePath={workspacePath}
                      project={s.project}
                      busy={s.busy}
                      onQueued={result => {
                        s.setSuccess('Batch created ' + result.variants.filter(v => v.projectId).length + ' project variant(s). Check queue status for MP4.');
                        void s.refreshProjects().catch(cause => s.message(cause instanceof Error ? cause.message : String(cause)));
                        void studioApi
                          .jobs(workspacePath)
                          .then(next => {
                            s.setJobs(next);
                          })
                          .catch(cause => s.message(cause instanceof Error ? cause.message : String(cause)));
                      }}
                    />
                  )}
                </div>

                {/* AI & Revision History Suite */}
                <div style={{ display: activeRailTab === 'all' || activeRailTab === 'ai' ? 'block' : 'none' }} className="p-3 space-y-3">
                  {s.historyAvailable && (
                    <StudioRecoveryPanel
                      workspacePath={workspacePath}
                      projectId={s.project.id}
                      revision={s.project.revision}
                      busy={s.busy}
                      onRestore={s.recoverSavedRevision}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Splitter 1: Between Resource Drawer and Center Stage */}
            {drawerOpen && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize resource drawer"
                onMouseDown={layout.startResizingDrawer}
                onDoubleClick={layout.resetDrawerWidth}
                className="group relative w-1.5 shrink-0 cursor-col-resize select-none bg-[#10121a] hover:bg-cyan-500/40 active:bg-cyan-400 transition-colors z-20 flex items-center justify-center border-r border-[#1e212d]"
                title="Drag to resize Drawer (Double-click to reset)"
              >
                <div className="h-7 w-0.5 rounded-full bg-zinc-600 group-hover:bg-cyan-300 transition-colors" />
              </div>
            )}

            {/* 3. Center Stage: Viewport, Canvas & Floating HUD */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              <StudioCanvasStage
                project={s.project}
                activeProject={s.activeProject || s.project}
                frame={s.frame}
                setFrame={s.setFrame}
                playing={s.playing}
                setPlaying={s.setPlaying}
                totalFrames={s.totalFrames}
                fps={s.fps}
                viewport={s.viewport}
                setViewport={s.setViewport}
                panMode={s.panMode}
                setPanMode={s.setPanMode}
                canvasSnapping={s.canvasSnapping}
                setCanvasSnapping={s.setCanvasSnapping}
                selectedLayer={s.selectedLayer}
                onSelectLayer={s.setSelectedLayer}
                imageUrls={s.imageUrls}
                isActive={isActive}
                busy={s.busy}
                hasPreview={s.hasPreview}
                onApplyEdits={s.applyEditorEdits}
                onLayerContextMenu={handleLayerContextMenu}
                onCanvasContextMenu={handleCanvasContextMenu}
              />
            </div>

            {/* Splitter 2: Between Center Stage and Right Inspector */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize details inspector"
              onMouseDown={layout.startResizingInspector}
              onDoubleClick={layout.resetInspectorWidth}
              className="group relative w-1.5 shrink-0 cursor-col-resize select-none bg-[#10121a] hover:bg-cyan-500/40 active:bg-cyan-400 transition-colors z-20 flex items-center justify-center border-l border-[#1e212d]"
              title="Drag to resize Inspector (Double-click to reset)"
            >
              <div className="h-7 w-0.5 rounded-full bg-zinc-600 group-hover:bg-cyan-300 transition-colors" />
            </div>

            {/* 4. Right Column: Details Inspector */}
            <div
              className="studio-inspector-panel shrink-0 border-l border-[#222533] bg-[#0e1017] overflow-hidden"
              style={{ width: `${layout.inspectorWidth}px` }}
            >
              <StudioInspectorSection
                layer={s.layer}
                frame={s.frame}
                draftText={s.draftText}
                onChangeDraftText={s.setDraftText}
                onSaveText={s.saveText}
                cornerDraft={s.cornerDraft}
                onChangeCornerDraft={s.setCornerDraft}
                onSaveCornerRadius={s.saveCornerRadius}
                propertyDraft={s.propertyDraft}
                onChangePropertyDraft={s.setPropertyDraft}
                onSaveProperty={s.saveProperty}
                onKeyframe={s.keyframe}
                onJumpToFrame={(f, field, val) => {
                  s.setFrame(f);
                  s.setPlaying(false);
                  s.setPropertyDraft({ field, value: String(val) });
                }}
                onPropertyContextMenu={handlePropertyContextMenu}
                busy={s.busy}
              />
            </div>
          </div>

          {/* Horizontal Splitter: Upper Workstation vs Bottom Timeline Dock */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize timeline dock"
            onMouseDown={layout.startResizingTimeline}
            onDoubleClick={layout.resetTimelineHeight}
            className="group relative h-1.5 shrink-0 cursor-row-resize select-none bg-[#10121a] hover:bg-cyan-500/40 active:bg-cyan-400 transition-colors z-20 flex items-center justify-center border-t border-b border-[#222533]"
            title="Drag to resize Timeline Dock (Double-click to reset)"
          >
            <div className="w-12 h-0.5 rounded-full bg-zinc-600 group-hover:bg-cyan-300 transition-colors" />
          </div>

          {/* Bottom Dock: Multi-Track Timeline & Audio */}
          <div
            className="studio-timeline-dock flex flex-col shrink-0 overflow-y-auto bg-[#0e1017]"
            style={{ height: `${layout.timelineHeight}px` }}
          >
            {s.interactionRulesAvailable && (
              <StudioInteractionPanel
                project={s.project}
                busy={s.busy}
                onSave={graph => s.applyEditorEdits([{ type: 'set-interaction-graph', graph }], 'Interaction graph updated')}
                onError={s.message}
              />
            )}

            {/* Multi-Track Clip NLE Timeline */}
            <StudioMultiTrackTimeline
              workspacePath={workspacePath}
              projectId={s.project.id}
              composition={(s.activeProject || s.project).composition}
              currentFrame={s.frame}
              fps={s.fps}
              isPlaying={s.playing}
              selectedClipId={selectedTimelineClipId}
              onSelectClip={setSelectedTimelineClipId}
              onSeek={next => {
                s.setPlaying(false);
                s.setFrame(next);
              }}
              onTogglePlay={() => s.setPlaying(p => !p)}
              onCompositionChange={updated => {
                s.applyEditorEdits([{ type: 'replace-composition', composition: updated }], 'Timeline clip arrangement updated');
              }}
              onSelectLayer={s.setSelectedLayer}
              onClipContextMenu={handleClipContextMenu}
              onTimelineContextMenu={handleTimelineContextMenu}
            />

            {/* Studio Keyframe & Curves Timeline (kept in DOM for test suite & curve editing) */}
            <div className="border-t border-[#1a1c26]">
              <StudioTimeline
                project={s.activeProject || s.project}
                currentFrame={s.frame}
                selectedLayer={s.selectedLayer}
                busy={s.busy || s.hasPreview}
                isActive={isActive && !s.hasPreview}
                onFrame={next => {
                  s.setPlaying(false);
                  s.setFrame(next);
                }}
                onLayer={s.setSelectedLayer}
                onEdit={s.applyEditorEdits}
                onError={s.message}
              />
            </div>

            {s.codeToVideoAvailable && <StudioCodeToVideoPanel workspacePath={workspacePath} projectId={s.project.id} disabled={s.busy} />}

            <StudioRenderFooter
              workspacePath={workspacePath}
              projectName={s.project.name}
              jobs={s.jobs}
              projectId={s.project.id}
              activeJobId={s.activeJobId}
              onSelectJobId={s.setActiveJobId}
              job={s.job}
              codeExportAvailable={s.codeExportAvailable}
              codeFormat={s.codeFormat}
              onChangeCodeFormat={s.setCodeFormat}
              reactCodeAvailable={s.reactCodeAvailable}
              editableReactAvailable={s.editableReactAvailable}
              codeTrigger={s.codeTrigger}
              onChangeCodeTrigger={s.setCodeTrigger}
              onExportWebCode={s.exportWebCode}
              onCancelJob={() =>
                void s.operation(async () => {
                  if (s.job) await studioApi.cancel(workspacePath, s.job.id);
                  s.setSuccess('Cancellation requested');
                })
              }
              previewUrl={s.previewUrl}
              extraExportsAvailable={s.extraExportsAvailable}
              busy={s.busy}
            />
          </div>
        </>
      )}

      {contextMenu && (
        <StudioContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title={contextMenu.title}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </section>
  );
}
