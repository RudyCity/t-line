import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { fetchTlineTaskSnapshot, type TlineTask } from './SuperAgentTaskSnapshot';
import { checkTaskSseCapability, readTaskSseStream } from './SuperAgentTaskEvents';
import { getTaskCancelCapability, requestTaskCancellation } from './SuperAgentTaskControls';
import { getTaskRetryCapability, requestTaskRetry } from './SuperAgentTaskRetry';
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
  const [cancelAllowed, setCancelAllowed] = useState(false);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const [retryBusy, setRetryBusy] = useState('');
  const [retryNotice, setRetryNotice] = useState('');
  const [cancelBusy, setCancelBusy] = useState('');
  const [cancelNotice, setCancelNotice] = useState('');

  useEffect(() => {
    setCancelAllowed(false);
    setRetryAllowed(false);
    setRetryNotice('');
    setRetryBusy('');
    setCancelNotice('');
    setCancelBusy('');
    if (!open || !workspace || !sessionId) return;
    const abort = new AbortController();
    getTaskRetryCapability(workspace, getAuthHeader, fetch, abort.signal)
      .then(enabled => { if (!abort.signal.aborted) setRetryAllowed(enabled); })
      .catch(() => { if (!abort.signal.aborted) setRetryAllowed(false); });
    getTaskCancelCapability(workspace, getAuthHeader, fetch, abort.signal)
      .then(enabled => { if (!abort.signal.aborted) setCancelAllowed(enabled); })
      .catch(() => { if (!abort.signal.aborted) setCancelAllowed(false); });
    return () => abort.abort();
  }, [open, workspace, sessionId, refreshKey]);

  const cancelTask = async (jobId: string) => {
    if (!cancelAllowed || cancelBusy || !workspace || !sessionId) return;
    if (!window.confirm('Request cancellation of CLI task ' + jobId +
      '? This may interrupt edits or leave partial artifacts.')) return;
    setCancelBusy(jobId);
    setCancelNotice('');
    try {
      setCancelNotice(await requestTaskCancellation(workspace, sessionId, jobId, getAuthHeader));
    } catch (e) {
      setCancelNotice('Cancellation denied: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setCancelBusy(''); }
  };

  const retryTask = async (jobId: string) => {
    if (!retryAllowed || retryBusy || cancelBusy || !workspace || !sessionId) return;
    const instruction = window.prompt('Enter a NEW instruction for this CLI task (not a replay of the old prompt):');
    if (instruction === null) return;
    setRetryBusy(jobId);
    setRetryNotice('');
    try {
      const outcome = await requestTaskRetry(
        workspace, sessionId, jobId, instruction, getAuthHeader,
        description => window.confirm(description));
      setRetryNotice(outcome);
    } catch (e) {
      setRetryNotice('Retry denied: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setRetryBusy(''); }
  };

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
            setReplayNotice(event.reason === 'restart-observation-gap'
              ? 'Recovered saved observations after restart; transitions while offline cannot be reconstructed.'
              : event.reason === 'ledger-unavailable'
                ? 'Live task updates still work, but disk event history is unavailable on this server.'
                : 'Task event source temporarily unavailable.');
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
    <div className="border-t border-[rgba(255,255,255,0.08)] bg-[#0c0e14] text-[11px] font-sans">
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#12141c] transition cursor-pointer">
        <Activity className="w-3.5 h-3.5 text-sky-400" />
        <span className="font-medium text-xs text-[#f8fafc]">Cross-channel tasks</span>
        <span className="text-[10px] text-[#64748b]">{open ? total + ' in workspace' : '(open monitor)'}</span>
        <span className="ml-auto text-[#64748b]">{open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 max-h-40 overflow-y-auto bg-[#090a0f] border-t border-[rgba(255,255,255,0.06)]" role="region" aria-label="Workspace task monitor">
          <div className="flex items-center justify-between text-[#64748b] my-1 text-[10px]">
            <span>{updated ? 'Last synced ' + new Date(updated).toLocaleTimeString() : 'Connecting…'} · {transport === 'sse' ? 'SSE live, bounded replay' : 'polling fallback 3.5s'}</span>
            <button type="button" onClick={() => setRefreshKey(value => value + 1)}
              aria-label="Refresh task monitor" title="Re-negotiate with active SuperAgent"
              className="px-1 py-0.5 hover:text-[#f8fafc] cursor-pointer"><RefreshCw className="w-3 h-3" /></button>
          </div>
          {error && <div className="text-amber-400 py-1" role="status">{error}</div>}
          {replayNotice && <div className="text-amber-400 py-1" role="status">{replayNotice}</div>}
          {cancelAllowed && <div className="text-[#64748b] py-0.5 text-[10px]">
            Workspace-operator CLI cancellation enabled. Only runtime-owned jobs can be stopped.
          </div>}
          {cancelNotice && <div className="text-amber-400 py-1" role="status">{cancelNotice}</div>}
          {retryNotice && <div className="text-amber-400 py-1" role="status">{retryNotice}</div>}
          {incomplete.length > 0 && <div className="text-amber-400 py-1">Partial snapshot: {incomplete.join(', ')} unavailable</div>}
          {!error && tasks.length === 0 && <div className="text-[#64748b] py-1 text-[11px]">No retained CLI, daemon, or Muse tasks in this workspace.</div>}
          {tasks.map(task => (
            <div key={task.channel + ':' + task.taskId}
              className="py-1 border-t border-[rgba(255,255,255,0.05)] flex gap-2 items-center text-[11px]">
              <span className="font-medium w-12 shrink-0 font-mono text-[#f8fafc]">{task.channel}</span>
              <span className="truncate flex-1 text-[#94a3b8]" title={task.taskId}>{task.taskId}</span>
              <span className="text-[#64748b] shrink-0 font-mono text-[10px]">{task.status}</span>
              <span className="text-[#64748b] shrink-0 font-mono text-[10px]" title="Status proof">{task.evidence}</span>
              {retryAllowed && task.channel === 'cli' && task.status === 'failed' &&
                task.retryEligible === true && (
                <button type="button" disabled={Boolean(retryBusy || cancelBusy)}
                  className="text-amber-400 hover:underline disabled:opacity-50 text-[10px]"
                  aria-label={'Retry task ' + task.taskId}
                  onClick={() => { void retryTask(task.taskId); }}>
                  {retryBusy === task.taskId ? 'Preparing…' : 'New attempt…'}
                </button>
              )}
              {cancelAllowed && task.channel === 'cli' && task.status === 'running' && task.cancelEligible === true && (
                <button type="button" disabled={Boolean(cancelBusy)}
                  className="text-amber-400 hover:underline disabled:opacity-50 text-[10px]"
                  aria-label={'Cancel task ' + task.taskId}
                  onClick={() => { void cancelTask(task.taskId); }}>
                  {cancelBusy === task.taskId ? 'Requesting…' : 'Cancel…'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
