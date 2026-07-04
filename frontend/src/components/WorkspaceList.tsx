import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  GitFork,
  GitCompare,
  FolderTree,
  Terminal as TerminalIcon,
  Trash2,
  GitBranch,
  MoreVertical,
  Check,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { WorkspaceInfo, TabData, WorkspaceActiveTabMap, getTerminalIds, ActiveProcessSummary } from '../hooks/useTerminals';

// Helper to normalize path matching
const isPathInWorktree = (filePath: string, wtPath: string): boolean => {
  const normFile = filePath.toLowerCase().replace(/\\/g, '/');
  const normWt = wtPath.toLowerCase().replace(/\\/g, '/');
  return normFile === normWt || normFile.startsWith(normWt + '/');
};

const getRelativeWtPath = (wtPath: string, wsPath: string): string => {
  if (wtPath === wsPath) return './';
  const normWt = wtPath.replace(/\\/g, '/');
  const normWs = wsPath.replace(/\\/g, '/');
  if (normWt.toLowerCase().startsWith(normWs.toLowerCase())) {
    let rel = normWt.slice(normWs.length);
    if (rel.startsWith('/')) {
      rel = rel.slice(1);
    }
    return `./${rel}`;
  }
  const parts = wtPath.split(/[/\\]/);
  return parts.slice(-2).join('/');
};

// Helper to get active running processes for a path
const getRunningProcessesForPath = (
  path: string,
  terminalInstances: Record<string, any>
): ActiveProcessSummary[] => {
  const processes: ActiveProcessSummary[] = [];
  Object.values(terminalInstances).forEach((inst: any) => {
    if (inst && inst.cwd && isPathInWorktree(inst.cwd, path)) {
      if (inst.activeProcesses && inst.activeProcesses.length > 0) {
        processes.push(...inst.activeProcesses);
      }
    }
  });
  return processes;
};

export interface WorkspaceListProps {
  workspaces: WorkspaceInfo[];
  tabs: TabData[];
  activeTabId: string;
  terminalInstances: Record<string, any>;
  workspaceActiveTab: WorkspaceActiveTabMap;
  onWorkspaceClick: (wsId: string) => void;
  onWorktreeClick: (wsId: string, wtPath: string) => void;
  onBranchCheckoutClick?: (wsId: string, branchName: string) => void;
  setPanelWorkspace: (ws: WorkspaceInfo | null) => void;
  setActivePanel: (panel: 'workspaces' | 'explorer' | 'changes') => void;
  handleOpenWorktreeModal: (w: WorkspaceInfo) => void;
  openTerminal: (name: string, path: string, shell?: string) => void;
  handleRemoveWorkspace: (path: string) => void;
  handleRemoveWorktree: (repoPath: string, wtPath: string) => void;
  onEditWorkspace: (ws: WorkspaceInfo) => void;
  deletingWorkspacePaths?: string[];
  deletingWorktreePaths?: string[];
  panelWorktreePath: string | null;
  panelWorkspace?: WorkspaceInfo | null;
  showSearch?: boolean;
}

/** Detects if the screen is in "mobile" mode (< 768px) */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

interface WorkspaceActionsProps {
  w: WorkspaceInfo;
  setPanelWorkspace: (ws: WorkspaceInfo | null) => void;
  setActivePanel: (panel: 'workspaces' | 'explorer' | 'changes') => void;
  handleOpenWorktreeModal: (w: WorkspaceInfo) => void;
  openTerminal: (name: string, path: string, shell?: string) => void;
  handleRemoveWorkspace: (path: string) => void;
  onEditWorkspace: (ws: WorkspaceInfo) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

function WorkspaceActions({
  w,
  setPanelWorkspace,
  setActivePanel,
  handleOpenWorktreeModal,
  openTerminal,
  handleRemoveWorkspace,
  onEditWorkspace,
  open,
  setOpen
}: WorkspaceActionsProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setOpen]);

  const actionButtons = (
    <>
      {w.isGit && (
        <button
          className="action-btn"
          onClick={(e) => { e.stopPropagation(); handleOpenWorktreeModal(w); setOpen(false); }}
          title="New Worktree branch"
        >
          <GitFork size={13} />
          <span className="ws-dropdown-label">New Worktree</span>
        </button>
      )}
      {w.isGit && (
        <button
          className="action-btn"
          onClick={(e) => { e.stopPropagation(); setPanelWorkspace(w); setActivePanel('changes'); setOpen(false); }}
          title="Git Changes"
        >
          <GitCompare size={13} />
          <span className="ws-dropdown-label">Git Changes</span>
        </button>
      )}
      <button
        className="action-btn"
        onClick={(e) => { e.stopPropagation(); setPanelWorkspace(w); setActivePanel('explorer'); setOpen(false); }}
        title="Browse Files"
      >
        <FolderTree size={13} />
        <span className="ws-dropdown-label">Browse Files</span>
      </button>
      <button
        className="action-btn"
        onClick={(e) => { e.stopPropagation(); setPanelWorkspace(w); openTerminal(w.name, w.path, w.defaultShell); setOpen(false); }}
        title={`Open terminal (${w.defaultShell || 'default'})`}
      >
        <TerminalIcon size={13} />
        <span className="ws-dropdown-label">Open Terminal</span>
      </button>
      <button
        className="action-btn"
        onClick={(e) => { e.stopPropagation(); onEditWorkspace(w); setOpen(false); }}
        title="Edit workspace settings"
      >
        <Settings size={13} />
        <span className="ws-dropdown-label">Settings</span>
      </button>
      <button
        className="action-btn action-btn-danger"
        onClick={(e) => { e.stopPropagation(); handleRemoveWorkspace(w.path); setOpen(false); }}
        title="Remove workspace"
      >
        <Trash2 size={13} />
        <span className="ws-dropdown-label">Remove</span>
      </button>
    </>
  );

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="action-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title="More actions"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="ws-dropdown-menu" onClick={(e) => e.stopPropagation()}>
          {actionButtons}
        </div>
      )}
    </div>
  );
}

/** Collapsible worktree list with +N more button when > BRANCH_LIMIT */
const BRANCH_LIMIT = 3;

interface WorktreeListProps {
  w: WorkspaceInfo;
  isActive: boolean;
  isMobile: boolean;
  activeTabId: string;
  tabs: TabData[];
  terminalInstances: Record<string, any>;
  workspaceActiveTab: WorkspaceActiveTabMap;
  openTerminal: (name: string, path: string, shell?: string) => void;
  handleRemoveWorktree: (repoPath: string, wtPath: string) => void;
  onWorkspaceClick: (wsId: string) => void;
  onWorktreeClick: (wsId: string, wtPath: string) => void;
  isPathInWorktree: (filePath: string, wtPath: string) => boolean;
  deletingWorktreePaths?: string[];
  panelWorktreePath: string | null;
  panelWorkspace?: WorkspaceInfo | null;
  onBranchCheckoutClick?: (wsId: string, branchName: string) => void;
}

function WorktreeList({
  w,
  isActive,
  isMobile,
  activeTabId,
  tabs,
  terminalInstances,
  workspaceActiveTab,
  openTerminal,
  handleRemoveWorktree,
  onWorkspaceClick,
  onWorktreeClick,
  isPathInWorktree,
  deletingWorktreePaths = [],
  panelWorktreePath,
  panelWorkspace,
  onBranchCheckoutClick
}: WorktreeListProps) {
  const [expanded, setExpanded] = useState(false);

  const activeWtPathForWorkspace = useMemo(() => {
    const wsActiveTabId = workspaceActiveTab[w.id];
    const wsActiveTab = tabs.find(t => t.id === wsActiveTabId);
    
    let tabPath = '';
    if (wsActiveTab) {
      if (wsActiveTab.type === 'file') {
        tabPath = wsActiveTab.filePath || '';
      } else if (wsActiveTab.type === 'terminal' && wsActiveTab.layout) {
        const focusedId = wsActiveTab.focusedTerminalId;
        const inst = focusedId ? terminalInstances[focusedId] : null;
        if (inst && inst.cwd) {
          tabPath = inst.cwd;
        }
        if (!tabPath) {
          const termIds = getTerminalIds(wsActiveTab.layout);
          for (const id of termIds) {
            const inst = terminalInstances[id];
            if (inst && inst.cwd) {
              tabPath = inst.cwd;
              break;
            }
          }
        }
      }
    }
    
    if (tabPath) {
      const wts = w.worktrees || [];
      const sortedWts = [...wts].sort((a, b) => b.path.length - a.path.length);
      for (const wtItem of sortedWts) {
        if (isPathInWorktree(tabPath, wtItem.path)) {
          return wtItem.path;
        }
      }
    }
    
    const mainWt = w.worktrees?.find(wt => wt.isMain);
    return mainWt ? mainWt.path : null;
  }, [w, tabs, workspaceActiveTab, terminalInstances]);

  // Combine all repo branches with worktrees
  const branchItems = useMemo(() => {
    const wts = w.worktrees || [];
    const localBranches = w.branches || [];
    
    const allBranches = Array.from(new Set([
      ...wts.map(wt => wt.branch).filter(Boolean),
      ...localBranches
    ])) as string[];

    const items = allBranches.map(branchName => {
      const wt = wts.find(wt => wt.branch === branchName);
      
      return {
        branch: branchName,
        wtPath: wt ? wt.path : null,
        isMain: wt ? wt.isMain : false,
        isDirty: wt ? wt.isDirty : false,
        dirtyCount: wt ? wt.dirtyCount : 0,
        commit: wt ? wt.commit : 'not-checked-out',
        hasWorktree: !!wt
      };
    });

    return items.sort((a, b) => {
      if (a.isMain) return -1;
      if (b.isMain) return 1;
      if (a.hasWorktree && !b.hasWorktree) return -1;
      if (!a.hasWorktree && b.hasWorktree) return 1;
      return a.branch.localeCompare(b.branch);
    });
  }, [w.worktrees, w.branches]);

  const activeBranchName = useMemo(() => {
    if (activeWtPathForWorkspace) {
      const wt = w.worktrees?.find(wt => wt.path === activeWtPathForWorkspace);
      if (wt && wt.branch) return wt.branch;
    }
    const mainWt = w.worktrees?.find(wt => wt.isMain);
    return mainWt?.branch || 'main';
  }, [w.worktrees, activeWtPathForWorkspace]);

  const visibleItems = useMemo(() => {
    if (isActive) {
      return expanded || branchItems.length <= BRANCH_LIMIT
        ? branchItems
        : branchItems.slice(0, BRANCH_LIMIT);
    } else {
      const activeItem = branchItems.find(item => item.branch === activeBranchName);
      return activeItem ? [activeItem] : (branchItems.length > 0 ? [branchItems[0]] : []);
    }
  }, [isActive, expanded, branchItems, activeBranchName]);

  const hiddenCount = branchItems.length - BRANCH_LIMIT;

  if (!w.isGit) return null;

  return (
    <div className="mt-0.5 flex flex-col">
      {visibleItems.map((item, idx) => {
        const isLast = idx === visibleItems.length - 1 && (expanded || branchItems.length <= BRANCH_LIMIT);

        // Find which worktree owns the active tab
        const activeTab = tabs.find(t => t.id === activeTabId);
        let tabWorktreePath: string | null = null;
        if (activeTab && activeTab.workspaceId === w.id) {
          let tabPath = '';
          if (activeTab.type === 'file') {
            tabPath = activeTab.filePath || '';
          } else if (activeTab.type === 'terminal' && activeTab.layout) {
            const focusedId = activeTab.focusedTerminalId;
            const inst = focusedId ? terminalInstances[focusedId] : null;
            if (inst && inst.cwd) {
              tabPath = inst.cwd;
            }
            if (!tabPath) {
              const termIds = getTerminalIds(activeTab.layout);
              for (const id of termIds) {
                const inst = terminalInstances[id];
                if (inst && inst.cwd) {
                  tabPath = inst.cwd;
                  break;
                }
              }
            }
          }
          if (tabPath) {
            const wts = w.worktrees || [];
            const sortedWts = [...wts].sort((a, b) => b.path.length - a.path.length);
            for (const wtItem of sortedWts) {
              if (isPathInWorktree(tabPath, wtItem.path)) {
                tabWorktreePath = wtItem.path;
                break;
              }
            }
          }
        }

        const isSelectedWt = item.wtPath ? (panelWorktreePath === item.wtPath || (item.isMain && panelWorktreePath === null && panelWorkspace?.id === w.id)) : false;
        const isWtActive = item.hasWorktree && (isSelectedWt || (panelWorktreePath === null && tabWorktreePath === item.wtPath));

        const wtProcesses = item.wtPath ? getRunningProcessesForPath(item.wtPath, terminalInstances) : [];
        const hasWtRunning = wtProcesses.length > 0;
        const isWtClaudeActive = wtProcesses.some(p => p.isClaude);
        const isWtGeminiActive = wtProcesses.some(p => p.isGemini);
        const isWtCursorActive = wtProcesses.some(p => p.isCursor);
        const isWtSuperagentActive = wtProcesses.some(p => p.isSuperagent);

        return (
          <React.Fragment key={item.branch}>
            {/* Branch Header Row */}
            <div
              className={`tree-connector-wrapper ${isLast && !item.hasWorktree ? 'tree-item-last' : ''}`}
            >
              <div className="tree-connector" />
              <div className="tree-item-content">
                <div
                  className={`flex items-center justify-between py-0.5 px-1.5 rounded-md transition-all text-xs cursor-pointer group/item ${
                    isWtActive && !item.hasWorktree ? 'font-semibold border' : ''
                  }`}
                  style={{
                    backgroundColor: (isWtActive && !item.hasWorktree)
                      ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' 
                      : 'transparent',
                    borderColor: (isWtActive && !item.hasWorktree)
                      ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' 
                      : 'transparent',
                    color: isWtActive 
                      ? 'var(--color-primary)' 
                      : 'var(--text-muted)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                    e.currentTarget.style.color = 'var(--text-main)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = isWtActive ? 'var(--color-primary)' : 'var(--text-muted)';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.hasWorktree) {
                      if (item.isMain) {
                        onWorkspaceClick(w.id);
                      } else {
                        onWorktreeClick(w.id, item.wtPath!);
                      }
                    } else {
                      if (onBranchCheckoutClick) {
                        onBranchCheckoutClick(w.id, item.branch);
                      }
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5 truncate flex-1 min-w-0" title={`branch: ${item.branch}`}>
                    <GitBranch 
                      size={10} 
                      className="shrink-0" 
                      style={{
                        color: isWtActive ? 'var(--color-primary)' : (item.hasWorktree ? '#38bdf8' : 'rgba(148, 163, 184, 0.4)')
                      }}
                    />
                    <span 
                      className="truncate text-[11px]"
                      style={{
                        color: isWtActive ? 'var(--color-primary)' : (item.hasWorktree ? 'var(--text-main)' : 'rgba(148, 163, 184, 0.5)')
                      }}
                    >
                      {item.branch}
                    </span>
                    <span className={`badge ${item.isMain ? 'badge-main' : item.hasWorktree ? 'badge-worktree' : 'badge-branch-inactive'} shrink-0 text-[9px] px-1 py-0`}>
                      {item.isMain ? 'main' : item.hasWorktree ? 'wt' : 'git'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Worktree Indented Path Row */}
            {item.hasWorktree && item.wtPath && (
              deletingWorktreePaths?.includes(item.wtPath) ? (
                <div
                  className={`tree-connector-wrapper ${isLast ? 'tree-item-last' : ''} opacity-60 animate-pulse pointer-events-none`}
                  style={{ marginLeft: '32px' }}
                >
                  <div className="tree-connector" />
                  <div className="tree-item-content">
                    <div className="flex items-center gap-2 py-1 px-1.5 text-[10px] text-red-300 font-mono">
                      <span className="h-2 w-2 rounded-full border border-red-400 border-t-transparent animate-spin shrink-0" />
                      <span className="truncate">Removing worktree...</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`tree-connector-wrapper ${isLast ? 'tree-item-last' : ''}`}
                  style={{ marginLeft: '32px' }}
                >
                  <div className="tree-connector" />
                  <div className="tree-item-content">
                    <div
                      className={`flex items-center justify-between py-0.5 px-1.5 rounded-md transition-all text-xs cursor-pointer group/item ${
                        isWtActive ? 'font-semibold border' : ''
                      }`}
                      style={{
                        backgroundColor: isWtActive 
                          ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' 
                          : 'transparent',
                        borderColor: isWtActive 
                          ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' 
                          : 'transparent',
                        color: isWtActive 
                          ? 'var(--color-primary)' 
                          : 'var(--text-muted)'
                      }}
                      onMouseOver={(e) => {
                        if (!isWtActive) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                          e.currentTarget.style.color = 'var(--text-main)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isWtActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.isMain) {
                          onWorkspaceClick(w.id);
                        } else {
                          onWorktreeClick(w.id, item.wtPath!);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1.5 truncate flex-1 min-w-0" title={item.wtPath}>
                        <div className="relative flex items-center shrink-0">
                          <FolderOpen 
                            size={10} 
                            className="shrink-0"
                            style={{
                              color: isWtActive ? 'var(--color-primary)' : (item.isDirty ? '#f59e0b' : 'var(--text-muted)')
                            }}
                          />
                          {hasWtRunning && (
                            <span className="absolute -bottom-0.5 -right-0.5 ws-active-dot" style={{ width: '4px', height: '4px', boxShadow: '0 0 4px #10b981' }} title="Active processes running in terminal" />
                          )}
                        </div>
                        <span 
                          className="truncate text-[10px] font-mono opacity-80"
                          style={{
                            color: isWtActive ? 'var(--color-primary)' : (item.isDirty ? '#f59e0b' : 'var(--text-muted)')
                          }}
                        >
                          {getRelativeWtPath(item.wtPath, w.path)}
                        </span>

                        {/* Compact process badges for worktree */}
                        {isWtClaudeActive && (
                          <span className="ws-active-process-badge ws-badge-claude shrink-0 scale-[0.85] origin-left" style={{ fontSize: '7px', height: '12px', padding: '0 3px' }} title="Claude Code running">
                            Claude
                          </span>
                        )}
                        {isWtGeminiActive && (
                          <span className="ws-active-process-badge ws-badge-gemini shrink-0 scale-[0.85] origin-left" style={{ fontSize: '7px', height: '12px', padding: '0 3px' }} title="Gemini CLI running">
                            Gemini
                          </span>
                        )}
                        {isWtCursorActive && (
                          <span className="ws-active-process-badge ws-badge-cursor shrink-0 scale-[0.85] origin-left" style={{ fontSize: '7px', height: '12px', padding: '0 3px' }} title="Cursor running">
                            Cursor
                          </span>
                        )}
                        {isWtSuperagentActive && (
                          <span className="ws-active-process-badge ws-badge-superagent shrink-0 scale-[0.85] origin-left" style={{ fontSize: '7px', height: '12px', padding: '0 3px' }} title="Superagent running">
                            Superagent
                          </span>
                        )}
                      </div>

                      <div className={`flex gap-1 shrink-0 ${isMobile ? '' : 'opacity-0 group-hover/item:opacity-100 transition-opacity duration-150'}`}>
                        <button
                          className="action-btn"
                          onClick={(e) => { e.stopPropagation(); openTerminal(item.isMain ? w.name : `${w.name} (${item.branch})`, item.wtPath!, w.defaultShell); }}
                          title={`Open terminal here (${w.defaultShell || 'default'})`}
                        >
                          <TerminalIcon size={10} />
                        </button>
                        {!item.isMain && (
                          <button
                            className="action-btn action-btn-danger"
                            onClick={(e) => { e.stopPropagation(); handleRemoveWorktree(w.path, item.wtPath!); }}
                            title="Delete worktree"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </React.Fragment>
        );
      })}

      {/* Expand / Collapse toggle */}
      {isActive && hiddenCount > 0 && (
        <button
          className="ws-branch-toggle"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
        >
          {expanded ? (
            <>
              <ChevronDown size={10} />
              <span>Show less</span>
            </>
          ) : (
            <>
              <ChevronRight size={10} />
              <span>+{hiddenCount} more branch{hiddenCount > 1 ? 'es' : ''}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function WorkspaceList({
  workspaces,
  tabs,
  activeTabId,
  terminalInstances,
  workspaceActiveTab,
  onWorkspaceClick,
  onWorktreeClick,
  onBranchCheckoutClick,
  setPanelWorkspace,
  setActivePanel,
  handleOpenWorktreeModal,
  openTerminal,
  handleRemoveWorkspace,
  handleRemoveWorktree,
  onEditWorkspace,
  deletingWorkspacePaths = [],
  deletingWorktreePaths = [],
  panelWorktreePath = null,
  panelWorkspace = null,
  showSearch = false
}: WorkspaceListProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    if (showSearch) {
      setTimeout(() => {
        searchRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [showSearch]);

  // (Using file-level helper isPathInWorktree)

  /**
   * Determine which workspace currently "owns" the active tab.
   */
  const activeWorkspaceId = useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return null;

    for (const [wsId, tabId] of Object.entries(workspaceActiveTab)) {
      if (tabId === activeTabId) return wsId;
    }
    return null;
  }, [tabs, activeTabId, workspaceActiveTab]);

  /**
   * Sort: workspaces with any dirty worktree float to top,
   * then filter by search query.
   */
  const displayedWorkspaces = useMemo(() => {
    const hasDirty = (w: WorkspaceInfo) => {
      const wts = w.worktrees || [];
      return wts.some(wt => wt.isDirty && (wt.dirtyCount ?? 0) > 0);
    };

    const q = search.trim().toLowerCase();
    const filtered = q
      ? workspaces.filter(w =>
          w.name.toLowerCase().includes(q) ||
          w.path.toLowerCase().includes(q)
        )
      : workspaces;

    return [...filtered].sort((a, b) => {
      const da = hasDirty(a) ? 0 : 1;
      const db = hasDirty(b) ? 0 : 1;
      return da - db;
    });
  }, [workspaces, search]);

  return (
    <div className="workspace-list-root">
      {/* ── Search bar ── */}
      {showSearch && (
        <div className="ws-search-bar">
          <Search size={12} className="ws-search-icon" />
          <input
            ref={searchRef}
            type="text"
            className="ws-search-input"
            placeholder="Search workspaces…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="ws-search-clear"
              onClick={() => { setSearch(''); searchRef.current?.focus(); }}
              title="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>
      )}

      {/* ── Workspace cards ── */}
      <div className="workspace-list flex flex-col gap-1.5 px-3">
        {(() => {
          const hasAnyActive = displayedWorkspaces.some(w => (panelWorkspace?.id === w.id) || (activeWorkspaceId === w.id));
          return displayedWorkspaces.map(w => {
            const isActive = (panelWorkspace?.id === w.id) || (activeWorkspaceId === w.id);
            const isDimmed = hasAnyActive && !isActive;
            const wts = w.worktrees || [];
            const totalDirty = wts.reduce((acc, wt) => acc + (wt.dirtyCount ?? 0), 0);
            const hasDirtyChanges = totalDirty > 0;
            const isDropdownOpen = openDropdownId === w.id;

            const runningProcesses = getRunningProcessesForPath(w.path, terminalInstances);
            const hasRunning = runningProcesses.length > 0;
            const isClaudeActive = runningProcesses.some(p => p.isClaude);
            const isGeminiActive = runningProcesses.some(p => p.isGemini);
            const isCursorActive = runningProcesses.some(p => p.isCursor);
            const isSuperagentActive = runningProcesses.some(p => p.isSuperagent);

            if (deletingWorkspacePaths?.includes(w.path)) {
              return (
                <div key={w.id} className="ws-card animate-pulse pointer-events-none opacity-60 flex items-center justify-between py-3 px-3.5 border border-red-500/20 bg-red-500/5 rounded-lg">
                  <div className="flex items-center gap-2 font-sans">
                    <span className="h-3 w-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin shrink-0" />
                    <span className="text-[11px] font-semibold text-red-300">Removing {w.name}...</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={w.id}
                className={`ws-card group cursor-pointer ${
                  isActive
                    ? 'ws-card-active'
                    : hasDirtyChanges
                    ? 'ws-card-dirty'
                    : 'ws-card-idle'
                } ${isDropdownOpen ? 'ws-card-dropdown-open' : ''} ${
                  isDimmed ? 'ws-card-dimmed' : ''
                }`}
                onClick={() => onWorkspaceClick(w.id)}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium truncate min-w-0 flex-1">
                    <div className="relative flex items-center shrink-0">
                      <Folder
                        size={14}
                        className="shrink-0"
                        style={{
                          color: isActive ? 'var(--color-primary)' : (hasDirtyChanges ? '#f59e0b' : 'var(--text-muted)')
                        }}
                      />
                      {hasRunning && (
                        <span className="absolute -bottom-0.5 -right-0.5 ws-active-dot" title="Active processes running in terminal" />
                      )}
                    </div>
                    <span
                      className="text-[12px] font-semibold tracking-wide truncate"
                      style={{
                        color: isActive ? 'var(--color-primary)' : 'var(--text-main)'
                      }}
                      title={w.path}
                    >
                      {w.name}
                    </span>

                    {isActive && (
                      <span className="ws-active-badge shrink-0" title="Active workspace tab">
                        <Check size={9} strokeWidth={3} />
                      </span>
                    )}


                    {/* Active processes badges */}
                    {isClaudeActive && (
                      <span className="ws-active-process-badge ws-badge-claude shrink-0" title="Claude Code running">
                        Claude
                      </span>
                    )}
                    {isGeminiActive && (
                      <span className="ws-active-process-badge ws-badge-gemini shrink-0" title="Gemini CLI running">
                        Gemini
                      </span>
                    )}
                    {isCursorActive && (
                      <span className="ws-active-process-badge ws-badge-cursor shrink-0" title="Cursor running">
                        Cursor
                      </span>
                    )}
                    {isSuperagentActive && (
                      <span className="ws-active-process-badge ws-badge-superagent shrink-0" title="Superagent running">
                        Superagent
                      </span>
                    )}
                    {hasRunning && !isClaudeActive && !isGeminiActive && !isCursorActive && !isSuperagentActive && (
                      <span className="ws-active-process-badge ws-badge-general shrink-0" title={`${runningProcesses[0].name} running`}>
                        Active
                      </span>
                    )}
                  </div>

                  <WorkspaceActions
                    w={w}
                    setPanelWorkspace={setPanelWorkspace}
                    setActivePanel={setActivePanel}
                    handleOpenWorktreeModal={handleOpenWorktreeModal}
                    openTerminal={openTerminal}
                    handleRemoveWorkspace={handleRemoveWorkspace}
                    onEditWorkspace={onEditWorkspace}
                    open={isDropdownOpen}
                    setOpen={(isOpen) => setOpenDropdownId(isOpen ? w.id : null)}
                  />
                </div>

                {/* Path */}
                <div className="ws-path-row" title={w.path}>{w.path}</div>

                {/* Worktree branches (collapsible) */}
                <WorktreeList
                  w={w}
                  isActive={isActive}
                  isMobile={isMobile}
                  activeTabId={activeTabId}
                  tabs={tabs}
                  terminalInstances={terminalInstances}
                  workspaceActiveTab={workspaceActiveTab}
                  openTerminal={openTerminal}
                  handleRemoveWorktree={handleRemoveWorktree}
                  onWorkspaceClick={onWorkspaceClick}
                  onWorktreeClick={onWorktreeClick}
                  isPathInWorktree={isPathInWorktree}
                  deletingWorktreePaths={deletingWorktreePaths}
                  panelWorktreePath={panelWorktreePath}
                  panelWorkspace={panelWorkspace}
                  onBranchCheckoutClick={onBranchCheckoutClick}
                />
              </div>
            );
          });
        })()}

        {displayedWorkspaces.length === 0 && search && (
          <div className="ws-empty-search">
            No workspaces match "<strong>{search}</strong>"
          </div>
        )}
      </div>
    </div>
  );
}
