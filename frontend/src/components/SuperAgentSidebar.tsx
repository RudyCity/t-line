import { useState } from 'react';
import { GitBranch, Activity, Cpu, RefreshCw, ChevronDown, ChevronRight, Terminal as TerminalIcon, FileCode } from 'lucide-react';
import { SubAgentItem } from './SubAgentTerminalModal';

export interface RecentChangeItem {
  path: string;
  type: 'modified' | 'added' | 'deleted' | 'untracked' | string;
  staged?: boolean;
}

export interface ProcessItem {
  pid: number;
  name: string;
  status: 'running' | 'idle' | 'stopped' | string;
  commandLine?: string;
}

interface SuperAgentSidebarProps {
  workspacePath?: string;
  getAuthHeader?: () => Record<string, string>;
  subagents: SubAgentItem[];
  procs: ProcessItem[];
  recentChanges: RecentChangeItem[];
  onSelectSubAgent: (subagent: SubAgentItem) => void;
  onRefreshData?: () => void;
  isLoadingData?: boolean;
}

export function SuperAgentSidebar({
  subagents = [],
  procs = [],
  recentChanges = [],
  onSelectSubAgent,
  onRefreshData,
  isLoadingData = false
}: SuperAgentSidebarProps) {
  const [openSections, setOpenSections] = useState<{
    changes: boolean;
    procs: boolean;
    subagents: boolean;
  }>({
    changes: true,
    procs: true,
    subagents: true
  });

  const toggleSection = (section: 'changes' | 'procs' | 'subagents') => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getChangeBadge = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'modified' || t === 'm') return <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/60 px-1 py-0.2 rounded border border-amber-800/40">M</span>;
    if (t === 'added' || t === 'a') return <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-800/40">A</span>;
    if (t === 'deleted' || t === 'd') return <span className="text-[9px] font-mono font-bold text-red-400 bg-red-950/60 px-1 py-0.2 rounded border border-red-800/40">D</span>;
    return <span className="text-[9px] font-mono font-bold text-sky-400 bg-sky-950/60 px-1 py-0.2 rounded border border-sky-800/40">?</span>;
  };

  return (
    <div className="w-full bg-[var(--bg-sidebar)] border-l border-[var(--border-color)] flex flex-col h-full font-sans select-none overflow-hidden shrink-0">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--panel-header-bg)] border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[var(--color-primary)]" />
          <span className="text-xs font-semibold text-[var(--text-main)] tracking-wide">Live Monitor</span>
        </div>
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isLoadingData}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] rounded transition cursor-pointer disabled:opacity-50"
            title="Refresh monitor data"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingData ? 'animate-spin text-[var(--color-primary)]' : ''}`} />
          </button>
        )}
      </div>

      {/* Accordion Panels Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
        {/* SECTION 1: SUB AGENT RUNNING */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('subagents')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[var(--panel-header-bg)] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] transition cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span>Sub Agents</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">({subagents.length})</span>
            </div>
            {openSections.subagents ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>

          {openSections.subagents && (
            <div className="p-1.5 space-y-1">
              {subagents.length > 0 ? (
                subagents.map(sa => {
                  const isRunning = (sa.status || 'RUNNING').toUpperCase() === 'RUNNING';
                  return (
                    <div
                      key={sa.id}
                      onClick={() => onSelectSubAgent(sa)}
                      className="group p-2 bg-[var(--bg-sidebar)] hover:bg-[var(--color-primary-glow)] border border-[var(--border-color)] hover:border-[var(--color-primary)] rounded-md transition cursor-pointer flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-[var(--color-primary)]'}`} />
                          <span className="text-xs font-mono font-medium text-[var(--text-main)] group-hover:text-[var(--color-primary)] truncate">
                            {sa.role || sa.typeName || `SubAgent-${sa.id.slice(0, 6)}`}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-[var(--text-muted)] group-hover:text-[var(--color-primary)] flex items-center gap-0.5">
                          <TerminalIcon className="w-2.5 h-2.5" />
                          Live
                        </span>
                      </div>
                      {sa.prompt && (
                        <p className="text-[10px] text-[var(--text-muted)] font-sans truncate pl-3">
                          {sa.prompt}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-center text-[11px] text-[var(--text-muted)] font-mono">
                  No sub-agents active
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: PROCS (RUNNING PROCESSES) */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('procs')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[var(--panel-header-bg)] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] transition cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Processes (Procs)</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">({procs.length})</span>
            </div>
            {openSections.procs ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>

          {openSections.procs && (
            <div className="p-1.5 space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
              {procs.length > 0 ? (
                procs.map(proc => (
                  <div
                    key={proc.pid}
                    className="p-1.5 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-mono text-[var(--text-main)] font-medium truncate text-[11px]">
                        {proc.name}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border-color)] px-1 rounded">
                      PID:{proc.pid}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-[11px] text-[var(--text-muted)] font-mono">
                  No active processes
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 3: RECENT CHANGES */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('changes')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[var(--panel-header-bg)] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] transition cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-sky-400" />
              <span>Recent Changes</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">({recentChanges.length})</span>
            </div>
            {openSections.changes ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>

          {openSections.changes && (
            <div className="p-1.5 space-y-1 max-h-56 overflow-y-auto scrollbar-thin">
              {recentChanges.length > 0 ? (
                recentChanges.map((item, idx) => {
                  const filename = item.path.split(/[/\\]/).pop() || item.path;
                  return (
                    <div
                      key={idx}
                      className="p-1.5 bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)] rounded-md flex items-center justify-between text-xs"
                      title={item.path}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileCode className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                        <span className="font-mono text-[11px] text-[var(--text-main)] truncate">
                          {filename}
                        </span>
                      </div>
                      {getChangeBadge(item.type)}
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-center text-[11px] text-[var(--text-muted)] font-mono">
                  Clean working tree (No changes)
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
