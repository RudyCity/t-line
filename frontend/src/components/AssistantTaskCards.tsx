import type { AssistantDraftTask, AssistantTaskDomain, AssistantTaskDomainDescriptor } from './AssistantTaskDraftApi';
import { BookOpen, BrainCircuit, Code2, Compass, FileText, Globe2,
  Play, ScrollText, ShieldCheck, XCircle, AlertTriangle, Eye, GitPullRequest,
  Pause, RotateCcw } from 'lucide-react';

const domainIcon = {
  general: BrainCircuit, research: Globe2, analysis: BookOpen,
  planning: Compass, files: FileText, coding: Code2,
} as const;

export function AssistantDomainPicker({ domains, value, disabled, onChange }: {
  domains: AssistantTaskDomainDescriptor[]; value: AssistantTaskDomain;
  disabled: boolean; onChange: (next: AssistantTaskDomain) => void;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 text-[11px] font-medium text-[var(--text-muted)]">What kind of help do you need?</legend>
      <div className="flex flex-wrap gap-1.5" aria-label="Task domains">
        {domains.map(domain => {
          const Icon = domainIcon[domain.id];
          const active = domain.id === value;
          return (
            <button key={domain.id} type="button" aria-pressed={active}
              aria-label={'Domain: ' + domain.label}
              title={domain.description} onClick={() => onChange(domain.id)}
              className={'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50 ' +
                (active ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)] font-semibold'
                  : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]')}>
              <Icon size={13} aria-hidden="true"/>{domain.label}
            </button>
          );
        })}
      </div>
      {domains.length > 0 &&
        <p className="text-[11px] mt-2 text-[var(--text-muted)]" role="note">
          {domains.find(item => item.id === value)?.description}
          <span className="ml-2 inline-flex items-center gap-1 opacity-80">
            <ShieldCheck size={12} aria-hidden="true"/> Read-only worker
          </span>
        </p>}
    </fieldset>
  );
}

const statusLabel = (state: string, orphan: boolean) => orphan ? 'Needs reconciliation' : ({
  queued: 'Ready', paused: 'Paused (draft only)', planning: 'Preparing', running: 'Running',
  completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed',
  awaiting_approval: 'Awaiting approval', interrupted: 'Interrupted',
  reconcile_required: 'Review required',
} as Record<string,string>)[state] || state;

export function AssistantTaskCard({ task, busy, active, unverified, enabled, patchEnabled,
  onRun, onPatch, onCancel, onResult, onReview, onReconcile,
  onPause, onResume, onRetry, onCheckpoint }: {
  task: AssistantDraftTask; busy: boolean; active: boolean; unverified: boolean;
  enabled: boolean; patchEnabled: boolean;
  onRun: (task: AssistantDraftTask) => void; onPatch: (task: AssistantDraftTask) => void;
  onCancel: (task: AssistantDraftTask) => void; onResult: (task: AssistantDraftTask) => void;
  onReview: (task: AssistantDraftTask) => void; onReconcile: (task: AssistantDraftTask) => void;
  onPause?: (task: AssistantDraftTask) => void; onResume?: (task: AssistantDraftTask) => void;
  onRetry?: (task: AssistantDraftTask) => void;
  onCheckpoint?: (task: AssistantDraftTask) => void;
}) {
  const Icon = domainIcon[task.domain ?? 'analysis'] || BookOpen;
  const queued = task.status === 'queued';
  const completed = task.status === 'completed';
  const cancellable = ['queued', 'paused', 'planning', 'running'].includes(task.status) && !unverified;
  const patchReady = task.evidenceIds?.includes('patch_review_ready');
  return (
    <article className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2.5"
      aria-label={'Task: ' + task.title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          <div className="shrink-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-1.5 text-[var(--text-muted)]">
            <Icon size={15} aria-hidden="true"/>
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[13px] leading-snug text-[var(--text-main)] break-words">{task.title}</div>
            <div className="mt-1 text-[11px] text-[var(--text-muted)] capitalize">{task.domain || 'analysis'}</div>
          </div>
        </div>
        <span className={'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ' +
          (unverified || task.status === 'failed' || task.status === 'reconcile_required'
            ? 'bg-amber-500/10 text-amber-400'
            : active ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)]'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)]')}>
          {unverified ? <AlertTriangle size={11} aria-hidden="true"/> :
            active ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current animate-pulse"/> : null}
          {statusLabel(task.status, unverified)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-0 sm:pl-[34px]">
        {queued && !unverified && onPause && (
          <button type="button" disabled={busy || active} onClick={() => onPause(task)}
            aria-label={'Pause draft ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] disabled:opacity-40">
            <Pause size={12}/> Pause draft
          </button>
        )}
        {task.status === 'paused' && onResume && (
          <button type="button" disabled={busy || active} onClick={() => onResume(task)}
            aria-label={'Resume draft ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-primary)]/40 px-2.5 py-1 text-[11px] text-[var(--color-primary)] disabled:opacity-40">
            <Play size={12}/> Resume to draft
          </button>
        )}
        {['failed','cancelled','reconcile_required'].includes(task.status) &&
          !unverified && onRetry && (
          <button type="button" disabled={busy || active} onClick={() => onRetry(task)}
            aria-label={'Retry as new draft ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] disabled:opacity-40">
            <RotateCcw size={12}/> Retry as draft
          </button>
        )}
        {onCheckpoint && (
          <button type="button" disabled={busy} onClick={() => onCheckpoint(task)}
            aria-label={'Inspect checkpoint ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] disabled:opacity-40">
            <Eye size={12}/> Checkpoint
          </button>
        )}
        {task.retryOfTaskId && (
          <span className="text-[10px] text-[var(--text-muted)]">New attempt · not yet executed</span>
        )}
        {queued && enabled && (
          <button type="button" disabled={busy} onClick={() => onRun(task)}
            aria-label={'Run read-only ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-primary)]/40 bg-[var(--color-primary-glow)] px-2.5 py-1 text-[11px] text-[var(--color-primary)] hover:opacity-80 disabled:opacity-40">
            <Play size={12} aria-hidden="true"/> Run task
          </button>
        )}
        {queued && patchEnabled && task.domain === 'coding' && (
          <button type="button" disabled={busy} onClick={() => onPatch(task)}
            aria-label={'Prepare patch ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] text-[var(--text-main)] disabled:opacity-40">
            <GitPullRequest size={12} aria-hidden="true"/> Prepare patch
          </button>
        )}
        {unverified && (
          <button type="button" disabled={busy} onClick={() => onReconcile(task)}
            aria-label={'Reconcile task ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2.5 py-1 text-[11px] text-amber-400 disabled:opacity-50">
            <AlertTriangle size={12} aria-hidden="true"/> Reconcile
          </button>
        )}
        {cancellable && (
          <button type="button" disabled={busy} onClick={() => onCancel(task)}
            aria-label={'Cancel draft ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-40">
            <XCircle size={12} aria-hidden="true"/> Cancel
          </button>
        )}
        {completed && (
          <button type="button" disabled={busy} onClick={() => onResult(task)}
            aria-label={'View result ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] text-[var(--text-main)] disabled:opacity-40">
            <Eye size={12} aria-hidden="true"/> View result
          </button>
        )}
        {completed && patchReady && (
          <button type="button" disabled={busy} onClick={() => onReview(task)}
            aria-label={'Review patch ' + task.title}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] text-[var(--text-main)] disabled:opacity-40">
            <ScrollText size={12} aria-hidden="true"/> Review patch
          </button>
        )}
      </div>
    </article>
  );
}
