import React, { useState, useEffect } from 'react';
import {
  GitBranch, Activity, Cpu, RefreshCw, ChevronDown, ChevronRight,
  Terminal as TerminalIcon, FileCode, ExternalLink, Globe, Clock, Trash2, Link as LinkIcon, Server
} from 'lucide-react';
import { SubAgentItem } from './SubAgentTerminalModal';

export interface BgTaskItem {
  id: string;
  name: string;
  type?: string;
  status: string;
  prompt?: string;
  createdAt?: string | number;
}

export interface BrowserInstanceItem {
  id: string;
  url?: string;
  title?: string;
  connectedAt?: string | number;
}

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

export interface WorkspaceChainNodeInfo {
  id: string;
  label: string;
  type: 'local' | 'ssh';
  role: 'main' | 'module' | 'deploy' | 'dependency' | 'test' | 'staging' | 'custom';
  path?: string;
  description?: string;
}

export interface WorkspaceChainInfo {
  id: string;
  name: string;
  description?: string;
  primaryNodeId: string;
  nodes: WorkspaceChainNodeInfo[];
}

interface SuperAgentSidebarProps {
  workspacePath?: string;
  getAuthHeader?: () => Record<string, string>;
  subagents: SubAgentItem[];
  procs: ProcessItem[];
  recentChanges: RecentChangeItem[];
  bgTasks?: BgTaskItem[];
  browserInstances?: BrowserInstanceItem[];
  onSelectSubAgent: (subagent: SubAgentItem) => void;
  onSelectProc?: (proc: ProcessItem) => void;
  onKillBgTask?: (taskId: string) => void;
  onRefreshData?: () => void;
  isLoadingData?: boolean;
  onOpenFile?: (filePath: string, fileName?: string) => void;
  onOpenDiffTab?: (commitHash: string, filePath: string, worktreePath?: string) => void;
  activeChain?: WorkspaceChainInfo | null;
  activeChainNodeId?: string;
  onSwitchChainNode?: (nodeId: string) => void;
}

export function SuperAgentSidebar({
  workspacePath,
  getAuthHeader,
  subagents = [],
  procs = [],
  recentChanges = [],
  bgTasks = [],
  browserInstances = [],
  onSelectSubAgent,
  onSelectProc,
  onKillBgTask,
  onRefreshData,
  isLoadingData = false,
  onOpenFile,
  onOpenDiffTab,
  activeChain: initialActiveChain = null,
  activeChainNodeId: initialActiveNodeId = '',
  onSwitchChainNode
}: SuperAgentSidebarProps) {
  const [openSections, setOpenSections] = useState<{
    chain: boolean;
    changes: boolean;
    procs: boolean;
    subagents: boolean;
    bgTasks: boolean;
    browserInstances: boolean;
  }>({
    chain: true,
    changes: true,
    procs: true,
    subagents: true,
    bgTasks: true,
    browserInstances: true
  });

  const [chainInfo, setChainInfo] = useState<WorkspaceChainInfo | null>(initialActiveChain);
  const [activeNodeId, setActiveNodeId] = useState<string>(initialActiveNodeId);

  useEffect(() => {
    if (initialActiveChain) setChainInfo(initialActiveChain);
  }, [initialActiveChain]);

  useEffect(() => {
    if (initialActiveNodeId) setActiveNodeId(initialActiveNodeId);
  }, [initialActiveNodeId]);

  // Fetch active workspace chain object from API
  const fetchChainInfo = async () => {
    try {
      const headers = getAuthHeader ? getAuthHeader() : {};
      const wsParam = workspacePath ? `?workspace=${encodeURIComponent(workspacePath)}` : '';
      
      const activeRes = await fetch(`/api/superagent/workspace/chains/active${wsParam}`, { headers });
      let activeChainId = '';
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        if (activeData.activeChain && Array.isArray(activeData.activeChain.nodes) && activeData.activeChain.nodes.length > 0) {
          setChainInfo(activeData.activeChain);
          if (activeData.activeNodeId) setActiveNodeId(activeData.activeNodeId);
          return;
        }
        activeChainId = activeData.activeChainId || activeData.activeChain?.id || '';
      }

      // Filter chains exclusively by current workspace (DO NOT use filter=false!)
      const listRes = await fetch(`/api/superagent/workspace/chains${wsParam}`, { headers });
      if (listRes.ok) {
        const listData = await listRes.json();
        const chainsList: WorkspaceChainInfo[] = listData.chains || [];
        
        if (chainsList.length > 0) {
          const found = activeChainId 
            ? (chainsList.find(c => c.id === activeChainId) || chainsList[0])
            : chainsList[0];
            
          if (found && Array.isArray(found.nodes) && found.nodes.length > 0) {
            setChainInfo(found);
            setActiveNodeId(found.primaryNodeId || (found.nodes?.[0]?.id ?? ''));
            return;
          }
        }
      }
      setChainInfo(null);
    } catch (e) {
      console.error('Failed to fetch active workspace chain in sidebar:', e);
      setChainInfo(null);
    }
  };

  useEffect(() => {
    fetchChainInfo();
  }, [workspacePath]);

  const toggleSection = (section: 'chain' | 'changes' | 'procs' | 'subagents' | 'bgTasks' | 'browserInstances') => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getChangeBadge = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'modified' || t === 'm') return <span className="text-[9px] font-mono font-medium text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">M</span>;
    if (t === 'added' || t === 'a') return <span className="text-[9px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">A</span>;
    if (t === 'deleted' || t === 'd') return <span className="text-[9px] font-mono font-medium text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20">D</span>;
    return <span className="text-[9px] font-mono font-medium text-sky-400 bg-sky-500/10 px-1 py-0.5 rounded border border-sky-500/20">?</span>;
  };

  const chainNodes = chainInfo?.nodes || [];

  return (
    <div className="w-full bg-[var(--bg-sidebar)] border-l border-[var(--border-color)] flex flex-col h-full font-sans select-none overflow-hidden shrink-0">
      {/* Sleek Minimal Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-color)]/70 bg-[var(--bg-sidebar)]/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500/40 animate-ping" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--text-main)] opacity-90">Live Monitor</span>
        </div>
        {onRefreshData && (
          <button
            onClick={() => {
              onRefreshData();
              fetchChainInfo();
            }}
            disabled={isLoadingData}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] rounded-md transition-colors cursor-pointer disabled:opacity-40"
            title="Refresh monitor data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-[var(--color-primary)]' : ''}`} />
          </button>
        )}
      </div>

      {/* Accordion Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-none hover:scrollbar-thin">

        {/* SECTION 0: WORKSPACE CHAIN (Only visible if workspace has a valid chain) */}
        {chainInfo && chainNodes.length > 0 && (
          <div className="rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-card)]/40 overflow-hidden transition-all">
            <button
              onClick={() => toggleSection('chain')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--surface-overlay-hover)]/60 transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 text-purple-400 opacity-90" />
                <span className="text-[11px] font-medium text-[var(--text-main)]">Workspace Chain</span>
                {chainNodes.length > 0 && (
                  <span className="text-[9px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded-full">
                    {chainNodes.length}
                  </span>
                )}
              </div>
              {openSections.chain ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)] opacity-70" /> : <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-70" />}
            </button>

            {openSections.chain && (
              <div className="p-1.5 pt-0.5 space-y-1">
                <div className="flex items-center justify-between px-2 py-1 bg-purple-500/5 rounded border border-purple-500/15 text-[10px] font-mono text-purple-300">
                  <span className="truncate font-medium">{chainInfo.name}</span>
                  <span className="text-[8px] bg-purple-500/20 text-purple-200 px-1 py-0.2 rounded font-semibold tracking-wide">ACTIVE</span>
                </div>

                <div className="space-y-1 pt-0.5">
                  {chainNodes.map(node => {
                    const isPrimary = node.id === chainInfo.primaryNodeId;
                    const isCurrent = node.id === activeNodeId || (!activeNodeId && isPrimary);

                    return (
                      <div
                        key={node.id}
                        onClick={() => onSwitchChainNode?.(node.id)}
                        className={`p-1.5 rounded-md text-[10px] transition-all cursor-pointer flex items-center justify-between font-mono ${
                          isCurrent
                            ? 'bg-purple-500/10 border border-purple-500/30 text-purple-200 shadow-sm'
                            : 'hover:bg-[var(--surface-overlay-hover)]/80 text-[var(--text-muted)] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Server className={`w-3 h-3 shrink-0 ${isPrimary ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className="truncate font-medium">{node.label}</span>
                          {node.type === 'ssh' && (
                            <span className="text-[8px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1 rounded">SSH</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isPrimary && (
                            <span className="text-[8px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1 rounded font-medium">MAIN</span>
                          )}
                          {isCurrent && (
                            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded font-medium">ACTIVE</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 1: SUB AGENTS */}
        <div className="rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-card)]/40 overflow-hidden transition-all">
          <button
            onClick={() => toggleSection('subagents')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--surface-overlay-hover)]/60 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[var(--color-primary)] opacity-90" />
              <span className="text-[11px] font-medium text-[var(--text-main)]">Sub Agents</span>
              {subagents.length > 0 && (
                <span className="text-[9px] font-mono text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-1.5 py-0.2 rounded-full">
                  {subagents.length}
                </span>
              )}
            </div>
            {openSections.subagents ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)] opacity-70" /> : <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-70" />}
          </button>

          {openSections.subagents && (
            <div className="p-1.5 pt-0.5 space-y-1">
              {subagents.length > 0 ? (
                subagents.map(sa => {
                  const isRunning = (sa.status || 'RUNNING').toUpperCase() === 'RUNNING';
                  return (
                    <div
                      key={sa.id}
                      onClick={() => onSelectSubAgent(sa)}
                      className="group p-2 rounded-md hover:bg-[var(--surface-overlay-hover)] border border-transparent hover:border-[var(--border-color)] transition-all cursor-pointer flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                          <span className="text-[11px] font-mono font-medium text-[var(--text-main)] group-hover:text-[var(--color-primary)] truncate">
                            {sa.role || sa.typeName || `SubAgent-${sa.id.slice(0, 6)}`}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-[var(--text-muted)] opacity-70 group-hover:opacity-100 flex items-center gap-1">
                          <TerminalIcon className="w-2.5 h-2.5" />
                          Live
                        </span>
                      </div>
                      {sa.prompt && (
                        <p className="text-[10px] text-[var(--text-muted)] font-sans truncate pl-3 opacity-80">
                          {sa.prompt}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-2.5 text-center text-[10px] text-[var(--text-muted)] opacity-70 font-mono">
                  No active sub-agents
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: PROCESSES (PROCS) */}
        <div className="rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-card)]/40 overflow-hidden transition-all">
          <button
            onClick={() => toggleSection('procs')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--surface-overlay-hover)]/60 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-amber-400 opacity-90" />
              <span className="text-[11px] font-medium text-[var(--text-main)]">Processes</span>
              {procs.length > 0 && (
                <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-full">
                  {procs.length}
                </span>
              )}
            </div>
            {openSections.procs ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)] opacity-70" /> : <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-70" />}
          </button>

          {openSections.procs && (
            <div className="p-1.5 pt-0.5 space-y-1 max-h-48 overflow-y-auto scrollbar-none hover:scrollbar-thin">
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
                      className="group p-2 rounded-md hover:bg-[var(--surface-overlay-hover)] border border-transparent hover:border-[var(--border-color)] transition-all cursor-pointer flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'bg-sky-400 animate-pulse' : 'bg-slate-400'}`} />
                          <span className="text-[11px] font-mono font-medium text-[var(--text-main)] group-hover:text-[var(--color-primary)] truncate">
                            {proc.name || proc.commandLine || `Process #${proc.pid}`}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-[var(--text-muted)] opacity-70 group-hover:opacity-100 flex items-center gap-1">
                          <TerminalIcon className="w-2.5 h-2.5" />
                          PID:{proc.pid}
                        </span>
                      </div>
                      {proc.commandLine && proc.commandLine !== proc.name && (
                        <p className="text-[10px] text-[var(--text-muted)] font-sans truncate pl-3 opacity-80">
                          {proc.commandLine}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-2.5 text-center text-[10px] text-[var(--text-muted)] opacity-70 font-mono">
                  No running processes
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 3: RECENT CHANGES */}
        <div className="rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-card)]/40 overflow-hidden transition-all">
          <button
            onClick={() => toggleSection('changes')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--surface-overlay-hover)]/60 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-sky-400 opacity-90" />
              <span className="text-[11px] font-medium text-[var(--text-main)]">Recent Changes</span>
              {recentChanges.length > 0 && (
                <span className="text-[9px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded-full">
                  {recentChanges.length}
                </span>
              )}
            </div>
            {openSections.changes ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)] opacity-70" /> : <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-70" />}
          </button>

          {openSections.changes && (
            <div className="p-1.5 pt-0.5 space-y-1 max-h-56 overflow-y-auto scrollbar-none hover:scrollbar-thin">
              {recentChanges.length > 0 ? (
                recentChanges.map((item, idx) => {
                  const filename = item.path.split(/[/\\\\]/).pop() || item.path;
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
                      className="group p-1.5 rounded-md hover:bg-[var(--surface-overlay-hover)] border border-transparent hover:border-[var(--border-color)] flex items-center justify-between transition-all cursor-pointer"
                      title={`Click to view diff for ${item.path}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <FileCode className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-75 group-hover:text-[var(--color-primary)] group-hover:opacity-100 shrink-0 transition-colors" />
                        <span className="font-mono text-[11px] text-[var(--text-main)] group-hover:text-[var(--color-primary)] truncate transition-colors">
                          {filename}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenFile && (
                          <button
                            onClick={handleOpenFileOnly}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded transition cursor-pointer"
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
                <div className="py-2.5 text-center text-[10px] text-[var(--text-muted)] opacity-70 font-mono">
                  Clean working tree
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 4: BACKGROUND TASKS */}
        <div className="rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-card)]/40 overflow-hidden transition-all">
          <button
            onClick={() => toggleSection('bgTasks')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--surface-overlay-hover)]/60 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400 opacity-90" />
              <span className="text-[11px] font-medium text-[var(--text-main)]">Background Tasks</span>
              {bgTasks.length > 0 && (
                <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-full">
                  {bgTasks.length}
                </span>
              )}
            </div>
            {openSections.bgTasks ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)] opacity-70" /> : <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-70" />}
          </button>

          {openSections.bgTasks && (
            <div className="p-1.5 pt-0.5 space-y-1">
              {bgTasks.length > 0 ? (
                bgTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-1.5 rounded-md bg-[var(--bg-sidebar)]/50 border border-[var(--border-color)]/50 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                        <span className="text-[11px] font-medium truncate text-[var(--text-main)]">
                          {task.name || task.id}
                        </span>
                      </div>
                      <span className="text-[9px] text-[var(--text-muted)] font-mono truncate block mt-0.5 opacity-80">
                        {task.prompt || task.status || 'Active Task'}
                      </span>
                    </div>
                    {onKillBgTask && (
                      <button
                        onClick={() => onKillBgTask(task.id)}
                        className="p-1 hover:bg-rose-500/10 text-rose-400 rounded transition cursor-pointer shrink-0"
                        title="Kill Task"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-2.5 text-center text-[10px] text-[var(--text-muted)] opacity-70 font-mono">
                  No background tasks
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 5: BROWSER INSTANCES */}
        <div className="rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-card)]/40 overflow-hidden transition-all">
          <button
            onClick={() => toggleSection('browserInstances')}
            className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--surface-overlay-hover)]/60 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400 opacity-90" />
              <span className="text-[11px] font-medium text-[var(--text-main)]">Browser Tabs</span>
              {browserInstances.length > 0 && (
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full">
                  {browserInstances.length}
                </span>
              )}
            </div>
            {openSections.browserInstances ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)] opacity-70" /> : <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-70" />}
          </button>

          {openSections.browserInstances && (
            <div className="p-1.5 pt-0.5 space-y-1">
              {browserInstances.length > 0 ? (
                browserInstances.map(inst => (
                  <div
                    key={inst.id}
                    className="p-1.5 rounded-md bg-[var(--bg-sidebar)]/50 border border-[var(--border-color)]/50 flex flex-col gap-0.5"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-[11px] font-medium truncate text-[var(--text-main)]">
                        {inst.title || inst.id}
                      </span>
                    </div>
                    {inst.url && (
                      <span className="text-[9px] text-[var(--text-muted)] font-mono truncate opacity-80">
                        {inst.url}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-2.5 text-center text-[10px] text-[var(--text-muted)] opacity-70 font-mono">
                  No extension connected
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
