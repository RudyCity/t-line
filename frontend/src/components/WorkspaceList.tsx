import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  GitFork,
  GitCompare,
  FolderTree,
  Terminal as TerminalIcon,
  Trash2,
  GitBranch,
  MoreVertical,
  Check,
  Settings
} from 'lucide-react';
import { WorkspaceInfo, TabData, WorkspaceActiveTabMap, getTerminalIds } from '../hooks/useTerminals';

export interface WorkspaceListProps {
  workspaces: WorkspaceInfo[];
  tabs: TabData[];
  activeTabId: string;
  terminalInstances: Record<string, any>;
  workspaceActiveTab: WorkspaceActiveTabMap;
  onWorkspaceClick: (wsId: string) => void;
  onWorktreeClick: (wsId: string, wtPath: string) => void; // <-- New prop
  setPanelWorkspace: (ws: WorkspaceInfo | null) => void;
  setActivePanel: (panel: 'workspaces' | 'explorer' | 'changes') => void;
  handleOpenWorktreeModal: (w: WorkspaceInfo) => void;
  openTerminal: (name: string, path: string, shell?: string) => void;
  handleRemoveWorkspace: (path: string) => void;
  handleRemoveWorktree: (repoPath: string, wtPath: string) => void;
  onEditWorkspace: (ws: WorkspaceInfo) => void;
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
}

function WorkspaceActions({
  w,
  setPanelWorkspace,
  setActivePanel,
  handleOpenWorktreeModal,
  openTerminal,
  handleRemoveWorkspace,
  onEditWorkspace
}: WorkspaceActionsProps) {
  const [open, setOpen] = useState(false);
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
  }, [open]);

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
        onClick={(e) => { e.stopPropagation(); openTerminal(w.name, w.path, w.defaultShell); setOpen(false); }}
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

  // Always use a three-dot dropdown menu (mobile & desktop)
  return (
    <div className="relative" ref={menuRef}>
      <button
        className="action-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
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

export function WorkspaceList({
  workspaces,
  tabs,
  activeTabId,
  terminalInstances,
  workspaceActiveTab,
  onWorkspaceClick,
  onWorktreeClick,
  setPanelWorkspace,
  setActivePanel,
  handleOpenWorktreeModal,
  openTerminal,
  handleRemoveWorkspace,
  handleRemoveWorktree,
  onEditWorkspace
}: WorkspaceListProps): React.JSX.Element {
  const isMobile = useIsMobile();

  // Helper to normalize path matching
  const isPathInWorktree = (filePath: string, wtPath: string) => {
    const normFile = filePath.toLowerCase().replace(/\\/g, '/');
    const normWt = wtPath.toLowerCase().replace(/\\/g, '/');
    return normFile === normWt || normFile.startsWith(normWt + '/');
  };

  /**
   * Determine which workspace currently "owns" the active tab.
   */
  const activeWorkspaceId = React.useMemo(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return null;

    // Check if workspaceActiveTab maps any workspace to the current activeTabId
    for (const [wsId, tabId] of Object.entries(workspaceActiveTab)) {
      if (tabId === activeTabId) return wsId;
    }
    return null;
  }, [tabs, activeTabId, workspaceActiveTab]);

  return (
    <div className="workspace-list flex flex-col gap-2.5 px-3">
      {workspaces.map(w => {
        const isActive = activeWorkspaceId === w.id;
        
        const sortedWts = [...w.worktrees].sort((a, b) => (a.isMain ? -1 : b.isMain ? 1 : 0));

        return (
          <div
            key={w.id}
            className={`group p-3 rounded-lg border backdrop-blur-md transition-all duration-300 relative flex flex-col gap-2 cursor-pointer ${
              isActive
                ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.08)]'
                : 'border-white/5 bg-slate-900/10 hover:bg-slate-900/40 hover:border-purple-500/20'
            }`}
            onClick={() => onWorkspaceClick(w.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium truncate min-w-0 flex-1">
                <Folder size={16} className={isActive ? 'text-purple-400 shrink-0' : 'text-sky-400 shrink-0'} />
                <span
                  className={`text-sm font-semibold tracking-wide truncate ${isActive ? 'text-purple-200' : 'text-slate-100'}`}
                  title={w.path}
                >
                  {w.name}
                </span>

                {isActive && (
                  <span className="ws-active-badge shrink-0" title="Active workspace tab">
                    <Check size={10} strokeWidth={3} />
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
              />
            </div>

            <div className="text-[10px] text-slate-500 font-mono truncate" title={w.path}>{w.path}</div>

            {/* Tree-like display if there are worktrees */}
            {w.isGit && w.worktrees.length > 0 && (
              <div className="mt-1 flex flex-col">
                {sortedWts.map((wt, idx) => {
                  const isLast = idx === sortedWts.length - 1;
                  
                  // Check if this worktree is currently active (has the focused tab)
                  const isWtActive = activeTabId && tabs.some(t => t.id === activeTabId && (
                    (t.type === 'file' && t.filePath && isPathInWorktree(t.filePath, wt.path)) ||
                    (t.type === 'terminal' && t.layout && getTerminalIds(t.layout).some(id => {
                      const inst = terminalInstances[id];
                      return inst && isPathInWorktree(inst.cwd, wt.path);
                    }))
                  ));

                  return (
                    <div
                      key={wt.path}
                      className={`tree-connector-wrapper ${isLast ? 'tree-item-last' : ''}`}
                    >
                      <div className="tree-connector" />
                      <div className="tree-item-content">
                        <div
                          className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 transition-all text-xs cursor-pointer group/item ${
                            isWtActive 
                              ? 'bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20' 
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (wt.isMain) {
                              onWorkspaceClick(w.id);
                            } else {
                              onWorktreeClick(w.id, wt.path);
                            }
                          }}
                        >
                          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0" title={wt.path}>
                            <GitBranch size={11} className={isWtActive ? 'text-purple-400 shrink-0' : (wt.isDirty ? 'text-amber-400 shrink-0' : 'text-slate-500 shrink-0')} />
                            <span className={`truncate ${isWtActive ? 'text-purple-200' : (wt.isDirty ? 'text-amber-400' : 'text-slate-400')}`}>
                              {wt.branch || 'detached'}
                            </span>
                            {wt.isDirty && wt.dirtyCount !== undefined && wt.dirtyCount > 0 && (
                              <span className="badge badge-dirty shrink-0" title={`${wt.dirtyCount} uncommitted changes`}>
                                {wt.dirtyCount}
                              </span>
                            )}
                            <span className={`badge ${wt.isMain ? 'badge-main' : 'badge-worktree'} shrink-0`}>
                              {wt.isMain ? 'main' : 'wt'}
                            </span>
                            {isWtActive && (
                              <span className="ws-active-badge shrink-0" style={{ width: '12px', height: '12px', fontSize: '6px' }} title="Active worktree tab">
                                <Check size={8} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          
                          <div className={`flex gap-1 shrink-0 ${isMobile ? '' : 'opacity-0 group-hover/item:opacity-100 transition-opacity duration-150'}`}>
                            <button
                              className="action-btn"
                              onClick={(e) => { e.stopPropagation(); openTerminal(wt.isMain ? w.name : `${w.name} (${wt.branch || 'detached'})`, wt.path, w.defaultShell); }}
                              title={`Open terminal here (${w.defaultShell || 'default'})`}
                            >
                              <TerminalIcon size={11} />
                            </button>
                            {!wt.isMain && (
                              <button
                                className="action-btn action-btn-danger"
                                onClick={(e) => { e.stopPropagation(); handleRemoveWorktree(w.path, wt.path); }}
                                title="Delete worktree"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
