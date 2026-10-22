import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, ShieldCheck, Users } from 'lucide-react';

type AgentSession = { key: string; agentId: string; targetId: string; port: number; expiresAt: number; claimedAt: number };
type Queue = { resourceKey: string; waiting: number; oldestWaitMs: number; locked: boolean };
type GatewayState = {
  ok: boolean;
  sessions: AgentSession[];
  queues: Queue[];
  summary: { activeAgents: number; activeTabs: number; queued: number; extensionBlocked: boolean };
};

/** Read-only local browser coordinator monitor. Never fetches or displays session tokens. */
export default function BrowserAgentSessions({ active }: { active: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<GatewayState | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/superagent/browser/sessions', { signal, credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) throw new Error('Unable to read browser sessions');
      const next: GatewayState = await res.json();
      if (!signal?.aborted) { setData(next); setError(''); }
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Browser session status unavailable');
    }
  }, []);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    const id = setInterval(() => void refresh(controller.signal), 5000);
    return () => { controller.abort(); clearInterval(id); };
  }, [active, refresh]);
  if (!active) return null;
  const count = data?.summary.activeTabs ?? 0;
  return (
    <div className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] text-xs">
      <button
        type="button"
        aria-label="Toggle browser agent sessions"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-main)] text-left"
      >
        <ShieldCheck size={14} className={count ? 'text-emerald-400' : 'text-[var(--text-muted)]'} />
        <span className="font-semibold">Browser agent sessions</span>
        <span className="rounded bg-[var(--bg-main)] px-1.5 py-0.5 tabular-nums">{count} tabs</span>
        <span className="text-[var(--text-muted)]">{data?.summary.queued ?? 0} waiting</span>
        {data?.summary.extensionBlocked && <span className="text-amber-400">Extension gated</span>}
        {error && <span className="text-red-400">Status unavailable</span>}
        <span className="ml-auto text-[var(--text-muted)]">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {expanded && (
        <div className="max-h-52 overflow-auto border-t border-[var(--border-color)] px-3 py-2" aria-label="Browser session details">
          <div className="flex items-center justify-between pb-2">
            <span className="inline-flex items-center gap-1 text-[var(--text-muted)]"><Users size={12} /> {data?.summary.activeAgents ?? 0} agent(s) • isolated Chrome CDP targets</span>
            <button aria-label="Refresh browser sessions" title="Refresh" onClick={() => void refresh()} className="rounded p-1 hover:bg-[var(--bg-main)]"><RefreshCw size={13}/></button>
          </div>
          {error && <p className="text-red-400">{error}</p>}
          {!data?.sessions.length && !error && <p className="text-[var(--text-muted)]">No active CDP claims. Extension controls are available.</p>}
          {data?.sessions.map(session => (
            <div key={session.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-[var(--border-color)] py-1.5">
              <div className="min-w-0">
                <div className="truncate font-semibold" title={session.agentId}>{session.agentId}</div>
                <div className="font-mono text-[10px] text-[var(--text-muted)]">:{session.port} / {session.targetId.slice(0, 12)}…</div>
              </div>
              <div className="self-center text-[var(--text-muted)] tabular-nums">
                {Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000))}s lease
              </div>
            </div>
          ))}
          {data?.queues.filter(q => q.waiting || q.locked).map(queue => (
            <div key={queue.resourceKey} className="border-t border-[var(--border-color)] pt-1 text-[var(--text-muted)]">
              Queue {queue.resourceKey.slice(0, 8)}…: {queue.waiting} waiting {queue.locked ? '• busy' : ''}
              {queue.waiting > 0 ? ` • oldest ${Math.ceil(queue.oldestWaitMs / 1000)}s` : ''}
            </div>
          ))}
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">Read-only status. Release a tab with its owning agent's CDP session token.</p>
        </div>
      )}
    </div>
  );
}
