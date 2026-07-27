import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  RefreshCw, Trash2, Search, Download, Copy, Check, ChevronDown, ChevronRight,
  ChevronLeft, ChevronsLeft, ChevronsRight,
  MessageSquare, ShieldCheck, Cpu, Bot, AlertTriangle, XCircle, FileText, Activity,
  Calendar, Layers, Clock, TrendingUp
} from 'lucide-react';
import { ConfirmModal } from './Modals';

interface AuditLog {
  timestamp: string;
  type: string;
  data: any;
  workspace?: string;
}

interface AuditStats {
  totalLogs: number;
  byType: Record<string, number>;
  totalErrors: number;
  workspaces: string[];
  last24hCount: number;
}

interface SuperAgentAuditLogsProps {
  getAuthHeader: () => Record<string, string>;
}

type FilterCategory = 'all' | 'prompts' | 'decisions' | 'agent' | 'system' | 'errors';
type DateRangeOption = 'all' | 'today' | '24h' | '7d';
type PollInterval = 0 | 3000 | 5000 | 10000;

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
      badgeStyle: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
      borderStyle: 'border-l-rose-500',
    };
  }
  if (isPromptLog(log.type)) {
    return {
      label: 'PROMPT',
      icon: MessageSquare,
      badgeStyle: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
      borderStyle: 'border-l-cyan-500',
    };
  }
  if (isDecisionLog(log.type)) {
    return {
      label: 'DECISION',
      icon: ShieldCheck,
      badgeStyle: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
      borderStyle: 'border-l-purple-500',
    };
  }
  if (isAgentLog(log.type)) {
    return {
      label: 'AGENT',
      icon: Bot,
      badgeStyle: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      borderStyle: 'border-l-amber-500',
    };
  }
  return {
    label: 'SYSTEM',
    icon: Cpu,
    badgeStyle: 'bg-slate-500/15 text-[var(--text-muted)] border-slate-500/30',
    borderStyle: 'border-l-slate-500',
  };
};

const renderSummary = (log: AuditLog) => {
  const d = log.data || {};
  if (log.type === 'prompt') {
    return (
      <div className="text-[var(--text-main)] font-sans text-xs flex items-center gap-1.5 truncate">
        <span className="text-cyan-500 font-medium font-mono text-[11px]">Prompt:</span>
        <span className="truncate">{d.text || 'Empty prompt'}</span>
      </div>
    );
  }
  if (log.type === 'permission_response') {
    return (
      <div className="text-[var(--text-main)] font-sans text-xs flex items-center gap-2">
        <span className="text-purple-500 font-mono font-medium text-[11px]">Permission:</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${d.approval ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'}`}>
          {d.approval ? 'APPROVED' : 'DENIED'}
        </span>
        <span className="text-[var(--text-muted)] text-[11px] truncate font-mono">ID: {d.permissionId || 'N/A'}</span>
      </div>
    );
  }
  if (log.type === 'question_response') {
    return (
      <div className="text-[var(--text-main)] font-sans text-xs flex items-center gap-1.5 truncate">
        <span className="text-purple-500 font-mono font-medium text-[11px]">User Answer:</span>
        <span className="truncate">{d.answer || JSON.stringify(d)}</span>
      </div>
    );
  }
  if (log.type === 'plan_response') {
    return (
      <div className="text-[var(--text-main)] font-sans text-xs flex items-center gap-2">
        <span className="text-purple-500 font-mono font-medium text-[11px]">Plan Action:</span>
        <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-500 border border-purple-500/30 font-mono text-[10px] font-bold">{d.action}</span>
      </div>
    );
  }
  if (log.type === 'system_error' || log.type === 'chat_response_error') {
    return (
      <div className="text-rose-500 font-sans text-xs flex items-center gap-1.5 truncate font-medium">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
        <span className="truncate">{d.message || d.error || 'Unknown system error'}</span>
      </div>
    );
  }
  if (log.type === 'system') {
    return (
      <div className="text-[var(--text-muted)] font-sans text-xs flex items-center gap-1.5 truncate">
        <span>{d.message || 'System operation'}</span>
        {d.workspacePath && <span className="text-[var(--text-muted)] opacity-70 text-[10px] font-mono">({d.workspacePath})</span>}
      </div>
    );
  }
  if (log.type === 'agent_event') {
    const evtType = d.type || d.event || 'event';
    return (
      <div className="text-[var(--text-main)] font-sans text-xs flex items-center gap-2 truncate">
        <span className="text-amber-500 font-mono text-[11px]">{evtType}</span>
        <span className="text-[var(--text-muted)] truncate text-[11px]">{d.name || d.tool || d.model || (typeof d === 'string' ? d : JSON.stringify(d))}</span>
      </div>
    );
  }
  return (
    <div className="text-[var(--text-muted)] font-mono text-xs truncate">
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
    <div className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]  transition hover:border-[var(--color-primary)]/40 border-l-4 ${meta.borderStyle} overflow-hidden`}>
      {/* Header Row */}
      <div 
        onClick={toggleExpand}
        className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--surface-overlay-hover)] transition select-none"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button className="text-[var(--text-muted)] hover:text-[var(--text-main)] flex-shrink-0">
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
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider border ${meta.badgeStyle}`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Collapsible Details Body */}
      {isExpanded && (
        <div className="border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono pb-2 border-b border-[var(--border-color)] flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>Timestamp: {new Date(log.timestamp).toLocaleString()}</span>
              <span className="opacity-40">•</span>
              <span>Type: <strong className="text-[var(--text-main)]">{log.type}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md bg-[var(--bg-card)] p-0.5 border border-[var(--border-color)] text-[10px]">
                <button
                  onClick={(e) => { e.stopPropagation(); setViewMode('pretty'); }}
                  className={`px-2 py-0.5 rounded transition ${viewMode === 'pretty' ? 'bg-[var(--color-primary)] text-white font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                >
                  Structured
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setViewMode('json'); }}
                  className={`px-2 py-0.5 rounded transition ${viewMode === 'json' ? 'bg-[var(--color-primary)] text-white font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                >
                  Raw JSON
                </button>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] border border-[var(--border-color)] rounded text-[10px] transition font-medium cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {viewMode === 'json' ? (
            <pre className="text-[var(--text-main)] overflow-x-auto max-h-72 overflow-y-auto p-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-[11px] font-mono leading-relaxed select-text">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          ) : (
            <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg p-3 text-xs font-mono space-y-2">
              {typeof log.data === 'object' && log.data !== null ? (
                Object.entries(log.data).map(([k, v]) => (
                  <div key={k} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 border-b border-[var(--border-color)]/50 last:border-0 pb-1.5 last:pb-0">
                    <span className="text-cyan-500 font-semibold text-[11px] min-w-[120px] shrink-0">{k}:</span>
                    <span className="text-[var(--text-main)] break-all text-[11px] select-text">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[var(--text-main)]">{String(log.data)}</div>
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
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [category, setCategory] = useState<FilterCategory>('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [pollInterval, setPollInterval] = useState<PollInterval>(0);
  const [selectedWorkspace] = useState<string>('all');
  const [showClearLogsModal, setShowClearLogsModal] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch('/api/superagent/audit-logs', { headers: getAuthHeader() }),
        fetch('/api/superagent/audit-logs/stats', { headers: getAuthHeader() })
      ]);

      if (logsRes.ok) {
        const raw = await logsRes.json();
        const logsData: AuditLog[] = Array.isArray(raw) ? raw : (raw?.logs || []);
        setAuditLogs(logsData);
      }
      if (statsRes.ok) {
        const statsData: AuditStats = await statsRes.json();
        setStats(statsData);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs or stats:', e);
    } finally {
      setLoadingAudit(false);
    }
  }, [getAuthHeader]);

  const executeClearAuditLogs = async () => {
    try {
      const response = await fetch('/api/superagent/audit-logs', {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (response.ok) {
        setAuditLogs([]);
        setStats(null);
        setCurrentPage(1);
      }
    } catch (e) {
      console.error('Failed to clear audit logs:', e);
    }
  };

  const clearAuditLogs = () => {
    setShowClearLogsModal(true);
  };

  const exportAuditLogs = (format: 'json' | 'ndjson') => {
    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'json') {
      content = JSON.stringify(auditLogs, null, 2);
      filename = `superagent-audit-${new Date().toISOString().slice(0, 10)}.json`;
      mimeType = 'application/json';
    } else {
      content = auditLogs.map(l => JSON.stringify(l)).join('\n');
      filename = `superagent-audit-${new Date().toISOString().slice(0, 10)}.ndjson`;
      mimeType = 'application/x-ndjson';
    }

    const dataStr = `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => {
    if (!pollInterval) return;
    const timer = setInterval(() => {
      fetchAuditLogs();
    }, pollInterval);
    return () => clearInterval(timer);
  }, [pollInterval, fetchAuditLogs]);

  // Reset page when criteria changes
  useEffect(() => {
    setCurrentPage(1);
  }, [category, dateRange, selectedWorkspace, filterQuery, pageSize]);

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
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;

    return auditLogs.filter(log => {
      if (category === 'prompts' && !isPromptLog(log.type)) return false;
      if (category === 'decisions' && !isDecisionLog(log.type)) return false;
      if (category === 'agent' && !isAgentLog(log.type)) return false;
      if (category === 'system' && !isSystemLog(log.type)) return false;
      if (category === 'errors' && !isErrorLog(log.type)) return false;

      if (selectedWorkspace !== 'all') {
        const ws = log.workspace || log.data?.workspace || log.data?.workspacePath;
        if (ws !== selectedWorkspace) return false;
      }

      if (dateRange !== 'all') {
        const ts = new Date(log.timestamp).getTime();
        if (dateRange === '24h' && now - ts > oneDay) return false;
        if (dateRange === '7d' && now - ts > sevenDays) return false;
        if (dateRange === 'today') {
          const logDate = new Date(log.timestamp).toDateString();
          const todayDate = new Date().toDateString();
          if (logDate !== todayDate) return false;
        }
      }

      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return log.type.toLowerCase().includes(q) || 
        JSON.stringify(log.data).toLowerCase().includes(q) ||
        new Date(log.timestamp).toLocaleString().toLowerCase().includes(q);
    });
  }, [auditLogs, category, dateRange, selectedWorkspace, filterQuery]);

  // Paginated Slice
  const totalPages = useMemo(() => Math.ceil(filteredLogs.length / pageSize) || 1, [filteredLogs.length, pageSize]);
  
  const paginatedLogs = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const startRecordNum = filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecordNum = Math.min(currentPage * pageSize, filteredLogs.length);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-main)] h-full text-[var(--text-main)] select-none">
      {/* Top Header Bar */}
      <div className="p-3.5 bg-[var(--panel-header-bg)] border-b border-[var(--border-color)] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/20 rounded-lg text-[var(--color-primary)]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[var(--text-main)] tracking-wide flex items-center gap-2">
                SuperAgent Audit & Trace Intelligence
                {pollInterval > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Live ({pollInterval / 1000}s)
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-[var(--text-muted)] font-mono">
                Decisions, prompts, security permissions & telemetry audit trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto Poll Dropdown */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-2 py-1 text-xs">
              <Clock className="w-3 h-3 text-[var(--text-muted)]" />
              <select
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value) as PollInterval)}
                className="bg-transparent text-[var(--text-main)] text-xs font-mono focus:outline-none cursor-pointer"
              >
                <option value={0}>Poll: Off</option>
                <option value={3000}>Poll: 3s</option>
                <option value={5000}>Poll: 5s</option>
                <option value={10000}>Poll: 10s</option>
              </select>
            </div>

            <button
              onClick={fetchAuditLogs}
              disabled={loadingAudit}
              className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)] text-xs rounded-md text-[var(--text-main)] transition font-medium cursor-pointer focus:outline-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <div className="flex items-center rounded-md border border-[var(--color-primary)]/60 bg-[var(--color-primary-glow)] overflow-hidden">
              <button
                onClick={() => exportAuditLogs('json')}
                disabled={auditLogs.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--surface-overlay-hover)] transition font-medium cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                JSON
              </button>
              <button
                onClick={() => exportAuditLogs('ndjson')}
                disabled={auditLogs.length === 0}
                className="px-2 py-1 text-[11px] font-mono text-[var(--color-primary)] hover:bg-[var(--surface-overlay-hover)] border-l border-[var(--color-primary)]/30 transition cursor-pointer disabled:opacity-40"
              >
                NDJSON
              </button>
            </div>

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

        {/* Analytics Metric Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-[var(--border-color)]">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Total Logs</div>
              <div className="text-sm font-bold font-mono text-[var(--text-main)]">{stats?.totalLogs ?? auditLogs.length}</div>
            </div>
            <Layers className="w-4 h-4 text-cyan-500 opacity-60" />
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Last 24 Hours</div>
              <div className="text-sm font-bold font-mono text-emerald-400">{stats?.last24hCount ?? categoryCounts.all}</div>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-400 opacity-60" />
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Prompts</div>
              <div className="text-sm font-bold font-mono text-cyan-400">{categoryCounts.prompts}</div>
            </div>
            <MessageSquare className="w-4 h-4 text-cyan-400 opacity-60" />
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Decisions</div>
              <div className="text-sm font-bold font-mono text-purple-400">{categoryCounts.decisions}</div>
            </div>
            <ShieldCheck className="w-4 h-4 text-purple-400 opacity-60" />
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-2 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Errors</div>
              <div className="text-sm font-bold font-mono text-rose-400">{stats?.totalErrors ?? categoryCounts.errors}</div>
            </div>
            <XCircle className="w-4 h-4 text-rose-400 opacity-60" />
          </div>
        </div>

        {/* Filter Pills, Date Range & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[var(--border-color)]">
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
                      ? 'bg-[var(--color-primary)] text-white font-semibold'
                      : 'bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-muted)] border border-[var(--border-color)]'
                  }`}
                >
                  {cat}
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-[var(--color-primary-hover)] text-white' : 'bg-[var(--bg-sidebar)] text-[var(--text-muted)]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2 py-1 text-xs">
              <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
                className="bg-transparent text-[var(--text-main)] text-xs font-mono focus:outline-none cursor-pointer"
              >
                <option value="all">Time: All</option>
                <option value="today">Time: Today</option>
                <option value="24h">Time: 24 Hours</option>
                <option value="7d">Time: 7 Days</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search audit trail..."
                className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md pl-8 pr-3 py-1 text-xs text-[var(--text-main)] placeholder:[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)] font-mono w-full transition"
              />
              {filterQuery && (
                <button 
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2 top-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
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
        <div className="px-4 py-2.5 bg-[var(--panel-header-bg)] border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-[var(--text-main)]">{startRecordNum}</strong> - <strong className="text-[var(--text-main)]">{endRecordNum}</strong> of <strong className="text-[var(--text-main)]">{filteredLogs.length}</strong>
            </span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-[var(--text-muted)] opacity-70">Rows:</span>
              {[15, 25, 50, 100].map(sz => (
                <button
                  key={sz}
                  onClick={() => setPageSize(sz)}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                    pageSize === sz ? 'bg-[var(--color-primary)] text-white font-bold' : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]'
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
              className="p-1.5 bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] disabled:opacity-30 border border-[var(--border-color)] rounded text-[var(--text-main)] transition cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] disabled:opacity-30 border border-[var(--border-color)] rounded text-[var(--text-main)] transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 text-[var(--text-main)] font-semibold text-xs">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] disabled:opacity-30 border border-[var(--border-color)] rounded text-[var(--text-main)] transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] disabled:opacity-30 border border-[var(--border-color)] rounded text-[var(--text-main)] transition cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {showClearLogsModal && (
        <ConfirmModal
          show={showClearLogsModal}
          title="Clear Audit Logs"
          message="Are you sure you want to clear all audit logs? This action cannot be undone."
          confirmLabel="Clear Logs"
          variant="danger"
          onConfirm={() => {
            setShowClearLogsModal(false);
            executeClearAuditLogs();
          }}
          onCancel={() => setShowClearLogsModal(false)}
        />
      )}
    </div>
  );
}



