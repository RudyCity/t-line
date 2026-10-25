import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, MessageSquareText,
  Layers3, RefreshCw, AlertTriangle } from 'lucide-react';
import { AssistantTurnQueue } from './AssistantTurnQueue';
import { AssistantTaskDraftPanel, type AssistantTaskHandoff } from './AssistantTaskDraftPanel';
import { assistantTurnTotals, loadAssistantTurns } from './AssistantTurnApi';
import { getAssistantDrafts, type AssistantDraftTask } from './AssistantTaskDraftApi';
import { getAuthHeader } from './SuperAgentConsoleUtils';

type ActivityView = 'chat' | 'tasks';
type ActivitySummary = {
  chatRunning: number; chatPending: number; chatRecoverable: number;
  taskActive: number; taskCompleted: number; taskAttention: number;
};
const empty: ActivitySummary = {
  chatRunning: 0, chatPending: 0, chatRecoverable: 0,
  taskActive: 0, taskCompleted: 0, taskAttention: 0,
};
const activeTaskStatuses = new Set(['queued', 'planning', 'running', 'awaiting_approval']);
const attentionTaskStatuses = new Set(['failed', 'interrupted', 'reconcile_required']);
export function summarizeBackgroundTasks(tasks: readonly AssistantDraftTask[], unverified: readonly string[]) {
  const unknown = new Set(unverified);
  return {
    taskActive: tasks.filter(t => activeTaskStatuses.has(t.status) && !unknown.has(t.taskId)).length,
    taskCompleted: tasks.filter(t => t.status === 'completed').length,
    taskAttention: tasks.filter(t => unknown.has(t.taskId) || attentionTaskStatuses.has(t.status)).length,
  };
}

/** One desktop activity surface. Chat turns and detached tasks keep their OWN
 * session-scoped APIs and permission/recovery policies. Never merge execution. */
export function AssistantActivityCenter({ workspace, sessionId, handoff, onDraftCreated }: {
  workspace: string; sessionId: string; handoff?: AssistantTaskHandoff | null;
  onDraftCreated?: (submitted: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ActivityView>('chat');
  const [summary, setSummary] = useState<ActivitySummary>(empty);
  const [errors, setErrors] = useState({ chat: '', tasks: '' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setOpen(false); setView('chat'); setSummary(empty);
    setErrors({ chat: '', tasks: '' });
  }, [workspace, sessionId]);

  useEffect(() => {
    if (!handoff || handoff.workspace !== workspace || handoff.sessionId !== sessionId) return;
    setOpen(true); setView('tasks');
  }, [handoff, workspace, sessionId]);

  useEffect(() => {
    if (!workspace || !sessionId) return;
    const controller = new AbortController();
    let disposed = false;
    let generation = 0;
    const refresh = async () => {
      const current = ++generation;
      const [chat, tasks] = await Promise.allSettled([
        loadAssistantTurns(workspace, sessionId, getAuthHeader, controller.signal),
        getAssistantDrafts(workspace, sessionId, getAuthHeader, controller.signal),
      ]);
      if (disposed || current !== generation) return;
      setSummary(prev => ({
        ...prev,
        ...(chat.status === 'fulfilled' ? (() => {
          const totals = assistantTurnTotals(chat.value);
          return { chatRunning: totals.running, chatPending: totals.pending,
            chatRecoverable: totals.recoverable };
        })() : {}),
        ...(tasks.status === 'fulfilled'
          ? summarizeBackgroundTasks(tasks.value.tasks, tasks.value.unverifiedTaskIds || [])
          : {}),
      }));
      setErrors({
        chat: chat.status === 'rejected' ? 'Chat queue status unavailable' : '',
        tasks: tasks.status === 'rejected' ? 'Background task status unavailable' : '',
      });
    };
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true; controller.abort(); window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [workspace, sessionId, revision]);

  const currentCount = summary.chatRunning + summary.taskActive;
  const reviewCount = summary.chatRecoverable + summary.taskAttention;
  const available = Boolean(workspace && sessionId);
  const delayed = Boolean(errors.chat || errors.tasks);
  return (
    <section aria-label="Assistant Activity Center"
      className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-card)] font-sans text-[var(--text-main)]">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2">
        <button type="button" aria-expanded={open} aria-controls="assistant-activity-content"
          aria-label="Toggle Activity Center" onClick={() => setOpen(value => !value)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left hover:opacity-85 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-glow)] text-[var(--color-primary)]">
            <Activity size={15} aria-hidden="true"/>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">Activity Center</span>
            <span className="block truncate text-[10px] text-[var(--text-muted)]">
              Chat queue & independent tasks · {summary.chatPending} queued chat · {summary.taskCompleted} tasks completed
            </span>
          </span>
          {currentCount > 0 && <span className="rounded-full bg-[var(--color-primary-glow)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">
            {currentCount} active
          </span>}
          {reviewCount > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            {reviewCount} review
          </span>}
          {delayed && <AlertTriangle size={14} className="text-amber-400" aria-label="Activity status delayed"/>}
          {open ? <ChevronDown size={15} className="text-[var(--text-muted)]"/> :
            <ChevronUp size={15} className="text-[var(--text-muted)]"/>}
        </button>
        <button type="button" onClick={() => setRevision(value => value + 1)}
          aria-label="Refresh Activity Center" title="Refresh activity counts"
          className="shrink-0 rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
          <RefreshCw size={13}/>
        </button>
      </div>
      <div id="assistant-activity-content" hidden={!open}
        className="border-t border-[var(--border-color)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 sm:px-4 py-2">
            <div role="tablist" aria-label="Activity sources" className="flex min-w-0 flex-wrap gap-1.5">
              <button type="button" id="activity-tab-chat" role="tab" aria-selected={view === 'chat'}
                aria-controls="activity-panel-chat" onClick={() => setView('chat')}
                className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ' +
                  (view === 'chat' ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)]'
                    : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]')}>
                <MessageSquareText size={14} aria-hidden="true"/> Chat queue
                <span className="opacity-70">{summary.chatRunning + summary.chatPending}</span>
              </button>
              <button type="button" id="activity-tab-tasks" role="tab" aria-selected={view === 'tasks'}
                aria-controls="activity-panel-tasks" onClick={() => setView('tasks')}
                className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ' +
                  (view === 'tasks' ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)]'
                    : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]')}>
                <Layers3 size={14} aria-hidden="true"/> Background tasks
                <span className="opacity-70">{summary.taskActive + summary.taskAttention}</span>
              </button>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">This chat session only</span>
          </div>
          {delayed && <p role="status" className="px-3 sm:px-4 py-1.5 text-[11px] text-amber-400">
            {[errors.chat, errors.tasks].filter(Boolean).join(' · ')}. Last known counts shown.
          </p>}
          {!available ? <p className="px-4 py-3 text-xs text-[var(--text-muted)]">
            Select a workspace and chat session to view activity.
          </p> : (
            <>
              {/* Retain both views while open: switching tabs cannot discard an unsaved draft. */}
              <div role="tabpanel" id="activity-panel-chat" aria-labelledby="activity-tab-chat"
                hidden={view !== 'chat'}>
                <AssistantTurnQueue workspace={workspace} sessionId={sessionId}
                  visible={open && view === 'chat'} embedded/>
              </div>
              <div role="tabpanel" id="activity-panel-tasks" aria-labelledby="activity-tab-tasks"
                hidden={view !== 'tasks'}>
                <AssistantTaskDraftPanel workspace={workspace} sessionId={sessionId}
                  visible={open && view === 'tasks'}
                  handoff={handoff} onDraftCreated={submitted => {
                    onDraftCreated?.(submitted);
                    setRevision(value => value + 1);
                  }} embedded/>
              </div>
            </>
          )}
      </div>
    </section>
  );
}
