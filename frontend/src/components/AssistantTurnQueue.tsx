import { useEffect, useState } from 'react';
import { ListChecks, RefreshCw } from 'lucide-react';
import { getAuthHeader } from './SuperAgentConsoleUtils';
import {
  assistantTurnTotals, loadAssistantTurns, resumeAssistantTurns, type AssistantChatTurn,
} from './AssistantTurnApi';

/** Thin monitor for the real Core chat executor, not the separate planning drafts. */
export function AssistantTurnQueue({ workspace, sessionId }: { workspace: string; sessionId: string }) {
  const [turns, setTurns] = useState<AssistantChatTurn[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setTurns([]);
    setMessage('');
    if (!workspace || !sessionId) return;
    const controller = new AbortController();
    let disposed = false;
    const refresh = async () => {
      try {
        const next = await loadAssistantTurns(workspace, sessionId, getAuthHeader, controller.signal);
        if (!disposed) { setTurns(next); setMessage(''); }
      } catch (cause) {
        if (!disposed && !controller.signal.aborted) {
          setMessage(cause instanceof Error ? cause.message : 'Assistant queue unavailable');
        }
      }
    };
    void refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 2500);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true; controller.abort(); window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [workspace, sessionId, revision]);

  const counts = assistantTurnTotals(turns);
  const recover = async () => {
    if (busy || !counts.recoverable) return;
    if (!window.confirm('Resume only never-started queued messages? Already-running or interrupted tool operations will NOT be retried.')) return;
    setBusy(true);
    try {
      const resumed = await resumeAssistantTurns(workspace, sessionId, getAuthHeader);
      setMessage(resumed + ' queued message(s) resumed.');
      setRevision(n => n + 1);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Recovery request failed');
    } finally { setBusy(false); }
  };
  return (
    <section aria-label="Assistant execution queue"
      className="border-t border-[var(--border-color)] bg-[var(--bg-card)] text-[11px]">
      <div className="flex items-center gap-2 px-3 py-1.5 text-[var(--text-muted)]">
        <ListChecks size={14} />
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}
          className="hover:text-[var(--text-main)]">
          Assistant queue · {counts.running} active · {counts.pending} pending
        </button>
        {counts.recoverable > 0 && (
          <button type="button" disabled={busy} onClick={() => { void recover(); }}
            className="text-amber-400 hover:underline disabled:opacity-40">
            Resume {counts.recoverable} safe pending
          </button>
        )}
        <button type="button" onClick={() => setRevision(n => n + 1)}
          className="ml-auto" aria-label="Refresh assistant queue"><RefreshCw size={13}/></button>
      </div>
      {expanded && (
        <div className="px-3 pb-2 max-h-32 overflow-y-auto" role="region"
          aria-label="Assistant execution history">
          <div className="text-[var(--text-muted)] pb-1">
            Same-session messages execute in order. Other sessions can run independently.
          </div>
          {turns.length === 0 && <div className="text-[var(--text-muted)]">No retained turns.</div>}
          {turns.slice(0, 15).map(turn => (
            <div key={turn.turnId} className="border-t border-[var(--border-color)]/40 py-1 flex gap-2">
              <span className="truncate flex-1" title={turn.turnId}>{turn.turnId.slice(0, 8)}</span>
              <span>{turn.state}</span>
            </div>
          ))}
        </div>
      )}
      {message && <div className="px-3 pb-1 text-amber-400" role="status">{message}</div>}
    </section>
  );
}
