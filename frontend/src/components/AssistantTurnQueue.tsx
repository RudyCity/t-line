import { useEffect, useState } from 'react';
import { ListChecks, RefreshCw } from 'lucide-react';
import { getAuthHeader } from './SuperAgentConsoleUtils';
import {
  assistantTurnTotals, loadAssistantTurns, resumeAssistantTurns, type AssistantChatTurn,
} from './AssistantTurnApi';

/** Retained Core chat turns, separate from detached task journal and permissions. */
export function AssistantTurnQueue({ workspace, sessionId, embedded = false, visible = true }: {
  workspace: string; sessionId: string; embedded?: boolean; visible?: boolean;
}) {
  const [turns, setTurns] = useState<AssistantChatTurn[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setTurns([]); setMessage('');
  }, [workspace, sessionId]);
  useEffect(() => {
    if (!visible || !workspace || !sessionId) return;
    const controller = new AbortController();
    let disposed = false;
    let generation = 0;
    const refresh = async () => {
      const current = ++generation;
      try {
        const next = await loadAssistantTurns(workspace, sessionId, getAuthHeader, controller.signal);
        if (!disposed && current === generation) { setTurns(next); setMessage(''); }
      } catch (cause) {
        if (!disposed && !controller.signal.aborted && current === generation) {
          setMessage(cause instanceof Error ? cause.message : 'Assistant queue unavailable');
        }
      }
    };
    void refresh();
    const id = window.setInterval(() => { if (!document.hidden) void refresh(); }, 2500);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true; controller.abort(); window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [visible, workspace, sessionId, revision]);

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
    <section aria-label="Assistant execution queue" className={embedded ?
      'bg-[var(--bg-card)] text-xs' :
      'border-t border-[var(--border-color)] bg-[var(--bg-card)] text-[11px]'}>
      <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 text-[var(--text-muted)]">
        <ListChecks size={14} aria-hidden="true"/>
        {embedded ? (
          <span className="font-medium text-[var(--text-main)]">
            Chat messages · {counts.running} running · {counts.pending} waiting
          </span>
        ) : (
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}
            className="hover:text-[var(--text-main)]">
            Assistant queue · {counts.running} active · {counts.pending} pending
          </button>
        )}
        {counts.recoverable > 0 && (
          <button type="button" disabled={busy} onClick={() => { void recover(); }}
            className="rounded-md border border-amber-500/30 px-2 py-1 text-amber-400 hover:underline disabled:opacity-40">
            Resume {counts.recoverable} safe pending
          </button>
        )}
        <button type="button" onClick={() => setRevision(n => n + 1)}
          className="ml-auto rounded-md border border-[var(--border-color)] p-1.5"
          aria-label="Refresh assistant queue"><RefreshCw size={13}/></button>
      </div>
      {(embedded || expanded) && (
        <div className={embedded ? 'px-3 sm:px-4 pb-3 max-h-[48vh] overflow-y-auto' :
          'px-3 pb-2 max-h-32 overflow-y-auto'} role="region"
          aria-label="Assistant execution history">
          <div className="text-[var(--text-muted)] pb-1">
            Same-session messages execute in order. Other sessions can run independently.
          </div>
          {turns.length === 0 && <div className="rounded-lg border border-dashed border-[var(--border-color)] p-4 text-center text-[var(--text-muted)]">
            No retained turns.
          </div>}
          <div className={embedded ? 'grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2' : ''}>
            {turns.slice(0, 15).map(turn => (
              <article key={turn.turnId} className={embedded ?
                'rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] p-3' :
                'border-t border-[var(--border-color)]/40 py-1 flex gap-2'}>
                {embedded ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-[var(--text-muted)]" title={turn.turnId}>
                        Turn {turn.turnId.slice(0, 8)}
                      </span>
                      <span className={'rounded-full px-2 py-0.5 text-[10px] capitalize ' +
                        (turn.state === 'recoverable' || turn.state === 'interrupted' || turn.state === 'failed'
                          ? 'bg-amber-500/10 text-amber-400' :
                          turn.state === 'running' ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)]' :
                            'bg-[var(--bg-card)] text-[var(--text-muted)]')}>{turn.state}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                      {turn.state === 'recoverable' ? 'Never started · recoverable with approval' :
                        turn.state === 'queued' || turn.state === 'accepted' ? 'Waiting for current chat turn' :
                        turn.state === 'running' ? 'Current chat execution' :
                        turn.state === 'interrupted' ? 'Interrupted · no automatic replay' :
                        'Chat turn history'}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="truncate flex-1" title={turn.turnId}>{turn.turnId.slice(0, 8)}</span>
                    <span>{turn.state}</span>
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {message && <div className="px-3 pb-2 text-amber-400" role="status">{message}</div>}
    </section>
  );
}
