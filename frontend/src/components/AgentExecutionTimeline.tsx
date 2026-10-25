import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, ChevronDown, ChevronRight,
  Clock3, ShieldAlert, Layers3 } from 'lucide-react';
import { PermissionCard, type PendingPermission } from './SuperAgentInteractiveCards';
import type { SubAgentItem } from './SubAgentTerminalModal';
import type { ConsoleMessage } from './SuperAgentMessageItem';
import type { AssistantDraftTask, AssistantTaskTransitionEvent } from './AssistantTaskDraftApi';

type AgentEntry = { id: string; title: string; subtitle: string; state: string;
  events: TimelineStep[]; kind: 'main' | 'subagent' | 'task' };
export type TimelineStep = { id: string; label: string; detail?: string; timestamp?: number;
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
): AgentEntry[] {
  const tools = messages.filter(m => m.role === 'tool');
  const main: TimelineStep[] = tools.slice(-60).map((m, i) => ({
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
    id: 'main', title: 'Main Agent', subtitle: 'Current chat · recorded tool actions',
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
  unverifiedTaskIds, taskEvents, onPermissionDecision, connected = true }: {
  messages: readonly ConsoleMessage[]; subagents: readonly SubAgentItem[];
  drafts: readonly AssistantDraftTask[]; pendingPermission?: PendingPermission | null;
  unverifiedTaskIds?: readonly string[]; taskEvents?: readonly AssistantTaskTransitionEvent[];
  onPermissionDecision?: (decision: boolean | 'session' | 'always') => void;
  connected?: boolean;
}) {
  const [selected, setSelected] = useState('main');
  const [showAll, setShowAll] = useState(false);
  const agents = useMemo(() => buildAgentTimeline(messages, subagents, drafts,
    pendingPermission || null, unverifiedTaskIds || [], taskEvents || []),
  [messages, subagents, drafts, pendingPermission, unverifiedTaskIds, taskEvents]);
  useEffect(() => { if (!agents.some(a => a.id === selected)) setSelected('main'); },
    [agents, selected]);
  useEffect(() => { if (pendingPermission) setSelected('main'); },
    [pendingPermission?.permissionId]);
  const focus = agents.find(a => a.id === selected) || agents[0];
  const displayed = showAll ? focus.events : focus.events.slice(-30);
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
        {pendingPermission && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
            <ShieldAlert size={16} aria-hidden="true"/> Action pending approval · Main Agent
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(150px,0.85fr)_minmax(0,2fr)] gap-3">
          <nav aria-label="Agents" className="flex gap-1.5 overflow-x-auto sm:flex-col sm:overflow-y-auto sm:max-h-[40vh] pb-1">
            {agents.map(agent => (
              <button type="button" key={agent.id} aria-pressed={focus.id === agent.id}
                onClick={() => { setSelected(agent.id); setShowAll(false); }}
                className={'min-w-[130px] sm:min-w-0 w-full shrink-0 sm:shrink rounded-lg border p-2.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ' +
                  (focus.id === agent.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)]' :
                    'border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)]')}>
                <div className="flex items-center gap-1.5">
                  {agent.kind === 'task' ? <Layers3 size={14}/> : <Bot size={14}/>}
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium" title={agent.title}>{agent.title}</span>
                </div>
                <div className="mt-1 text-[10px] text-[var(--text-muted)] capitalize truncate">
                  {stateLabel[agent.state] || agent.state.replace(/_/g, ' ')}
                </div>
              </button>
            ))}
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
            {focus.id === 'main' && pendingPermission && (
              <div className="mt-3 border-t border-[var(--border-color)] pt-3">
                {connected && onPermissionDecision ? (
                  <PermissionCard pendingPermission={pendingPermission}
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
