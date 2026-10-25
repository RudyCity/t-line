import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, MessageSquareText,
  Layers3, RefreshCw, AlertTriangle, GitBranch } from 'lucide-react';
import { AgentExecutionTimeline } from './AgentExecutionTimeline';
import type { ConsoleMessage } from './SuperAgentMessageItem';
import type { SubAgentItem } from './SubAgentTerminalModal';
import type { PendingPermission } from './SuperAgentInteractiveCards';
import { AssistantTurnQueue } from './AssistantTurnQueue';
import { AssistantTaskDraftPanel, type AssistantTaskHandoff } from './AssistantTaskDraftPanel';
import { assistantTurnTotals, loadAssistantTurns } from './AssistantTurnApi';
import { getAssistantDrafts, getAssistantTaskEvents,
  type AssistantDraftTask, type AssistantTaskTransitionEvent } from './AssistantTaskDraftApi';
import { getAuthHeader } from './SuperAgentConsoleUtils';
import { getCoreAgentTimeline, type CoreAgentTimelineEvent } from './CoreAgentTimelineApi';

type ActivityView = 'chat' | 'tasks' | 'timeline';
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
export function AssistantActivityCenter({ workspace, sessionId, handoff, onDraftCreated,
  messages = [], subagents = [], pendingPermission = null, onPermissionDecision,
  connected = true, approvalJump = 0 }: {
  workspace: string; sessionId: string; handoff?: AssistantTaskHandoff | null;
  onDraftCreated?: (submitted: string) => void;
  messages?: readonly ConsoleMessage[]; subagents?: readonly SubAgentItem[];
  pendingPermission?: PendingPermission | null;
  onPermissionDecision?: (decision: boolean | 'session' | 'always') => void;
  connected?: boolean; approvalJump?: number;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ActivityView>('chat');
  const [summary, setSummary] = useState<ActivitySummary>(empty);
  const [drafts, setDrafts] = useState<AssistantDraftTask[]>([]);
  const [unverifiedIds, setUnverifiedIds] = useState<string[]>([]);
  const [taskEvents, setTaskEvents] = useState<AssistantTaskTransitionEvent[]>([]);
  const eventCursor = useRef(0);
  const [journalError, setJournalError] = useState('');
  const [coreEvents, setCoreEvents] = useState<CoreAgentTimelineEvent[]>([]);
  const coreCursor = useRef(0);
  const [coreError, setCoreError] = useState('');
  const [coreGap, setCoreGap] = useState(false);
  const [errors, setErrors] = useState({ chat: '', tasks: '' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setOpen(false); setView('chat'); setSummary(empty); setDrafts([]); setUnverifiedIds([]);
    eventCursor.current = 0; setTaskEvents([]); setJournalError('');
    coreCursor.current = 0; setCoreEvents([]); setCoreError(''); setCoreGap(false);
    setErrors({ chat: '', tasks: '' });
  }, [workspace, sessionId]);

  useEffect(() => {
    if (!handoff || handoff.workspace !== workspace || handoff.sessionId !== sessionId) return;
    setOpen(true); setView('tasks');
  }, [handoff, workspace, sessionId]);

  useEffect(() => {
    if (!pendingPermission || !workspace || !sessionId) return;
    setOpen(true); setView('timeline');
  }, [pendingPermission?.permissionId, approvalJump, workspace, sessionId]);

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
      if (tasks.status === 'fulfilled') {
        setDrafts(tasks.value.tasks);
        setUnverifiedIds(tasks.value.unverifiedTaskIds || []);
      }
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

  // Replay actual Core task-state transitions only while the timeline is visible.
  useEffect(() => {
    if (!open || view !== 'timeline' || !workspace || !sessionId) return;
    const controller = new AbortController();
    let active = true;
    let pending = false;
    const refreshEvents = async () => {
      if (pending || !active || document.hidden) return;
      pending = true;
      try {
        // Bounded pagination: 400 recorded transitions per refresh, last 600 retained in UI.
        for (let pageIndex = 0; pageIndex < 4; pageIndex++) {
          const snapshot = await getAssistantTaskEvents(workspace, sessionId,
            eventCursor.current, getAuthHeader, controller.signal);
          if (!active || controller.signal.aborted) return;
          if (snapshot.events.length === 0) break;
          eventCursor.current = snapshot.nextCursor;
          setTaskEvents(previous => [...previous, ...snapshot.events].slice(-600));
          if (snapshot.events.length < 100) break;
        }
        setJournalError('');
      } catch (cause) {
        if (active && !controller.signal.aborted)
          setJournalError(cause instanceof Error ? cause.message : 'Task event history unavailable');
      } finally { pending = false; }
    };
    void refreshEvents();
    const timer = window.setInterval(() => { void refreshEvents(); }, 5000);
    const onVisible = () => { if (!document.hidden) void refreshEvents(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false; controller.abort(); window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open, view, workspace, sessionId]);

  useEffect(() => {
    if (!open || view !== 'timeline' || !workspace || !sessionId) return;
    const controller = new AbortController();
    let active = true;
    let busy = false;
    const fetchEvents = async () => {
      if (!active || busy || document.hidden) return;
      busy = true;
      try {
        // 400-entry Core cap; read four authorized pages at most per refresh.
        for (let i = 0; i < 4; i++) {
          const page = await getCoreAgentTimeline(workspace, sessionId, coreCursor.current,
            getAuthHeader, controller.signal);
          if (!active || controller.signal.aborted) return;
          if (page.gap) setCoreGap(true);
          if (!page.events.length) break;
          coreCursor.current = page.nextCursor;
          setCoreEvents(old => [...old, ...page.events].slice(-400));
          if (page.events.length < 100) break;
        }
        setCoreError('');
      } catch (e) {
        if (active && !controller.signal.aborted)
          setCoreError(e instanceof Error ? e.message : 'Core execution history unavailable');
      } finally { busy = false; }
    };
    void fetchEvents();
    const timer = window.setInterval(() => { void fetchEvents(); }, 5000);
    const visible = () => { if (!document.hidden) void fetchEvents(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; controller.abort(); window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [open, view, workspace, sessionId]);

  const currentCount = summary.chatRunning + summary.taskActive;
  const reviewCount = summary.chatRecoverable + summary.taskAttention + (pendingPermission ? 1 : 0);
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
              Chat · tasks · agent timeline · {pendingPermission ? 'Approval waiting' :
              summary.chatPending + ' queued chat · ' + summary.taskCompleted + ' tasks completed'}
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
              <button type="button" id="activity-tab-timeline" role="tab" aria-selected={view === 'timeline'}
                aria-controls="activity-panel-timeline" onClick={() => setView('timeline')}
                className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ' +
                  (view === 'timeline' ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)]'
                    : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]')}>
                <GitBranch size={14} aria-hidden="true"/> Agent timeline
                {pendingPermission && <span className="rounded-full bg-amber-500/10 px-1.5 text-amber-400">1 approval</span>}
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
              <div role="tabpanel" id="activity-panel-timeline" aria-labelledby="activity-tab-timeline"
                hidden={view !== 'timeline'}>
                {journalError && <p role="status" className="px-4 pt-2 text-xs text-amber-400">
                  Core task history unavailable · {journalError}. Showing available snapshots.
                </p>}
                {coreError && <p role="status" className="px-4 pt-2 text-xs text-amber-400">
                  Core execution history unavailable · {coreError}. Showing available live actions.
                </p>}
                {coreGap && <p role="status" className="px-4 pt-2 text-xs text-amber-400">
                  Older Core execution events were pruned. Recorded sequence may have gaps.
                </p>}
                <AgentExecutionTimeline messages={messages} subagents={subagents} drafts={drafts}
                  coreEvents={coreEvents} taskEvents={taskEvents} unverifiedTaskIds={unverifiedIds} pendingPermission={pendingPermission}
                  onPermissionDecision={onPermissionDecision} connected={connected}/>
              </div>
            </>
          )}
      </div>
    </section>
  );
}
