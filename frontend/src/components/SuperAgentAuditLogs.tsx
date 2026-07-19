import { useState, useEffect } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

interface AuditLog {
  timestamp: string;
  type: string;
  data: any;
}

interface SuperAgentAuditLogsProps {
  getAuthHeader: () => Record<string, string>;
}

export function SuperAgentAuditLogs({ getAuthHeader }: SuperAgentAuditLogsProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const response = await fetch('/api/superagent/audit-logs', {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  const clearAuditLogs = async () => {
    if (!confirm('Are you sure you want to clear the audit logs?')) return;
    try {
      const response = await fetch('/api/superagent/audit-logs', {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (response.ok) {
        setAuditLogs([]);
      }
    } catch (e) {
      console.error('Failed to clear audit logs:', e);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = auditLogs.filter(log => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return log.type.toLowerCase().includes(q) || JSON.stringify(log.data).toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#05070c] h-full">
      <div className="p-3 bg-[#090c14] border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-zinc-300 tracking-wide">Interaction & Decision Audit Logs</span>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter logs by type or text..."
            className="bg-[#121622] border border-zinc-700/60 rounded-md px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono w-56 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAuditLogs}
            disabled={loadingAudit}
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800/80 hover:bg-zinc-700 active:translate-y-0.5 text-xs rounded-md text-zinc-200 transition font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={clearAuditLogs}
            className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/40 hover:bg-rose-900/50 active:translate-y-0.5 border border-rose-800/60 text-xs rounded-md text-rose-200 transition font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-rose-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Logs
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-zinc-500 py-12 select-none">
            {auditLogs.length === 0 ? "No logs recorded yet. Start interacting with SuperAgent to generate audit logs." : "No logs matching filter."}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className="p-3.5 bg-[#0e121d] rounded-xl border border-zinc-800/80 shadow-sm transition hover:border-zinc-700/80">
              <div className="flex items-center justify-between mb-2 select-none">
                <span className="text-[10px] text-zinc-500 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${
                  log.type === 'prompt' ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/60' :
                  log.type === 'agent_event' ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60' :
                  log.type === 'system' ? 'bg-zinc-900 text-zinc-400 border border-zinc-700/60' :
                  'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                }`}>
                  {log.type.toUpperCase()}
                </span>
              </div>
              <pre className="text-zinc-300 overflow-x-auto max-h-64 overflow-y-auto p-2.5 bg-[#05070c] border border-zinc-800/60 rounded-lg text-[11px] leading-relaxed">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
