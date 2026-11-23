import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Layers,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  GitBranch,
  ShieldCheck,
  Zap,
  RefreshCw,
  Terminal,
  Network,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

export interface HostStripData {
  effectiveSlots: number;
  maxSlots: number;
  configuredSlots: number;
  pressure: 'none' | 'moderate' | 'high' | 'critical';
  cpuUsagePercent: number;
  freeMemPercent: number;
  totalMemBytes: number;
  activeJobCount: number;
  queuedJobCount: number;
}

export interface SlotData {
  index: number;
  state: string;
  jobId?: string;
  ownerPid: number | null;
  childPid: number | null;
}

export interface JobData {
  jobId: string;
  cliAlias: string;
  status: string;
  completionState?: string;
  pid: number | null;
  capacitySlot?: number;
  startedAt: number;
  updatedAt: number;
  elapsedMs: number;
  outputTail: string;
  expectedArtifacts?: string[];
  roleProfile?: string;
  worktreePath?: string;
  priority?: string | number;
  resourceClass?: string;
}

export interface DagNodeData {
  id: string;
  roleId?: string;
  prompt: string;
  cliAlias?: string;
  dependencies: string[];
  status: 'pending' | 'ready' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
  jobId?: string;
  result?: {
    outputTail?: string;
    verificationState?: string;
    verdict?: string;
    verdictReason?: string;
    error?: string;
    winner?: boolean;
  };
}

export interface DagGraphData {
  graphId: string;
  name: string;
  workspaceRoot: string;
  maxFanOut: number;
  failFast: boolean;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  nodes: Record<string, DagNodeData>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface OrchestrationMetricsData {
  totalJobs: number;
  successCount: number;
  verifiedCount: number;
  failedCount: number;
  verificationFailedCount: number;
  averageDurationMs: number;
  successRate: number;
  verifiedRate: number;
}

interface CliBridgeOrchestrationDashboardProps {
  workspacePath?: string;
  token?: string;
  onClose?: () => void;
}

export function CliBridgeOrchestrationDashboard({
  workspacePath,
  token,
  onClose,
}: CliBridgeOrchestrationDashboardProps) {
  const [hostStrip, setHostStrip] = useState<HostStripData | null>(null);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [dags, setDags] = useState<DagGraphData[]>([]);
  const [selectedDagId, setSelectedDagId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<OrchestrationMetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [filterJobTab, setFilterJobTab] = useState<'all' | 'active' | 'queued' | 'completed'>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const getHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      h.Authorization = `Bearer ${token}`;
    }
    return h;
  }, [token]);

  const fetchStatus = useCallback(async () => {
    try {
      const q = workspacePath ? `?workspace=${encodeURIComponent(workspacePath)}` : '';
      const [resStatus, resMetrics, resDags] = await Promise.all([
        fetch(`/api/orchestration/status${q}`, { headers: getHeaders() }),
        fetch(`/api/orchestration/metrics${q}`, { headers: getHeaders() }),
        fetch(`/api/orchestration/dags${q}`, { headers: getHeaders() }),
      ]);

      if (resStatus.ok) {
        const data = await resStatus.json();
        if (data.hostStrip) setHostStrip(data.hostStrip);
        if (data.slots) setSlots(data.slots);
        if (data.jobs) setJobs(data.jobs);
      }

      if (resMetrics.ok) {
        const data = await resMetrics.json();
        if (data.metrics) setMetrics(data.metrics);
      }

      if (resDags.ok) {
        const data = await resDags.json();
        if (data.dags) {
          setDags(data.dags);
          if (!selectedDagId && data.dags.length > 0) {
            setSelectedDagId(data.dags[0].graphId);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch orchestration status:', err);
    }
  }, [workspacePath, getHeaders, selectedDagId]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await fetchStatus();
    setIsLoading(false);
  }, [fetchStatus]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStatus, 2500);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  const handleCancelDag = async (graphId: string) => {
    try {
      const q = workspacePath ? `?workspace=${encodeURIComponent(workspacePath)}` : '';
      const res = await fetch(`/api/orchestration/dag/cancel${q}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ graphId, workspaceRoot: workspacePath }),
      });
      if (res.ok) {
        setActionNotice(`Cancelled DAG ${graphId}`);
        setTimeout(() => setActionNotice(null), 3000);
        await fetchStatus();
      }
    } catch (err: any) {
      setActionNotice(`Error cancelling DAG: ${err.message}`);
    }
  };

  const handleCreateDemoDag = async () => {
    try {
      setIsLoading(true);
      const q = workspacePath ? `?workspace=${encodeURIComponent(workspacePath)}` : '';
      const res = await fetch(`/api/orchestration/dag${q}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: `Pipeline-${Date.now().toString().slice(-4)}`,
          workspaceRoot: workspacePath,
          maxFanOut: 4,
          failFast: true,
          nodes: [
            {
              id: 'plan-1',
              roleId: 'architect',
              prompt: 'Formulate implementation plan',
              cliAlias: 'agy',
            },
            {
              id: 'code-1',
              roleId: 'coder',
              prompt: 'Implement feature in isolated worktree',
              cliAlias: 'agy',
              dependencies: ['plan-1'],
              worktree: true,
            },
            {
              id: 'test-1',
              roleId: 'tester',
              prompt: 'Execute verification suite',
              cliAlias: 'agy',
              dependencies: ['code-1'],
            },
          ],
        }),
      });
      if (res.ok) {
        const created = await res.json();
        if (created.dag?.graphId) {
          setSelectedDagId(created.dag.graphId);
          setActionNotice(`Started DAG ${created.dag.graphId}`);
          setTimeout(() => setActionNotice(null), 3000);
        }
        await fetchStatus();
      }
    } catch (err: any) {
      setActionNotice(`Failed to create demo DAG: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDag = dags.find((d) => d.graphId === selectedDagId) || dags[0];

  const filteredJobs = jobs.filter((j) => {
    if (filterJobTab === 'active') return j.status === 'starting' || j.status === 'running';
    if (filterJobTab === 'queued') return j.status === 'queued';
    if (filterJobTab === 'completed') return j.status !== 'starting' && j.status !== 'running' && j.status !== 'queued';
    return true;
  });

  const getPressureBadge = (pressure: string) => {
    switch (pressure) {
      case 'none':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">None</span>;
      case 'moderate':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Moderate</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">High</span>;
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">Critical</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--r-ui-color-surface-elevated)] text-[var(--r-ui-color-text-secondary)]">Normal</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
      case 'starting':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1"><Zap size={11} className="animate-spin" /> {status}</span>;
      case 'queued':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 flex items-center gap-1"><Clock size={11} /> queued</span>;
      case 'succeeded':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><CheckCircle2 size={11} /> succeeded</span>;
      case 'failed':
      case 'verification_failed':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1"><XCircle size={11} /> {status}</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--r-ui-color-surface-elevated)] text-[var(--r-ui-color-text-secondary)] border border-[var(--r-ui-color-border-subtle)] flex items-center gap-1"><Square size={11} /> cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--r-ui-color-surface-elevated)] text-[var(--r-ui-color-text-secondary)]">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--r-ui-color-canvas,var(--bg-main))] text-[var(--r-ui-color-text-primary,var(--text-main))] overflow-y-auto select-none font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--r-ui-color-border-subtle,var(--border-color))] bg-[var(--r-ui-color-surface,var(--bg-card))] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--r-ui-color-accent-primary,var(--color-primary))]/10 text-[var(--r-ui-color-accent-primary,var(--color-primary))] border border-[var(--r-ui-color-accent-primary,var(--color-primary))]/20">
            <Network size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-[var(--r-ui-color-text-primary,var(--text-main))] tracking-wide flex items-center gap-2">
              Multi-Agent Orchestration Engine
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-[var(--r-ui-color-surface-elevated,var(--bg-card-hover))] text-[var(--r-ui-color-text-secondary,var(--text-muted))] rounded border border-[var(--r-ui-color-border-subtle,var(--border-color))]">M1–M6 Live</span>
            </h1>
            <p className="text-xs text-[var(--r-ui-color-text-secondary,var(--text-muted))] mt-0.5">
              Dynamic 2–8 slots, adaptive backpressure, isolated worktrees & durable DAG workflows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actionNotice && (
            <div className="px-3 py-1 text-xs rounded bg-[var(--r-ui-color-accent-primary,var(--color-primary))]/20 text-[var(--r-ui-color-accent-primary,var(--color-primary))] border border-[var(--r-ui-color-accent-primary,var(--color-primary))]/30 animate-fade-in">
              {actionNotice}
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-[var(--r-ui-color-text-secondary,var(--text-muted))] cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-[var(--r-ui-color-surface-elevated,var(--bg-card-hover))] border-[var(--r-ui-color-border-standard,var(--border-color))] text-[var(--r-ui-color-accent-primary,var(--color-primary))] focus:ring-0"
            />
            Auto-refresh (2.5s)
          </label>

          <button
            onClick={refreshAll}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--r-ui-color-surface-elevated,var(--bg-card-hover))] hover:bg-[var(--surface-overlay-hover)] text-[var(--r-ui-color-text-primary,var(--text-main))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] transition-colors"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--r-ui-color-surface-elevated,var(--bg-card-hover))] hover:bg-[var(--surface-overlay-hover)] text-[var(--r-ui-color-text-secondary,var(--text-muted))] border border-[var(--r-ui-color-border-subtle,var(--border-color))]"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* Section 1: Host Resource & Dynamic Capacity Strip */}
        <div className="bg-[var(--r-ui-color-surface,var(--bg-card))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-[var(--r-ui-color-accent-primary,var(--color-primary))]" />
              <h2 className="text-sm font-bold text-[var(--r-ui-color-text-primary,var(--text-main))] tracking-wide uppercase">Host Capacity & Resource Sampler</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--r-ui-color-text-secondary,var(--text-muted))]">Pressure:</span>
              {getPressureBadge(hostStrip?.pressure || 'none')}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Dynamic Slots */}
            <div className="bg-[var(--r-ui-color-canvas,var(--bg-main))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] rounded-lg p-3.5">
              <div className="text-xs text-[var(--r-ui-color-text-secondary,var(--text-muted))] flex items-center justify-between">
                <span>Effective Capacity</span>
                <span className="font-mono text-[var(--r-ui-color-accent-primary,var(--color-primary))]">{hostStrip?.effectiveSlots || 4} / {hostStrip?.maxSlots || 8}</span>
              </div>
              <div className="text-xl font-bold text-[var(--r-ui-color-text-primary,var(--text-main))] font-mono mt-1">
                {hostStrip?.effectiveSlots || 4} <span className="text-xs text-[var(--r-ui-color-text-tertiary,var(--text-dark))] font-sans">slots</span>
              </div>
              <div className="w-full bg-[var(--r-ui-color-surface-elevated,var(--bg-card-hover))] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[var(--r-ui-color-accent-primary,var(--color-primary))] h-full rounded-full transition-all duration-300"
                  style={{ width: `${((hostStrip?.effectiveSlots || 4) / (hostStrip?.maxSlots || 8)) * 100}%` }}
                />
              </div>
            </div>

            {/* Active & Queued */}
            <div className="bg-[var(--r-ui-color-canvas,var(--bg-main))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] rounded-lg p-3.5">
              <div className="text-xs text-[var(--r-ui-color-text-secondary,var(--text-muted))] flex items-center justify-between">
                <span>Active / Queued</span>
                <span className="font-mono text-emerald-400">{hostStrip?.activeJobCount || 0} active</span>
              </div>
              <div className="text-xl font-bold text-[var(--r-ui-color-text-primary,var(--text-main))] font-mono mt-1">
                {hostStrip?.activeJobCount || 0} <span className="text-xs text-[var(--r-ui-color-text-tertiary,var(--text-dark))] font-sans">run</span> / {hostStrip?.queuedJobCount || 0} <span className="text-xs text-[var(--r-ui-color-text-tertiary,var(--text-dark))] font-sans">queue</span>
              </div>
              <div className="text-[11px] text-[var(--r-ui-color-text-tertiary,var(--text-dark))] mt-2">
                Durable priority admission active
              </div>
            </div>

            {/* CPU Usage */}
            <div className="bg-[var(--r-ui-color-canvas,var(--bg-main))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] rounded-lg p-3.5">
              <div className="text-xs text-[var(--r-ui-color-text-secondary,var(--text-muted))] flex items-center justify-between">
                <span>CPU Utilization</span>
                <span className="font-mono">{hostStrip?.cpuUsagePercent || 0}%</span>
              </div>
              <div className="text-xl font-bold text-[var(--r-ui-color-text-primary,var(--text-main))] font-mono mt-1">
                {hostStrip?.cpuUsagePercent || 0}%
              </div>
              <div className="w-full bg-[var(--r-ui-color-surface-elevated,var(--bg-card-hover))] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    (hostStrip?.cpuUsagePercent || 0) > 85 ? 'bg-rose-500' : (hostStrip?.cpuUsagePercent || 0) > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, hostStrip?.cpuUsagePercent || 0)}%` }}
                />
              </div>
            </div>

            {/* Memory Free */}
            <div className="bg-[var(--r-ui-color-canvas,var(--bg-main))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] rounded-lg p-3.5">
              <div className="text-xs text-[var(--r-ui-color-text-secondary,var(--text-muted))] flex items-center justify-between">
                <span>Memory Available</span>
                <span className="font-mono">{hostStrip?.freeMemPercent || 0}% free</span>
              </div>
              <div className="text-xl font-bold text-[var(--r-ui-color-text-primary,var(--text-main))] font-mono mt-1">
                {hostStrip?.freeMemPercent || 0}%
              </div>
              <div className="w-full bg-[var(--r-ui-color-surface-elevated,var(--bg-card-hover))] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, hostStrip?.freeMemPercent || 0)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Slot Visualizer Cards */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Active Host Slots ({slots.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {slots.map((s) => {
                const isOccupied = s.state.includes('active') || s.state.includes('alive');
                return (
                  <div
                    key={s.index}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      isOccupied
                        ? 'bg-[var(--r-ui-color-accent-primary)]/10 border-[var(--r-ui-color-accent-primary)]/30 text-[var(--r-ui-color-accent-primary)]'
                        : 'bg-[var(--r-ui-color-canvas,var(--bg-main))] border-[var(--r-ui-color-border-subtle,var(--border-color))] text-[var(--r-ui-color-text-tertiary,var(--text-dark))]'
                    }`}
                  >
                    <div className="text-[10px] font-mono uppercase text-[var(--r-ui-color-text-secondary,var(--text-muted))]">Slot {s.index}</div>
                    <div className="text-xs font-bold mt-1 truncate">
                      {isOccupied ? 'Occupied' : 'Available'}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--r-ui-color-text-secondary,var(--text-muted))] mt-1 truncate">
                      {s.jobId ? s.jobId.slice(0, 8) : '—'}
                    </div>
                    <div className="text-[9px] text-[var(--r-ui-color-text-tertiary,var(--text-dark))] mt-0.5">
                      PID: {s.childPid || s.ownerPid || 'none'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 2: Priority Queue & Delegate Jobs Table */}
        <div className="bg-[var(--r-ui-color-surface,var(--bg-card))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-emerald-400" />
              <h2 className="text-sm font-bold text-[var(--r-ui-color-text-primary,var(--text-main))] tracking-wide uppercase">Delegate Jobs & Priority Queue</h2>
            </div>

            <div className="flex items-center gap-1 bg-[var(--r-ui-color-canvas,var(--bg-main))] p-1 rounded-lg border border-[var(--r-ui-color-border-subtle,var(--border-color))]">
              {(['all', 'active', 'queued', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterJobTab(tab)}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    filterJobTab === tab
                      ? 'bg-[var(--r-ui-color-surface-elevated,var(--bg-card-hover))] text-[var(--r-ui-color-text-primary,var(--text-main))] shadow-sm'
                      : 'text-[var(--r-ui-color-text-secondary,var(--text-muted))] hover:text-[var(--r-ui-color-text-primary,var(--text-main))]'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No jobs matching filter '{filterJobTab}'.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filteredJobs.map((j) => {
                const isExpanded = expandedJobId === j.jobId;
                return (
                  <div key={j.jobId} className="py-3 first:pt-0 last:pb-0">
                    <div
                      className="flex items-center justify-between cursor-pointer hover:bg-[var(--surface-overlay-hover)] p-2 rounded-lg transition-colors"
                      onClick={() => setExpandedJobId(isExpanded ? null : j.jobId)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-[var(--r-ui-color-text-secondary,var(--text-muted))] hover:text-[var(--r-ui-color-text-primary,var(--text-main))]">
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[var(--r-ui-color-text-primary,var(--text-main))]">{j.jobId}</span>
                            <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono font-bold bg-[var(--r-ui-color-surface-elevated,var(--bg-card-hover))] text-[var(--r-ui-color-text-primary,var(--text-main))] rounded border border-[var(--r-ui-color-border-subtle,var(--border-color))]">
                              {j.cliAlias}
                            </span>
                            {j.roleProfile && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--color-primary-glow)] text-[var(--color-primary)] rounded border border-[var(--color-primary)]/20">
                                {j.roleProfile}
                              </span>
                            )}
                            {getStatusBadge(j.status)}
                            {j.completionState && (
                              <span
                                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${
                                  j.completionState === 'verified' || j.completionState === 'artifacts_verified'
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                    : 'bg-[var(--r-ui-color-surface-elevated,var(--bg-card))] text-[var(--r-ui-color-text-secondary,var(--text-muted))] border-[var(--r-ui-color-border-subtle,var(--border-color))]'
                                }`}
                              >
                                {j.completionState}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--r-ui-color-text-secondary,var(--text-muted))] mt-1 flex items-center gap-3">
                            <span>Elapsed: {Math.round(j.elapsedMs / 1000)}s</span>
                            {j.capacitySlot !== undefined && <span>Slot: {j.capacitySlot}</span>}
                            {j.pid && <span>PID: {j.pid}</span>}
                            {j.worktreePath && (
                              <span className="flex items-center gap-1 text-[var(--r-ui-color-accent-primary,var(--color-primary))]">
                                <GitBranch size={11} /> Isolated worktree
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs text-[var(--r-ui-color-text-secondary,var(--text-muted))]">
                        {new Date(j.startedAt).toLocaleTimeString()}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 ml-7 p-3 bg-[var(--r-ui-color-canvas,var(--bg-main))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] rounded-lg text-xs space-y-2">
                        {j.expectedArtifacts && j.expectedArtifacts.length > 0 && (
                          <div>
                            <span className="text-[var(--r-ui-color-text-secondary,var(--text-muted))] font-semibold">Expected Artifacts: </span>
                            <span className="font-mono text-[var(--r-ui-color-text-primary,var(--text-main))]">{j.expectedArtifacts.join(', ')}</span>
                          </div>
                        )}
                        {j.worktreePath && (
                          <div>
                            <span className="text-[var(--r-ui-color-text-secondary,var(--text-muted))] font-semibold">Worktree Path: </span>
                            <span className="font-mono text-[var(--r-ui-color-text-primary,var(--text-main))]">{j.worktreePath}</span>
                          </div>
                        )}
                        <div>
                          <div className="text-[var(--r-ui-color-text-secondary,var(--text-muted))] font-semibold mb-1 flex items-center gap-1">
                            <Terminal size={12} /> Recent Output:
                          </div>
                          <pre className="p-2 bg-black/40 rounded border border-[var(--r-ui-color-border-subtle,var(--border-color))] font-mono text-[11px] text-[var(--r-ui-color-text-secondary,var(--text-muted))] max-h-40 overflow-y-auto whitespace-pre-wrap">
                            {j.outputTail || '(No output recorded yet)'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Durable DAG Workflow Orchestrator */}
        <div className="bg-[var(--r-ui-color-surface)] border border-[var(--r-ui-color-border-subtle)] rounded-xl p-5 shadow-[var(--r-ui-shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Network size={18} className="text-[var(--r-ui-color-accent-primary)]" />
              <h2 className="text-sm font-bold text-[var(--r-ui-color-text-primary)] tracking-wide uppercase">Durable Executable DAG Pipelines</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateDemoDag}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--r-ui-color-accent-primary)] hover:opacity-90 text-[var(--r-ui-color-text-inverse)] transition-opacity"
              >
                <Play size={12} />
                Trigger 3-Tier DAG
              </button>
            </div>
          </div>

          {dags.length === 0 ? (
            <div className="text-center py-8 text-[var(--r-ui-color-text-tertiary)] text-xs">
              No DAG workflows recorded in this workspace. Click "Trigger 3-Tier DAG" to launch one.
            </div>
          ) : (
            <div>
              {/* DAG Selector Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 border-b border-[var(--r-ui-color-border-subtle)]">
                {dags.map((d) => (
                  <button
                    key={d.graphId}
                    onClick={() => setSelectedDagId(d.graphId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition-all ${
                      selectedDag?.graphId === d.graphId
                        ? 'bg-[var(--r-ui-color-accent-subtle)] border-[var(--r-ui-color-accent-primary)]/40 text-[var(--r-ui-color-accent-primary)]'
                        : 'bg-[var(--r-ui-color-canvas)] border-[var(--r-ui-color-border-subtle)] text-[var(--r-ui-color-text-secondary)] hover:text-[var(--r-ui-color-text-primary)]'
                    }`}
                  >
                    <span>{d.name}</span>
                    {getStatusBadge(d.status)}
                  </button>
                ))}
              </div>

              {selectedDag && (
                <div className="bg-[var(--r-ui-color-canvas)] border border-[var(--r-ui-color-border-subtle)] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-[var(--r-ui-color-border-subtle)]">
                    <div>
                      <div className="text-sm font-bold text-[var(--r-ui-color-text-primary)] flex items-center gap-2">
                        {selectedDag.name}
                        <span className="font-mono text-xs text-[var(--r-ui-color-text-secondary)]">({selectedDag.graphId})</span>
                      </div>
                      <div className="text-xs text-[var(--r-ui-color-text-secondary)] mt-0.5">
                        Max fan-out: {selectedDag.maxFanOut} | Fail-fast: {selectedDag.failFast ? 'enabled' : 'disabled'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedDag.status === 'running' && (
                        <button
                          onClick={() => handleCancelDag(selectedDag.graphId)}
                          className="px-2.5 py-1 text-xs font-medium rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                        >
                          Cancel Pipeline
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DAG Node Graph Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.values(selectedDag.nodes).map((node) => (
                      <div
                        key={node.id}
                        className="bg-[var(--r-ui-color-surface)] border border-[var(--r-ui-color-border-subtle)] rounded-lg p-3.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs font-bold text-[var(--r-ui-color-text-primary)]">{node.id}</span>
                            {getStatusBadge(node.status)}
                          </div>
                          {node.roleId && (
                            <div className="text-[11px] text-[var(--r-ui-color-accent-primary)] font-mono mb-1">
                              Role: {node.roleId}
                            </div>
                          )}
                          <div className="text-xs text-[var(--r-ui-color-text-secondary)] line-clamp-2 mb-2">
                            {node.prompt}
                          </div>
                          {node.dependencies.length > 0 && (
                            <div className="text-[10px] text-[var(--r-ui-color-text-secondary)] flex items-center gap-1">
                              <span>Depends on:</span>
                              {node.dependencies.map((dep) => (
                                <span key={dep} className="px-1 bg-[var(--r-ui-color-surface-elevated)] rounded text-[var(--r-ui-color-text-primary)] font-mono">
                                  {dep}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {node.result && (
                          <div className="mt-3 pt-2 border-t border-[var(--r-ui-color-border-subtle)] text-[11px]">
                            {node.result.verdict && (
                              <div className="text-[var(--r-ui-color-accent-primary)] font-semibold">
                                Verdict: {node.result.verdict}
                              </div>
                            )}
                            {node.result.error && (
                              <div className="text-rose-400 truncate">
                                Error: {node.result.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 4: Performance & Quality Metrics */}
        {metrics && (
          <div className="bg-[var(--r-ui-color-surface)] border border-[var(--r-ui-color-border-subtle)] rounded-xl p-5 shadow-[var(--r-ui-shadow-sm)]">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={18} className="text-amber-400" />
              <h2 className="text-sm font-bold text-[var(--r-ui-color-text-primary)] tracking-wide uppercase">Quality & Verification Metrics</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[var(--r-ui-color-canvas)] p-3 rounded-lg border border-[var(--r-ui-color-border-subtle)]">
                <div className="text-xs text-[var(--r-ui-color-text-secondary)]">Total Delegations</div>
                <div className="text-xl font-bold text-[var(--r-ui-color-text-primary)] font-mono mt-1">{metrics.totalJobs}</div>
              </div>
              <div className="bg-[var(--r-ui-color-canvas)] p-3 rounded-lg border border-[var(--r-ui-color-border-subtle)]">
                <div className="text-xs text-[var(--r-ui-color-text-secondary)]">Success Rate</div>
                <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{metrics.successRate * 100}%</div>
              </div>
              <div className="bg-[var(--r-ui-color-canvas)] p-3 rounded-lg border border-[var(--r-ui-color-border-subtle)]">
                <div className="text-xs text-[var(--r-ui-color-text-secondary)]">Verified Rate</div>
                <div className="text-xl font-bold text-[var(--r-ui-color-accent-primary)] font-mono mt-1">{metrics.verifiedRate * 100}%</div>
              </div>
              <div className="bg-[var(--r-ui-color-canvas)] p-3 rounded-lg border border-[var(--r-ui-color-border-subtle)]">
                <div className="text-xs text-[var(--r-ui-color-text-secondary)]">Avg Duration</div>
                <div className="text-xl font-bold text-[var(--r-ui-color-text-primary)] font-mono mt-1">{Math.round(metrics.averageDurationMs / 1000)}s</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default CliBridgeOrchestrationDashboard;
