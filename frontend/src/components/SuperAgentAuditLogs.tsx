import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  RefreshCw, Trash2, Search, Download, Copy, Check, ChevronDown, ChevronRight,
  ChevronLeft, ChevronsLeft, ChevronsRight,
  MessageSquare, ShieldCheck, Cpu, Bot, AlertTriangle, XCircle, FileText, Activity
} from 'lucide-react';

interface AuditLog {
  timestamp: string;
  type: string;
  data: any;
}

interface SuperAgentAuditLogsProps {
  getAuthHeader: () => Record<string, string>;
}

type FilterCategory = 'all' | 'prompts' | 'decisions' | 'agent' | 'system' | 'errors';

// Helper logic for log categorization & metadata
const isDecisionLog = (type: string) => 
  ['permission_response', 'question_response', 'plan_response'].includes(type);
const isErrorLog = (type: string) => 
  ['system_error', 'chat_response_error'].includes(type);
const isSystemLog = (type: string) => 
  ['system', 'abort_request'].includes(type);
const isAgentLog = (type: string) => 
  ['agent_event', 'chat_response'].includes(type);
const isPromptLog = (type: string) => 
  type === 'prompt';

const getLogMeta = (log: AuditLog) => {
  if (isErrorLog(log.type)) {
    return {
      label: 'ERROR',
      icon: XCircle,
      badgeStyle: 'bg-rose-950/60 text-rose-300 border-rose-800/80',
      borderStyle: 'border-l-rose-500',
    };
  }
  if (isPromptLog(log.type)) {
    return {
      label: 'PROMPT',
      icon: MessageSquare,
      badgeStyle: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80',
      borderStyle: 'border-l-cyan-500',
    };
  }
  if (isDecisionLog(log.type)) {
    return {
      label: 'DECISION',
      icon: ShieldCheck,
      badgeStyle: 'bg-purple-950/60 text-purple-300 border-purple-800/80',
      borderStyle: 'border-l-purple-500',
    };
  }
  if (isAgentLog(log.type)) {
    return {
      label: 'AGENT',
      icon: Bot,
      badgeStyle: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
      borderStyle: 'border-l-amber-500',
    };
  }
  return {
    label: 'SYSTEM',
    icon: Cpu,
    badgeStyle: 'bg-slate-900 text-slate-300 border-slate-700/80',
    borderStyle: 'border-l-slate-500',
  };
};

const renderSummary = (log: AuditLog) => {
  const d = log.data || {};
  if (log.type === 'prompt') {
    return (
      <div className="text-zinc-200 font-sans text-xs flex items-center gap-1.5 truncate">
        <span className="text-cyan-400 font-medium font-mono text-[11px]">Prompt:</span>
        <span className="truncate">{d.text || 'Empty prompt'}</span>
      </div>
    );
  }
  if (log.type === 'permission_response') {
    return (
      <div className="text-zinc-200 font-sans text-xs flex items-center gap-2">
        <span className="text-purple-400 font-mono font-medium text-[11px]">Permission:</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${d.approval ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80' : 'bg-rose-950 text-rose-300 border border-rose-800/80'}`}>
          {d.approval ? 'APPROVED' : 'DENIED'}
        </span>
        <span className="text-zinc-400 text-[11px] truncate font-mono">ID: {d.permissionId || 'N/A'}</span>
      </div>
    );
  }
  if (log.type === 'question_response') {
    return (
      <div className="text-zinc-200 font-sans text-xs flex items-center gap-1.5 truncate">
        <span className="text-purple-400 font-mono font-medium text-[11px]">User Answer:</span>
        <span className="truncate">{d.answer || JSON.stringify(d)}</span>
      </div>
    );
  }
  if (log.type === 'plan_response') {
    return (
      <div className="text-zinc-200 font-sans text-xs flex items-center gap-2">
        <span className="text-purple-400 font-mono font-medium text-[11px]">Plan Action:</span>
        <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/80 font-mono text-[10px] font-bold">{d.action}</span>
      </div>
    );
  }
  if (log.type === 'system_error' || log.type === 'chat_response_error') {
    return (
      <div className="text-rose-300 font-sans text-xs flex items-center gap-1.5 truncate font-medium">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
        <span className="truncate">{d.message || d.error || 'Unknown system error'}</span>
      </div>
    );
  }
  if (log.type === 'system') {
    return (
      <div className="text-zinc-300 font-sans text-xs flex items-center gap-1.5 truncate">
        <span>{d.message || 'System operation'}</span>
        {d.workspacePath && <span className="text-zinc-500 text-[10px] font-mono">({d.workspacePath})</span>}
      </div>
    );
  }
  if (log.type === 'agent_event') {
    const evtType = d.type || d.event || 'event';
    return (
      <div className="text-zinc-300 font-sans text-xs flex items-center gap-2 truncate">
        <span className="text-amber-400 font-mono text-[11px]">{evtType}</span>
        <span className="text-zinc-400 truncate text-[11px]">{d.name || d.tool || d.model || (typeof d === 'string' ? d : JSON.stringify(d))}</span>
      </div>
    );
  }
  return (
    <div className="text-zinc-300 font-mono text-xs truncate">
      {typeof d === 'string' ? d : JSON.stringify(d)}
    </div>
  );
};

// Isolated, Memoized Item Component for Instant UI Clicks
const AuditLogItem = React.memo(({ log }: { log: AuditLog }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'pretty' | 'json'>('pretty');
  const [copied, setCopied] = useState(false);

  const meta = getLogMeta(log);
  const Icon = meta.icon;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpand = () => setIsExpanded(prev => !prev);

  return (
    <div className={`bg-[#0d111a] rounded-xl border border-zinc-800/90 shadow-sm transition hover:border-zinc-700/80 border-l-4 ${meta.borderStyle} overflow-hidden`}>
      {/* Header Row */}
      <div 
        onClick={toggleExpand}
        className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-zinc-900/40 transition select-none"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button className="text-zinc-500 hover:text-zinc-300 flex-shrink-0">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <div className={`p-1.5 rounded-lg border flex-shrink-0 ${meta.badgeStyle}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            {renderSummary(log)}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-zinc-500 font-mono">
            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider border ${meta.badgeStyle}`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Collapsible Details Body */}
      {isExpanded && (
        <div className="border-t border-zinc-800/80 bg-[#06080e] p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pb-2 border-b border-zinc-800/60 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>Timestamp: {new Date(log.timestamp).toLocaleString()}</span>
              <span className="text-zinc-600">•</span>
              <span>Type: <strong className="text-zinc-200">{log.type}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md bg-zinc-900 p-0.5 border border-zinc-800 text-[10px]">
                <button
                  onClick={(e) => { e.stopPropagation(); setViewMode('pretty'); }}
                  className={`px-2 py-0.5 rounded transition ${viewMode === 'pretty' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Structured
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setViewMode('json'); }}
                  className={`px-2 py-0.5 rounded transition ${viewMode === 'json' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Raw JSON
                </button>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[10px] transition font-medium cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {viewMode === 'json' ? (
            <pre className="text-zinc-300 overflow-x-auto max-h-72 overflow-y-auto p-3 bg-[#030407] border border-zinc-800/80 rounded-lg text-[11px] font-mono leading-relaxed select-text">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          ) : (
            <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-lg p-3 text-xs font-mono space-y-2">
              {typeof log.data === 'object' && log.data !== null ? (
                Object.entries(log.data).map(([k, v]) => (
                  <div key={k} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 border-b border-zinc-800/40 last:border-0 pb-1.5 last:pb-0">
                    <span className="text-zinc-400 font-semibold text-[11px] min-w-[120px] shrink-0 text-cyan-400">{k}:</span>
                    <span className="text-zinc-200 break-all text-[11px] select-text">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-zinc-300">{String(log.data)}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export function SuperAgentAuditLogs({ getAuthHeader }: SuperAgentAuditLogsProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [category, setCategory] = useState<FilterCategory>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const response = await fetch('/api/superagent/audit-logs', {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data: AuditLog[] = await response.json();
        setAuditLogs(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoadingAudit(false);
    }
  }, [getAuthHeader]);

  const clearAuditLogs = async () => {
    if (!confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) return;
    try {
      const response = await fetch('/api/superagent/audit-logs', {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (response.ok) {
        setAuditLogs([]);
        setCurrentPage(1);
      }
    } catch (e) {
      console.error('Failed to clear audit logs:', e);
    }
  };

  const exportAuditLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `superagent-audit-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchAuditLogs();
    }, 3000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchAuditLogs]);

  // Reset page when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [category, filterQuery, pageSize]);

  const categoryCounts = useMemo(() => {
    let prompts = 0, decisions = 0, agent = 0, system = 0, errors = 0;
    auditLogs.forEach(log => {
      if (isPromptLog(log.type)) prompts++;
      else if (isDecisionLog(log.type)) decisions++;
      else if (isErrorLog(log.type)) errors++;
      else if (isAgentLog(log.type)) agent++;
      else if (isSystemLog(log.type)) system++;
    });
    return { all: auditLogs.length, prompts, decisions, agent, system, errors };
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (category === 'prompts' && !isPromptLog(log.type)) return false;
      if (category === 'decisions' && !isDecisionLog(log.type)) return false;
      if (category === 'agent' && !isAgentLog(log.type)) return false;
      if (category === 'system' && !isSystemLog(log.type)) return false;
      if (category === 'errors' && !isErrorLog(log.type)) return false;

      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return log.type.toLowerCase().includes(q) || 
        JSON.stringify(log.data).toLowerCase().includes(q) ||
        new Date(log.timestamp).toLocaleString().toLowerCase().includes(q);
    }).reverse(); // Most recent first
  }, [auditLogs, category, filterQuery]);

  // Paginated Slice
  const totalPages = useMemo(() => Math.ceil(filteredLogs.length / pageSize) || 1, [filteredLogs.length, pageSize]);
  
  const paginatedLogs = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const startRecordNum = filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecordNum = Math.min(currentPage * pageSize, filteredLogs.length);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07090e] h-full text-zinc-200 select-none">
      {/* Top Header Bar */}
      <div className="p-3.5 bg-[#0b0f19] border-b border-zinc-800/80 flex flex-col gap-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-zinc-100 tracking-wide flex items-center gap-2">
                SuperAgent Audit & Trace Intelligence
                {autoRefresh && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Live
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-zinc-400 font-mono">
                Decisions, commands, SSE streams & server events audit trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1 text-xs rounded-md border font-mono transition flex items-center gap-1.5 cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300 shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-poll
            </button>
            <button
              onClick={fetchAuditLogs}
              disabled={loadingAudit}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/60 text-xs rounded-md text-zinc-200 transition font-medium cursor-pointer focus:outline-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportAuditLogs}
              disabled={auditLogs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800/60 text-xs rounded-md text-indigo-200 transition font-medium cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
            <button
              onClick={clearAuditLogs}
              disabled={auditLogs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 text-xs rounded-md text-rose-200 transition font-medium cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Logs
            </button>
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-800/60">
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {(['all', 'prompts', 'decisions', 'agent', 'system', 'errors'] as FilterCategory[]).map(cat => {
              const count = categoryCounts[cat];
              const isActive = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono capitalize transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800/80'
                  }`}
                >
                  {cat}
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-indigo-700 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search audit trail..."
              className="bg-[#131926] border border-zinc-700/60 rounded-md pl-8 pr-3 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono w-full transition"
            />
            {filterQuery && (
              <button 
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1.5 text-zinc-400 hover:text-zinc-200 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Audit Timeline Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-sans">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center select-none">
            <FileText className="w-10 h-10 mb-3 opacity-30 text-zinc-400" />
            <p className="text-xs font-medium text-zinc-400">
              {auditLogs.length === 0 
                ? "No audit events recorded yet."
                : "No logs matching current filter or search query."}
            </p>
            <p className="text-[11px] text-zinc-600 mt-1 max-w-sm">
              {auditLogs.length === 0
                ? "Events will automatically appear here as you prompt SuperAgent, respond to permissions, or run commands."
                : "Try selecting another category or clearing the search query."}
            </p>
          </div>
        ) : (
          paginatedLogs.map((log, index) => (
            <AuditLogItem 
              key={`${log.timestamp}-${log.type}-${index}`} 
              log={log} 
            />
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {filteredLogs.length > 0 && (
        <div className="px-4 py-2.5 bg-[#0b0f19] border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-zinc-400 shadow-inner">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-zinc-200">{startRecordNum}</strong> - <strong className="text-zinc-200">{endRecordNum}</strong> of <strong className="text-zinc-200">{filteredLogs.length}</strong>
            </span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-zinc-500">Rows:</span>
              {[15, 25, 50, 100].map(sz => (
                <button
                  key={sz}
                  onClick={() => setPageSize(sz)}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                    pageSize === sz ? 'bg-indigo-600 text-white font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-800 rounded text-zinc-300 transition cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-800 rounded text-zinc-300 transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 text-zinc-300 font-semibold text-xs">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-800 rounded text-zinc-300 transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-800 rounded text-zinc-300 transition cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


