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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#1a1a20]">
      <div className="p-3 bg-[#121214] border-b border-[#2d2d34] flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-400">Interaction & Decision Logs</span>
        <div className="flex gap-2">
          <button
            onClick={fetchAuditLogs}
            disabled={loadingAudit}
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded text-zinc-200 transition font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={clearAuditLogs}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 text-xs rounded text-red-200 transition font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Logs
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {auditLogs.length === 0 ? (
          <div className="text-center text-zinc-500 py-10 select-none">
            No logs recorded yet. Start interacting with SuperAgent to generate audit logs.
          </div>
        ) : (
          auditLogs.map((log, index) => (
            <div key={index} className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80">
              <div className="flex items-center justify-between mb-1.5 select-none">
                <span className="text-[10px] text-zinc-500">{new Date(log.timestamp).toLocaleString()}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  log.type === 'prompt' ? 'bg-indigo-950 text-indigo-300 border border-indigo-900/60' :
                  log.type === 'agent_event' ? 'bg-amber-950 text-amber-300 border border-amber-900/60' :
                  log.type === 'system' ? 'bg-zinc-950 text-zinc-400 border border-zinc-900/60' :
                  'bg-emerald-950 text-emerald-300 border border-emerald-900/60'
                }`}>
                  {log.type.toUpperCase()}
                </span>
              </div>
              <pre className="text-zinc-300 overflow-x-auto max-h-60 overflow-y-auto p-1 bg-black/20 rounded">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
