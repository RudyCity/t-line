import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, ChevronDown, ChevronRight,
  Clock3, ShieldAlert, Layers3 } from 'lucide-react';
import { PermissionCard, type PendingPermission } from './SuperAgentInteractiveCards';
import type { SubAgentItem } from './SubAgentTerminalModal';
import type { ConsoleMessage } from './SuperAgentMessageItem';
import type { AssistantDraftTask, AssistantTaskTransitionEvent } from './AssistantTaskDraftApi';
import type { CoreAgentTimelineEvent } from './CoreAgentTimelineApi';

type AgentEntry = { id: string; title: string; subtitle: string; state: string;
  events: TimelineStep[]; kind: 'main' | 'subagent' | 'task'; parent?: string };
export type TimelineStep = { id: string; label: string; detail?: string; timestamp?: number;
  callId?: string; durationMs?: number;
  state: 'waiting' | 'running' | 'completed' | 'failed' | 'review' | 'info' };

const stateLabel: Record<string, string> = {
  queued: 'Queued', planning: 'Planning', running: 'Running', completed: 'Completed',
  failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted',
  reconcile_required: 'Needs reconciliation', awaiting_approval: 'Awaiting approval',
  succeeded: 'Succeeded', active: 'Active', idle: 'Idle',
};
function validTime(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return input < 1_000_000_000_000 ? input * 1000 : input;
  }
  if (typeof input === 'string' && input.trim()) {
    const parsed = Date.parse(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}
function statusState(raw: string): TimelineStep['state'] {
  const s = raw.toLowerCase();
  if (s === 'completed' || s === 'succeeded' || s === 'done') return 'completed';
  if (s === 'running' || s === 'active' || s === 'planning') return 'running';
  if (s === 'failed' || s === 'interrupted' || s === 'cancelled' || s === 'error') return 'failed';
  if (s === 'reconcile_required' || s === 'awaiting_approval') return 'review';
  return 'waiting';
}
export function buildAgentTimeline(
  messages: readonly ConsoleMessage[], subagents: readonly SubAgentItem[],
  drafts: readonly AssistantDraftTask[], pendingPermission: PendingPermission | null,
  unverifiedTaskIds: readonly string[] = [],
  taskEvents: readonly AssistantTaskTransitionEvent[] = [],
  coreEvents: readonly CoreAgentTimelineEvent[] = [],
): AgentEntry[] {
  const tools = messages.filter(m => m.role === 'tool');
  // Core journal is authoritative when available. Never merge/replay live tool
  // calls on top of persisted records; that would double-count execution.
  const mainJournal = coreEvents.filter(e => e.actor === 'main').sort((a, b) => a.seq - b.seq);
  const starts = new Map<string, number>();
  for (const event of [...coreEvents].sort((a, b) => a.seq - b.seq)) {
    if (event.kind === 'tool_start' && event.callId) starts.set(event.actor + ':' + event.callId, event.at);
  }
  const elapsed = (event: CoreAgentTimelineEvent) => {
    if (event.kind !== 'tool_end' || !event.callId) return undefined;
    const began = starts.get(event.actor + ':' + event.callId);
    return began === undefined ? undefined : Math.max(0, event.at - began);
  };
  const main: TimelineStep[] = mainJournal.length ? mainJournal.map(ev => ({
    id: 'core-' + ev.seq,
    label: ev.kind === 'tool_start' ? 'Tool started · ' + (ev.tool || 'tool') :
      ev.kind === 'tool_end' ? 'Tool finished · ' + (ev.tool || 'tool') :
      ev.kind === 'permission_requested' ? 'Approval requested · ' + (ev.tool || 'tool') :
      ev.kind === 'permission_decided' ? 'Approval decision · ' + (stateLabel[ev.status || ''] || ev.status || 'unknown') :
      'Agent turn completed',
    detail: 'Core event #' + ev.seq + ' · metadata only' +
      (elapsed(ev) !== undefined ? ' · ' + elapsed(ev) + 'ms' : ''),
    callId: ev.callId, durationMs: elapsed(ev),
    timestamp: validTime(ev.at),
    state: ev.kind === 'permission_requested' ? 'review' :
      ev.kind === 'tool_start' ? 'running' :
      ev.kind === 'permission_decided' && ev.status === 'denied' ? 'failed' :
      ev.kind === 'tool_end' && ev.status === 'failed' ? 'failed' : 'completed',
  })) : tools.slice(-60).map((m, i) => ({
    id: 'tool-' + i, label: m.toolName || 'Tool action',
    detail: m.result === undefined ? 'Execution reported; result not yet confirmed' :
      'Result observed in this chat session',
    state: m.result === undefined ? 'running' : 'completed',
  }));
  if (pendingPermission) main.push({
    id: 'approval-' + pendingPermission.permissionId,
    label: 'Approval required · ' + String(pendingPermission.toolCall?.name || pendingPermission.toolCall?.toolName || 'Tool action').slice(0, 90),
    detail: 'Execution paused until you explicitly approve or deny this request',
    state: 'review',
  });
  const agents: AgentEntry[] = [{
    id: 'main', title: 'Main Agent',
    subtitle: mainJournal.length ? 'Core execution journal · source timestamps' : 'Current chat · live tool actions',
    state: pendingPermission ? 'awaiting_approval' :
      tools.some(message => message.result === undefined) ? 'running' : 'idle',
    events: main, kind: 'main',
  }];
  for (const sa of subagents.slice(0, 40)) {
    if (!sa.id || typeof sa.id !== 'string') continue;
    const events: TimelineStep[] = [];
    if (sa.startedAt) events.push({ id: 'started', label: 'Agent started',
      timestamp: validTime(sa.startedAt), state: 'completed' });
    if (sa.prompt) events.push({ id: 'assigned', label: 'Instruction received',
      detail: sa.prompt.slice(0, 180), state: 'info' });
    for (let i = 0; i < Math.min(sa.logs?.length || 0, 35); i++) {
      // Logs are evidence strings, not verified tool-step envelopes. Do not invent timestamps.
      const line = String(sa.logs?.[i] || '').trim();
      if (!line) continue;
      events.push({ id: 'log-' + i, label: 'Log entry ' + (i + 1),
        detail: line.slice(0, 220), state: 'info' });
    }
    const state = String(sa.status || 'unknown').toLowerCase();
    if (sa.result) events.push({ id: 'result', label: 'Result reported',
      detail: String(sa.result).slice(0, 220), state: 'info' });
    if (sa.completedAt) events.push({ id: 'finished', label: stateLabel[state] || state,
      timestamp: validTime(sa.completedAt), state: statusState(state) });
    if (!sa.completedAt) events.push({ id: 'status', label: 'Current status: ' + (stateLabel[state] || state),
      state: statusState(state) });
    agents.push({ id: 'sub:' + sa.id, kind: 'subagent', title: sa.role || sa.typeName || 'Subagent',
      subtitle: sa.id, state, events });
  }
  // Stable hashed agent identity is safe for durable storage. Historical
  // subagents intentionally do not expose prompts, logs or original IDs.
  const historicalAgents = new Map<string, CoreAgentTimelineEvent[]>();
  for (const ev of coreEvents) {
    if (!ev.actor.startsWith('sub:')) continue;
    const events = historicalAgents.get(ev.actor) || [];
    events.push(ev);
    historicalAgents.set(ev.actor, events);
  }
  for (const [actor, history] of historicalAgents) {
    const ordered = [...history].sort((a, b) => a.seq - b.seq);
    const status = ordered[ordered.length - 1]?.status || 'unknown';
    agents.push({
      id: 'history:' + actor, kind: 'subagent', title: 'Subagent history · ' + actor.slice(4, 12),
      subtitle: 'Durable Core metadata · private ID hashed', state: status,
      parent: ordered.find(ev => ev.parent)?.parent,
      events: ordered.map(ev => ({
        id: 'core-' + ev.seq,
        label: ev.kind === 'tool_start' ? 'Tool started · ' + (ev.tool || 'tool') :
          ev.kind === 'tool_end' ? 'Tool finished · ' + (ev.tool || 'tool') :
          'Subagent: ' + (stateLabel[ev.status || ''] || ev.status || 'unknown'),
        detail: 'Core event #' + ev.seq + ' · metadata only' +
          (elapsed(ev) !== undefined ? ' · ' + elapsed(ev) + 'ms' : ''),
        callId: ev.callId, durationMs: elapsed(ev),
        timestamp: validTime(ev.at), state: statusState(ev.status || 'unknown'),
      })),
    });
  }
  const unverified = new Set(unverifiedTaskIds);
  for (const task of drafts.slice(0, 60)) {
    const status = unverified.has(task.taskId) ? 'reconcile_required' : task.status;
    const created = validTime(task.createdAt);
    const updated = validTime(task.updatedAt);
    const journal = taskEvents.filter(ev => ev.taskId === task.taskId).sort((a, b) => a.seq - b.seq);
    const events: TimelineStep[] = journal.length ? journal.map(ev => ({
      id: 'journal-' + ev.seq,
      label: ev.status === 'queued' ? 'Task queued' : 'Transition: ' + (stateLabel[ev.status] || ev.status),
      detail: 'Recorded by Core · revision ' + ev.revision,
      timestamp: validTime(ev.at), state: statusState(ev.status),
    })) : [{ id: 'draft', label: 'Task created', timestamp: created, state: 'completed' }];
    if (unverified.has(task.taskId)) {
      events.push({ id: 'unverified', label: 'Running worker not verified',
        detail: 'Review before reconciliation; no tool calls will be replayed', state: 'review' });
    } else if (journal.length === 0 && (status !== 'queued' || (created && updated && updated !== created))) {
      events.push({ id: 'status', label: 'Latest observed status: ' + (stateLabel[status] || status),
        detail: 'Snapshot state, not a reconstructed execution history',
        timestamp: updated, state: statusState(status) });
    }
    agents.push({ id: 'task:' + task.taskId, kind: 'task', title: task.title,
      subtitle: (task.domain || 'analysis') + ' · ' + task.taskId.slice(0, 8),
      state: status, events });
  }
  return agents;
}

export function AgentExecutionTimeline({ messages, subagents, drafts, pendingPermission,
  unverifiedTaskIds, taskEvents, coreEvents, onPermissionDecision, connected = true,
  approvalSubmitting = false, approvalFeedback = '', onTaskControl, onOpenTaskPanel, taskControlBusy = false }: {
  messages: readonly ConsoleMessage[]; subagents: readonly SubAgentItem[];
  drafts: readonly AssistantDraftTask[]; pendingPermission?: PendingPermission | null;
  unverifiedTaskIds?: readonly string[]; taskEvents?: readonly AssistantTaskTransitionEvent[];
  coreEvents?: readonly CoreAgentTimelineEvent[];
  onPermissionDecision?: (decision: boolean | 'session' | 'always') => void;
  connected?: boolean; approvalSubmitting?: boolean; approvalFeedback?: string;
  onTaskControl?: (task: AssistantDraftTask, action: 'cancel' | 'reconcile') => void;
  onOpenTaskPanel?: () => void; taskControlBusy?: boolean;
}) {
  const [selected, setSelected] = useState('main');
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all'|'main'|'subagent'|'task'>('all');
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'review'|'completed'|'failed'>('all');
  const agents = useMemo(() => buildAgentTimeline(messages, subagents, drafts,
    pendingPermission || null, unverifiedTaskIds || [], taskEvents || [], coreEvents || []),
  [messages, subagents, drafts, pendingPermission, unverifiedTaskIds, taskEvents, coreEvents]);
  useEffect(() => { if (!agents.some(a => a.id === selected)) setSelected('main'); },
    [agents, selected]);
  useEffect(() => { if (pendingPermission) setSelected('main'); },
    [pendingPermission?.permissionId]);
  const focus = agents.find(a => a.id === selected) || agents[0];
  const matching = agents.filter(a => {
    const term = search.trim().toLowerCase();
    const searchable = !term || [a.title, a.subtitle, ...a.events.map(step => step.label)]
      .some(part => part.toLowerCase().includes(term));
    const status = statusState(a.state);
    const accepted = statusFilter === 'all' ||
      (statusFilter === 'active' && (status === 'running' || status === 'waiting')) ||
      (statusFilter === 'review' && status === 'review') ||
      (statusFilter === 'completed' && status === 'completed') ||
      (statusFilter === 'failed' && status === 'failed');
    return searchable && accepted && (kindFilter === 'all' || a.kind === kindFilter);
  });
  const displayed = showAll ? focus.events : focus.events.slice(-30);
  const selectedTask = drafts.find(task => focus.id === 'task:' + task.taskId);
  const canCancel = selectedTask && ['queued','running','planning'].includes(selectedTask.status);
  const canReconcile = selectedTask && (selectedTask.status === 'interrupted' ||
    (unverifiedTaskIds || []).includes(selectedTask.taskId));
  const recordedTools = (coreEvents || []).filter(event => event.kind === 'tool_end').length;
  const starts = new Map((coreEvents || []).filter(e => e.kind === 'tool_start' && e.callId)
    .map(e => [e.actor + ':' + e.callId, e.at]));
  const durations = (coreEvents || []).filter(e => e.kind === 'tool_end' && e.callId &&
    starts.has(e.actor + ':' + e.callId)).map(e =>
      e.at - (starts.get(e.actor + ':' + e.callId) ?? e.at));
  return (
    <section aria-label="Per-agent execution timeline" className="max-h-[55vh] overflow-y-auto px-3 sm:px-4 py-3">
      <div className="mx-auto max-w-4xl space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-main)]">Agent timeline</h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Per-agent evidence and actions · tool approval uses the live Core request
            </p>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">{agents.length} agents/tasks</span>
        </div>
        <div aria-label="Agent dashboard" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { title: 'Agents / tasks', count: agents.length },
            { title: 'Active', count: agents.filter(a => ['running','waiting'].includes(statusState(a.state))).length },
            { title: 'Needs review', count: agents.filter(a => statusState(a.state) === 'review').length },
            { title: 'Recorded tools', count: recordedTools },
          ].map(item => (
            <div key={item.title} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] p-2.5">
              <p className="text-[10px] text-[var(--text-muted)]">{item.title}</p>
              <p className="text-lg font-semibold tabular-nums">{item.count}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">
          {durations.length ? 'Mean observed tool duration: ' +
            Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) + 'ms' :
            'Tool duration unavailable until matching start/end events exist'}
          {' · '}Token usage is not included in this metadata journal.
        </p>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Search agents and actions" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search agents or tools" className="min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-xs"/>
          <select aria-label="Agent type filter" value={kindFilter}
            onChange={e => setKindFilter(e.target.value as typeof kindFilter)}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-2 text-xs">
            <option value="all">All sources</option><option value="main">Main</option>
            <option value="subagent">Subagents</option><option value="task">Tasks</option>
          </select>
          <select aria-label="Agent status filter" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-2 text-xs">
            <option value="all">All status</option><option value="active">Active</option>
            <option value="review">Needs review</option><option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        {pendingPermission && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
            <ShieldAlert size={16} aria-hidden="true"/> Action pending approval · Main Agent
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(150px,0.85fr)_minmax(0,2fr)] gap-3">
          <nav aria-label="Agents" className="flex gap-1.5 overflow-x-auto sm:flex-col sm:overflow-y-auto sm:max-h-[40vh] pb-1">
            {matching.map(agent => (
              <button type="button" key={agent.id} aria-pressed={focus.id === agent.id}
                onClick={() => { setSelected(agent.id); setShowAll(false); }}
                className={'min-w-[130px] sm:min-w-0 w-full shrink-0 sm:shrink rounded-lg border p-2.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ' +
                  (focus.id === agent.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)]' :
                    'border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)]')}>
                <div className={'flex items-center gap-1.5 ' + (agent.parent ? 'pl-3' : '')}>
                  {agent.parent && <span aria-hidden="true" className="text-[var(--text-muted)]">↳</span>}
                  {agent.kind === 'task' ? <Layers3 size={14}/> : <Bot size={14}/>}
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium" title={agent.title}>{agent.title}</span>
                </div>
                <div className="mt-1 text-[10px] text-[var(--text-muted)] capitalize truncate">
                  {stateLabel[agent.state] || agent.state.replace(/_/g, ' ')}
                </div>
              </button>
            ))}
            {matching.length === 0 && <p className="text-xs text-[var(--text-muted)]">
              No agents match the current filters.
            </p>}
          </nav>
          <div className="min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] p-3">
            <div className="flex items-start justify-between gap-2 border-b border-[var(--border-color)] pb-2">
              <div className="min-w-0">
                <h4 className="text-xs font-semibold break-words">{focus.title}</h4>
                <p className="text-[10px] text-[var(--text-muted)] break-all">{focus.subtitle}</p>
              </div>
              <span className="shrink-0 rounded-md bg-[var(--bg-card)] px-2 py-1 text-[10px] text-[var(--text-muted)] capitalize">
                {stateLabel[focus.state] || focus.state.replace(/_/g, ' ')}
              </span>
            </div>
            <ol aria-label={'Timeline for ' + focus.title} className="mt-3 space-y-1 border-l border-[var(--border-color)] ml-2">
              {displayed.map(step => (
                <li key={step.id} className="relative pl-4 pb-3 text-xs">
                  <span className={'absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-main)] ' +
                    (step.state === 'review' || step.state === 'failed' ? 'bg-amber-400' :
                      step.state === 'running' ? 'bg-[var(--color-primary)]' :
                      step.state === 'completed' ? 'bg-emerald-500' : 'bg-[var(--text-muted)]')}/>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--text-main)] break-words">{step.label}</span>
                    {step.timestamp && <time className="text-[10px] text-[var(--text-muted)]"
                      dateTime={new Date(step.timestamp).toISOString()}>
                      {new Date(step.timestamp).toLocaleString()}
                    </time>}
                  </div>
                  {step.detail && <p className="mt-1 whitespace-pre-wrap break-words text-[11px] text-[var(--text-muted)]">
                    {step.detail}
                  </p>}
                </li>
              ))}
            </ol>
            {focus.events.length === 0 && <p className="text-xs text-[var(--text-muted)] py-4">
              No recorded tool actions in this chat yet.
            </p>}
            {focus.events.length > 30 && <button type="button" onClick={() => setShowAll(value => !value)}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)]">
              {showAll ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
              {showAll ? 'Show recent steps' : 'Show all recorded steps'}
            </button>}
            {selectedTask && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-color)] pt-3">
                {canCancel && <button type="button" disabled={taskControlBusy || !onTaskControl}
                  onClick={() => onTaskControl?.(selectedTask, 'cancel')}
                  className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-400 disabled:opacity-40">
                  Request cancel
                </button>}
                {canReconcile && <button type="button" disabled={taskControlBusy || !onTaskControl}
                  onClick={() => onTaskControl?.(selectedTask, 'reconcile')}
                  className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs disabled:opacity-40">
                  Reconcile orphan
                </button>}
                <button type="button" onClick={onOpenTaskPanel}
                  disabled={!onOpenTaskPanel}
                  className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs disabled:opacity-40">
                  Review task actions
                </button>
                <p className="w-full text-[10px] text-[var(--text-muted)]">
                  Running workers cannot be paused or resumed without a verified execution checkpoint.
                  Unstarted draft Pause/Resume and manual Retry-as-Draft are available in Task Actions.
                  Cancellation is a request, not proof the worker has exited.
                </p>
              </div>
            )}
            {focus.id === 'main' && pendingPermission && (
              <div className="mt-3 border-t border-[var(--border-color)] pt-3">
                {connected && onPermissionDecision ? (
                  <PermissionCard pendingPermission={pendingPermission}
                    submitting={approvalSubmitting} feedback={approvalFeedback}
                    handlePermissionDecision={onPermissionDecision}/>
                ) : (
                  <p role="alert" className="flex gap-2 text-xs text-amber-400">
                    <AlertTriangle size={14}/> Connection unavailable. Approval disabled until Core reconnects.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <p className="flex items-start gap-1.5 text-[10px] text-[var(--text-muted)]">
          <Clock3 size={12} className="shrink-0"/>
          Timestamps appear only when provided by the source. Older subagent logs and tool steps may be partial.
          Approval is never inferred from a timeline item.
        </p>
      </div>
    </section>
  );
}
