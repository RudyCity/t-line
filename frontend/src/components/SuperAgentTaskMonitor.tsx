import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { fetchTlineTaskSnapshot, type TlineTask } from './SuperAgentTaskSnapshot';
import { checkTaskSseCapability, readTaskSseStream } from './SuperAgentTaskEvents';
import { getAuthHeader } from './SuperAgentConsoleUtils';

type Props = { workspace: string; sessionId: string };

export function SuperAgentTaskMonitor({ workspace, sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<TlineTask[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<number | null>(null);
  const [incomplete, setIncomplete] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [transport, setTransport] = useState<'polling' | 'sse'>('polling');
  const [replayNotice, setReplayNotice] = useState('');

  useEffect(() => {
    // Scope observations to the current workspace and console session.
    setTasks([]);
    setTotal(0);
    setError('');
    setUpdated(null);
    setIncomplete([]);
    setTransport('polling');
    setReplayNotice('');
    if (!open || !workspace) return;
    const abort = new AbortController();
    let disposed = false;
    let pending = false;
    let cursor: string | undefined;
    let negotiated = false;
    let streaming = false;
    let lastEventId: string | undefined;
    let reconnectTimer: number | undefined;
    const refresh = async () => {
      if (pending || disposed || streaming || document.hidden) return;
      pending = true;
      try {
        const { snapshot } = await fetchTlineTaskSnapshot(workspace, getAuthHeader,
          { cursor, negotiated, signal: abort.signal });
        if (disposed) return;
        negotiated = true;
        cursor = snapshot.cursor;
        if (snapshot.changed && snapshot.tasks) setTasks(snapshot.tasks);
        setTotal(snapshot.total);
        setIncomplete(snapshot.incompleteSources);
        setUpdated(Date.now());
        setError('');
      } catch (cause) {
        if (disposed || abort.signal.aborted) return;
        negotiated = false; // Re-negotiate after a restart/reconnect.
        cursor = undefined;
        setError(cause instanceof Error ? cause.message : 'Task monitor disconnected.');
      } finally {
        pending = false;
      }
    };
    const startStream = async () => {
      if (disposed || !sessionId) return;
      try {
        await checkTaskSseCapability(workspace, getAuthHeader, fetch, abort.signal);
        if (disposed) return;
        streaming = true;
        setTransport('sse');
        await readTaskSseStream(workspace, sessionId, getAuthHeader, event => {
          if (disposed) return;
          if (event.type === 'snapshot') {
            lastEventId = event.id;
            cursor = event.snapshot.cursor;
            setTasks(event.snapshot.tasks || []);
            setTotal(event.snapshot.total);
            setIncomplete(event.snapshot.incompleteSources);
            setUpdated(Date.now());
            setError('');
          } else if (event.type === 'reset') {
            lastEventId = undefined;
            setReplayNotice(event.reason === 'initial-connection' ? '' :
              'Replay history unavailable; latest task state was resynchronized.');
          } else if (event.type === 'warning') {
            setReplayNotice('Task event source temporarily unavailable.');
          }
        }, { lastEventId, signal: abort.signal });
      } catch {
        // Older active SuperAgent or lost streaming connection: bounded polling fallback.
      } finally {
        if (!disposed) {
          streaming = false;
          negotiated = false;
          cursor = undefined;
          setTransport('polling');
          reconnectTimer = window.setTimeout(() => { void startStream(); }, 10000);
        }
      }
    };
    void refresh();
    void startStream();
    const interval = window.setInterval(() => { void refresh(); }, 3500);
    const visibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      abort.abort();
      window.clearInterval(interval);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [workspace, sessionId, open, refreshKey]);

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--bg-card)] text-[11px] font-sans">
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)]">
        <Activity className="w-3.5 h-3.5" />
        <span>Cross-channel tasks</span>
        <span className="opacity-70">{open ? total + ' in workspace' : '(open monitor)'}</span>
        <span className="ml-auto">{open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 max-h-40 overflow-y-auto" role="region" aria-label="Workspace task monitor">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span>{updated ? 'Last synced ' + new Date(updated).toLocaleTimeString() : 'Connecting…'} · {transport === 'sse' ? 'SSE live, bounded replay' : 'polling fallback 3.5s'}</span>
            <button type="button" onClick={() => setRefreshKey(value => value + 1)}
              aria-label="Refresh task monitor" title="Re-negotiate with active SuperAgent"
              className="px-1 py-0.5 hover:text-[var(--text-main)]"><RefreshCw className="w-3 h-3" /></button>
          </div>
          {error && <div className="text-amber-400 py-1" role="status">{error}</div>}
          {replayNotice && <div className="text-amber-400 py-1" role="status">{replayNotice}</div>}
          {incomplete.length > 0 && <div className="text-amber-400 py-1">Partial snapshot: {incomplete.join(', ')} unavailable</div>}
          {!error && tasks.length === 0 && <div className="text-[var(--text-muted)] py-1">No retained CLI, daemon, or Muse tasks in this workspace.</div>}
          {tasks.map(task => (
            <div key={task.channel + ':' + task.taskId}
              className="py-1 border-t border-[var(--border-color)]/40 flex gap-2 items-center">
              <span className="font-medium w-12 shrink-0">{task.channel}</span>
              <span className="truncate flex-1" title={task.taskId}>{task.taskId}</span>
              <span className="text-[var(--text-muted)] shrink-0">{task.status}</span>
              <span className="text-[var(--text-muted)] shrink-0" title="Status proof">{task.evidence}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
