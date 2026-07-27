import { useState } from 'react';
import { GitBranch, Activity, Cpu, RefreshCw, ChevronDown, ChevronRight, Terminal as TerminalIcon, FileCode, ExternalLink } from 'lucide-react';
import { SubAgentItem } from './SubAgentTerminalModal';

export interface RecentChangeItem {
  path: string;
  type: 'modified' | 'added' | 'deleted' | 'untracked' | string;
  staged?: boolean;
}

export interface ProcessItem {
  id?: string;
  pid: number;
  name: string;
  status: 'running' | 'idle' | 'stopped' | string;
  commandLine?: string;
  hasExited?: boolean;
  logs?: string[];
}

interface SuperAgentSidebarProps {
  workspacePath?: string;
  getAuthHeader?: () => Record<string, string>;
  subagents: SubAgentItem[];
  procs: ProcessItem[];
  recentChanges: RecentChangeItem[];
  onSelectSubAgent: (subagent: SubAgentItem) => void;
  onSelectProc?: (proc: ProcessItem) => void;
  onRefreshData?: () => void;
  isLoadingData?: boolean;
  onOpenFile?: (filePath: string, fileName?: string) => void;
  onOpenDiffTab?: (commitHash: string, filePath: string, worktreePath?: string) => void;
}

export function SuperAgentSidebar({
  workspacePath,
  subagents = [],
  procs = [],
  recentChanges = [],
  onSelectSubAgent,
  onSelectProc,
  onRefreshData,
  isLoadingData = false,
  onOpenFile,
  onOpenDiffTab
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
    if (t === 'modified' || t === 'm') return <span className="text-[9px] font-mono font-bold text-amber-500 bg-amber-500/15 px-1 py-0.2 rounded border border-amber-500/30">M</span>;
    if (t === 'added' || t === 'a') return <span className="text-[9px] font-mono font-bold text-emerald-500 bg-emerald-500/15 px-1 py-0.2 rounded border border-emerald-500/30">A</span>;
    if (t === 'deleted' || t === 'd') return <span className="text-[9px] font-mono font-bold text-rose-500 bg-rose-500/15 px-1 py-0.2 rounded border border-rose-500/30">D</span>;
    return <span className="text-[9px] font-mono font-bold text-sky-500 bg-sky-500/15 px-1 py-0.2 rounded border border-sky-500/30">?</span>;
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
                  No sub-agents active (Single Mode)
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
                procs.map(proc => {
                  const isRunning = !proc.hasExited && proc.status === 'running';
                  return (
                    <div
                      key={proc.id || proc.pid}
                      onClick={() => {
                        if (onSelectProc) {
                          onSelectProc(proc);
                        } else {
                          onSelectSubAgent({
                            id: proc.id || `proc-${proc.pid}`,
                            typeName: 'Process',
                            role: `Process #${proc.pid} — ${proc.name || proc.commandLine || 'Command'}`,
                            status: proc.hasExited ? 'COMPLETED' : (proc.status === 'running' ? 'RUNNING' : proc.status),
                            prompt: proc.commandLine || proc.name,
                            logs: proc.logs || [],
                          });
                        }
                      }}
                      className="group p-2 bg-[var(--bg-sidebar)] hover:bg-[var(--color-primary-glow)] border border-[var(--border-color)] hover:border-[var(--color-primary)] rounded-md transition cursor-pointer flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-sky-400 animate-ping' : 'bg-slate-400'}`} />
                          <span className="text-xs font-mono font-medium text-[var(--text-main)] group-hover:text-[var(--color-primary)] truncate">
                            {proc.name || proc.commandLine || `Process #${proc.pid}`}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-[var(--text-muted)] group-hover:text-[var(--color-primary)] flex items-center gap-0.5">
                          <TerminalIcon className="w-2.5 h-2.5" />
                          PID:{proc.pid}
                        </span>
                      </div>
                      {proc.commandLine && proc.commandLine !== proc.name && (
                        <p className="text-[10px] text-[var(--text-muted)] font-sans truncate pl-3">
                          {proc.commandLine}
                        </p>
                      )}
                    </div>
                  );
                })
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
                  const fullPath = workspacePath ? (item.path.startsWith('/') || item.path.includes(':') ? item.path : `${workspacePath}/${item.path}`) : item.path;

                  const handleClickItem = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (onOpenDiffTab) {
                      onOpenDiffTab('WORKTREE', item.path, workspacePath);
                    } else if (onOpenFile) {
                      onOpenFile(fullPath, filename);
                    }
                  };

                  const handleOpenFileOnly = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (onOpenFile) {
                      onOpenFile(fullPath, filename);
                    }
                  };

                  return (
                    <div
                      key={idx}
                      onClick={handleClickItem}
                      className="group p-1.5 bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)] hover:border-[var(--color-primary)] rounded-md flex items-center justify-between text-xs transition cursor-pointer"
                      title={`Click to open diff for ${item.path}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <FileCode className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] shrink-0 transition-colors" />
                        <span className="font-mono text-[11px] text-[var(--text-main)] group-hover:text-[var(--color-primary)] truncate transition-colors">
                          {filename}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenFile && (
                          <button
                            onClick={handleOpenFileOnly}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] rounded transition cursor-pointer"
                            title="Open file tab"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {getChangeBadge(item.type)}
                      </div>
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
