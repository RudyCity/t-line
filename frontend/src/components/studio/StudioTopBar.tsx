import { Clapperboard, Film, Plus, RefreshCw, Undo2, Redo2, X, LayoutTemplate, Tv, Rows } from 'lucide-react';
import { STUDIO_DISPLAY_NAME } from '../../services/studioBranding';
import type {
  StudioProject,
  StudioProjectSummary,
  StudioSchedulerStatus,
  StudioSupervisorStatus,
  StudioStorageStatus,
  StudioQueueRecovery,
} from '../../services/studioApi';

interface Props {
  workspacePath: string;
  projects: StudioProjectSummary[];
  selectedId: string;
  onSelectProject: (id: string) => void;
  project: StudioProject | null;
  supervisor: StudioSupervisorStatus | null;
  scheduler: StudioSchedulerStatus | null;
  queueRecovery: StudioQueueRecovery | null;
  storage: StudioStorageStatus | null;
  busy: boolean;
  onRefresh: () => void;
  creating: boolean;
  onToggleCreating: () => void;
  undoDisabled: boolean;
  redoDisabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  renderWidth: 640 | 1280 | 1920;
  onChangeRenderWidth: (width: 640 | 1280 | 1920) => void;
  supervisedRender: boolean;
  onToggleSupervisedRender: (val: boolean) => void;
  onRender: () => void;
  projectName: string;
  onChangeProjectName: (name: string) => void;
  onCreateProject: () => void;
  onCancelCreating: () => void;
  layoutPreset?: 'default' | 'cinema' | 'timeline';
  onLayoutPreset?: (preset: 'default' | 'cinema' | 'timeline') => void;
}

const control = 'rounded-md border border-[#2a2d3d] bg-[#161822] px-2.5 py-1.5 text-xs text-zinc-200 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400';
const action = 'inline-flex items-center gap-1.5 rounded-md border border-[#2a2d3d] bg-[#1a1d28] px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-all hover:bg-[#232736] hover:border-cyan-500/50 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-40 disabled:pointer-events-none';
const exportActionBtn = 'inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-teal-400 to-cyan-400 px-3.5 py-1.5 text-xs font-bold text-zinc-950 shadow-md shadow-cyan-500/20 transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const primary = exportActionBtn;

export function StudioTopBar({
  workspacePath,
  projects,
  selectedId,
  onSelectProject,
  project,
  supervisor,
  scheduler,
  queueRecovery,
  storage,
  busy,
  onRefresh,
  creating,
  onToggleCreating,
  undoDisabled,
  redoDisabled,
  onUndo,
  onRedo,
  renderWidth,
  onChangeRenderWidth,
  supervisedRender,
  onToggleSupervisedRender,
  onRender,
  projectName,
  onChangeProjectName,
  onCreateProject,
  onCancelCreating,
  layoutPreset,
  onLayoutPreset,
}: Props) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222533] bg-[#0e1017] px-4 py-2 shadow-sm select-none">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Studio Brand Icon & Title */}
          <div className="flex items-center gap-2 pr-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 shadow-xs">
              <Clapperboard size={15} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-black tracking-wider text-zinc-100 uppercase font-mono">
                  {STUDIO_DISPLAY_NAME}
                </h2>
                <span className="rounded bg-cyan-400/15 border border-cyan-400/30 px-1.5 py-0.2 text-[9px] font-bold tracking-wider text-cyan-300 uppercase">
                  Desktop Edition
                </span>
              </div>
              <p className="max-w-[170px] truncate font-mono text-[10px] text-zinc-400" title={workspacePath}>
                {workspacePath}
              </p>
            </div>
          </div>

          {project && (
            <span className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300 shadow-inner">
              r{project.revision}
            </span>
          )}

          {project && (
            <span className="hidden rounded-md border border-[#2a2d3d] bg-[#161822] px-2 py-0.5 font-mono text-[10px] text-zinc-300 md:inline-block">
              {project.composition.width}×{project.composition.height} · {Math.round(project.composition.fps.numerator / project.composition.fps.denominator)}fps
            </span>
          )}

          {/* Dynamic Layout Presets Switcher */}
          {project && onLayoutPreset && (
            <div className="hidden sm:flex items-center rounded-md border border-[#2a2d3d] bg-[#141620] p-0.5 text-[10px] font-mono gap-0.5">
              <button
                type="button"
                onClick={() => onLayoutPreset('default')}
                className={`flex items-center gap-1 rounded px-2 py-0.5 transition-colors ${
                  layoutPreset === 'default'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2230]'
                }`}
                title="Standard balanced layout (Default)"
              >
                <LayoutTemplate size={11} />
                <span>Standard</span>
              </button>
              <button
                type="button"
                onClick={() => onLayoutPreset('cinema')}
                className={`flex items-center gap-1 rounded px-2 py-0.5 transition-colors ${
                  layoutPreset === 'cinema'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2230]'
                }`}
                title="Cinema mode: Maximize Center Canvas Stage"
              >
                <Tv size={11} />
                <span>Cinema</span>
              </button>
              <button
                type="button"
                onClick={() => onLayoutPreset('timeline')}
                className={`flex items-center gap-1 rounded px-2 py-0.5 transition-colors ${
                  layoutPreset === 'timeline'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2230]'
                }`}
                title="Timeline focus: Expand Multi-Track NLE dock"
              >
                <Rows size={11} />
                <span>Timeline</span>
              </button>
            </div>
          )}

          {supervisor && (
            <span
              role="status"
              className="hidden rounded-md border border-[#2a2d3d] bg-[#161822] px-2 py-0.5 font-mono text-[10px] text-zinc-400 xl:inline-block"
              title="Opt-in FIFO supervisor is a separate SuperAgent process; this status never starts one"
            >
              FIFO {supervisor.queuedSupervised} queued · {supervisor.leader === 'claimed_unverified' ? 'claim present (unverified)' : supervisor.leader === 'free' ? 'not running' : 'unsafe claim'}
            </span>
          )}

          {scheduler && (
            <span
              role="status"
              className="rounded-md border border-[#2a2d3d] bg-[#161822] px-2 py-0.5 font-mono text-[10px] text-zinc-300"
              title="Workspace render queue and rendering capacity"
            >
              Queue {scheduler.queued}/{scheduler.queueLimit} · Render {scheduler.slots.filter(item => item.state === 'claimed_unverified').length}/{scheduler.maxConcurrentRenders}
            </span>
          )}

          {queueRecovery && (queueRecovery.eligible > 0 || queueRecovery.blocked > 0) && (
            <span
              role="status"
              className="hidden rounded-md border border-amber-500/30 bg-amber-950/30 px-2 py-0.5 font-mono text-[10px] text-amber-300 lg:inline-block"
              title="Read-only recovery diagnosis. Use the SuperAgent CLI and inspect worker identity before any queued job redispatch."
            >
              Queue recovery: {queueRecovery.eligible} eligible · {queueRecovery.blocked} blocked
            </span>
          )}

          {storage && (
            <span
              role="status"
              className="hidden rounded-md border border-[#2a2d3d] bg-[#161822] px-2 py-0.5 font-mono text-[10px] text-zinc-400 2xl:inline-block"
              title="Read-only workspace render storage; existing completed exports are preserved"
            >
              {storage.jobs.total} jobs · {(storage.completedArtifactBytes / (1024 * 1024)).toFixed(1)} MB · {storage.maintenance.candidates} old cleanup candidates
            </span>
          )}
        </div>

        {/* Right Action Tools: Project Picker, History, Render Settings & Export Button */}
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor="motion-project-picker">Studio project</label>
          <select
            id="motion-project-picker"
            value={selectedId}
            onChange={event => onSelectProject(event.target.value)}
            className={control + ' max-w-[190px] font-medium'}
            aria-label="Select Studio project"
          >
            <option value="">Select a project</option>
            {projects.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>

          <button
            className={action}
            onClick={onRefresh}
            disabled={busy}
            aria-label="Refresh Studio projects"
            title="Refresh Studio projects"
          >
            <RefreshCw size={12} className={busy ? 'animate-spin text-cyan-400' : ''} />
          </button>

          <button
            className={action}
            onClick={onToggleCreating}
            aria-expanded={creating}
            title="Create new project"
          >
            <Plus size={12} className="text-cyan-400" /> New
          </button>

          <div className="mx-0.5 h-4 w-px bg-[#2a2d3d]" />

          {/* Undo / Redo buttons */}
          <button
            className={action}
            disabled={undoDisabled}
            aria-label="Undo scene change"
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={12} />
          </button>

          <button
            className={action}
            disabled={redoDisabled}
            aria-label="Redo scene change"
            onClick={onRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={12} />
          </button>

          <div className="mx-0.5 h-4 w-px bg-[#2a2d3d]" />

          <label htmlFor="motion-render-width" className="sr-only">Render resolution</label>
          <select
            id="motion-render-width"
            aria-label="Render resolution"
            className={control + ' w-auto font-mono text-[11px]'}
            value={renderWidth}
            onChange={event => onChangeRenderWidth(Number(event.target.value) as 640 | 1280 | 1920)}
            disabled={busy}
          >
            <option value={640}>640p Preview</option>
            <option value={1280}>720p HD</option>
            <option value={1920}>1080p FHD</option>
          </select>

          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#2a2d3d] bg-[#1a1d28] px-2 py-1.5 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200"
            title="Opt-in FIFO mode requires a separately running SuperAgent motion supervisor --watch process"
          >
            <input
              type="checkbox"
              aria-label="Use FIFO supervisor"
              checked={supervisedRender}
              onChange={event => onToggleSupervisedRender(event.target.checked)}
              disabled={busy || !supervisor}
              className="accent-cyan-400"
            />
            FIFO
          </label>

          {/* Primary Render/Export Button */}
          <button
            className={exportActionBtn}
            onClick={onRender}
            disabled={!project || busy}
            title="Render MP4 video"
          >
            <Film size={13} className="text-zinc-950 stroke-[2.5]" />
            <span>Render MP4</span>
          </button>
        </div>
      </header>

      {creating && (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 animate-fadeIn"
          onSubmit={event => {
            event.preventDefault();
            if (projectName.trim()) onCreateProject();
          }}
        >
          <label className="text-xs font-medium text-[var(--text-main)]" htmlFor="motion-name">
            Project name
          </label>
          <input
            id="motion-name"
            className={control + ' max-w-[280px]'}
            maxLength={160}
            value={projectName}
            onChange={event => onChangeProjectName(event.target.value)}
            placeholder="Product launch intro"
            required
            autoFocus
          />
          <button className={primary} disabled={busy || !projectName.trim()} type="submit">
            Create project
          </button>
          <button className={action} type="button" onClick={onCancelCreating} aria-label="Cancel project creation">
            <X size={13} />
          </button>
        </form>
      )}
    </>
  );
}
