import React from 'react';
import { Clapperboard, Film, Plus, RefreshCw, Undo2, Redo2, X } from 'lucide-react';
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
}

const control = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-main)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';
const primary = 'inline-flex items-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';

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
}: Props) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-2.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
              <Clapperboard size={16} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                  {STUDIO_DISPLAY_NAME}
                </h2>
                <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-primary)]">
                  Pro Suite
                </span>
              </div>
              <p className="max-w-[180px] truncate font-mono text-[10px] text-[var(--text-muted)]" title={workspacePath}>
                {workspacePath}
              </p>
            </div>
          </div>

          {project && (
            <span className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--color-primary)] shadow-inner">
              r{project.revision}
            </span>
          )}

          {supervisor && (
            <span
              role="status"
              className="hidden rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)] xl:inline-block"
              title="Opt-in FIFO supervisor is a separate SuperAgent process; this status never starts one"
            >
              FIFO {supervisor.queuedSupervised} queued · {supervisor.leader === 'claimed_unverified' ? 'claim present (unverified)' : supervisor.leader === 'free' ? 'not running' : 'unsafe claim'}
            </span>
          )}

          {scheduler && (
            <span
              role="status"
              className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
              title="Workspace render queue and rendering capacity"
            >
              Queue {scheduler.queued}/{scheduler.queueLimit} · Render {scheduler.slots.filter(item => item.state === 'claimed_unverified').length}/{scheduler.maxConcurrentRenders}
            </span>
          )}

          {queueRecovery && (queueRecovery.eligible > 0 || queueRecovery.blocked > 0) && (
            <span
              role="status"
              className="hidden rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-0.5 font-mono text-[10px] text-amber-400 lg:inline-block"
              title="Read-only recovery diagnosis. Use the SuperAgent CLI and inspect worker identity before any queued job redispatch."
            >
              Queue recovery: {queueRecovery.eligible} eligible · {queueRecovery.blocked} blocked
            </span>
          )}

          {storage && (
            <span
              role="status"
              className="hidden rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)] 2xl:inline-block"
              title="Read-only workspace render storage; existing completed exports are preserved"
            >
              {storage.jobs.total} jobs · {(storage.completedArtifactBytes / (1024 * 1024)).toFixed(1)} MB · {storage.maintenance.candidates} old cleanup candidates
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor="motion-project-picker">Studio project</label>
          <select
            id="motion-project-picker"
            value={selectedId}
            onChange={event => onSelectProject(event.target.value)}
            className={control + ' max-w-[200px] font-medium'}
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
            <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
          </button>

          <button
            className={action}
            onClick={onToggleCreating}
            aria-expanded={creating}
            title="Create new project"
          >
            <Plus size={12} /> New
          </button>

          <div className="mx-0.5 h-4 w-px bg-[var(--border-color)]" />

          <button
            className={action}
            disabled={undoDisabled}
            aria-label="Undo scene change"
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={12} /> Undo
          </button>

          <button
            className={action}
            disabled={redoDisabled}
            aria-label="Redo scene change"
            onClick={onRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={12} /> Redo
          </button>

          <div className="mx-0.5 h-4 w-px bg-[var(--border-color)]" />

          <label htmlFor="motion-render-width" className="sr-only">Render resolution</label>
          <select
            id="motion-render-width"
            aria-label="Render resolution"
            className={control + ' w-auto font-mono text-[11px]'}
            value={renderWidth}
            onChange={event => onChangeRenderWidth(Number(event.target.value) as 640 | 1280 | 1920)}
            disabled={busy}
          >
            <option value={640}>640px preview</option>
            <option value={1280}>1280px HD</option>
            <option value={1920}>1920px Full HD</option>
          </select>

          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
            title="Opt-in FIFO mode requires a separately running SuperAgent motion supervisor --watch process"
          >
            <input
              type="checkbox"
              aria-label="Use FIFO supervisor"
              checked={supervisedRender}
              onChange={event => onToggleSupervisedRender(event.target.checked)}
              disabled={busy || !supervisor}
              className="accent-[var(--color-primary)]"
            />
            FIFO
          </label>

          <button
            className={primary}
            onClick={onRender}
            disabled={!project || busy}
            title="Render MP4 video"
          >
            <Film size={13} /> Render MP4
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
