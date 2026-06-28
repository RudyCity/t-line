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
  Check
} from 'lucide-react';
import { WorkspaceInfo, TabData, WorkspaceActiveTabMap } from '../hooks/useTerminals';

export interface WorkspaceListProps {
  workspaces: WorkspaceInfo[];
  tabs: TabData[];
  activeTabId: string;
  workspaceActiveTab: WorkspaceActiveTabMap;
  onWorkspaceClick: (wsId: string) => void;
  setPanelWorkspace: (ws: WorkspaceInfo | null) => void;
  setActivePanel: (panel: 'workspaces' | 'explorer' | 'changes') => void;
  handleOpenWorktreeModal: (w: WorkspaceInfo) => void;
  openTerminal: (name: string, path: string, shell?: string) => void;
  handleRemoveWorkspace: (path: string) => void;
  handleRemoveWorktree: (repoPath: string, wtPath: string) => void;
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
  isMobile: boolean;
  setPanelWorkspace: (ws: WorkspaceInfo | null) => void;
  setActivePanel: (panel: 'workspaces' | 'explorer' | 'changes') => void;
  handleOpenWorktreeModal: (w: WorkspaceInfo) => void;
  openTerminal: (name: string, path: string, shell?: string) => void;
  handleRemoveWorkspace: (path: string) => void;
}

function WorkspaceActions({
  w,
  isMobile,
  setPanelWorkspace,
  setActivePanel,
  handleOpenWorktreeModal,
  openTerminal,
  handleRemoveWorkspace
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
          {isMobile && <span className="ws-dropdown-label">New Worktree</span>}
        </button>
      )}
      {w.isGit && (
        <button
          className="action-btn"
          onClick={(e) => { e.stopPropagation(); setPanelWorkspace(w); setActivePanel('changes'); setOpen(false); }}
          title="Git Changes"
        >
          <GitCompare size={13} />
          {isMobile && <span className="ws-dropdown-label">Git Changes</span>}
        </button>
      )}
      <button
        className="action-btn"
        onClick={(e) => { e.stopPropagation(); setPanelWorkspace(w); setActivePanel('explorer'); setOpen(false); }}
        title="Browse Files"
      >
        <FolderTree size={13} />
        {isMobile && <span className="ws-dropdown-label">Browse Files</span>}
      </button>
      <button
        className="action-btn"
        onClick={(e) => { e.stopPropagation(); openTerminal(w.name, w.path, w.defaultShell); setOpen(false); }}
        title={`Open terminal (${w.defaultShell || 'default'})`}
      >
        <TerminalIcon size={13} />
        {isMobile && <span className="ws-dropdown-label">Open Terminal</span>}
      </button>
      <button
        className="action-btn action-btn-danger"
        onClick={(e) => { e.stopPropagation(); handleRemoveWorkspace(w.path); setOpen(false); }}
        title="Remove workspace"
      >
        <Trash2 size={13} />
        {isMobile && <span className="ws-dropdown-label">Remove</span>}
      </button>
    </>
  );

  if (isMobile) {
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

  // Desktop/Tablet: always-visible buttons
  return (
    <div className="flex gap-1 shrink-0">
      {actionButtons}
    </div>
  );
}

export function WorkspaceList({
  workspaces,
  tabs,
  activeTabId,
  workspaceActiveTab,
  onWorkspaceClick,
  setPanelWorkspace,
  setActivePanel,
  handleOpenWorktreeModal,
  openTerminal,
  handleRemoveWorkspace,
  handleRemoveWorktree
}: WorkspaceListProps): React.JSX.Element {
  const isMobile = useIsMobile();

  /**
   * Determine which workspace currently "owns" the active tab.
   * A workspace owns a tab if:
   *  - The tab is a terminal whose CWD starts with the workspace path
   *  - OR the workspace's saved active tab ID matches the current activeTabId
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

        return (
          <div
            key={w.id}
            className={`group p-3 rounded-lg border backdrop-blur-md transition-all duration-300 relative overflow-hidden flex flex-col gap-2 cursor-pointer ${
              isActive
                ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.08)]'
                : 'border-white/5 bg-slate-900/10 hover:bg-slate-900/40 hover:border-purple-500/20'
            }`}
            onClick={() => onWorkspaceClick(w.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium truncate min-w-0">
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
                isMobile={isMobile}
                setPanelWorkspace={setPanelWorkspace}
                setActivePanel={setActivePanel}
                handleOpenWorktreeModal={handleOpenWorktreeModal}
                openTerminal={openTerminal}
                handleRemoveWorkspace={handleRemoveWorkspace}
              />
            </div>

            <div className="text-[10px] text-slate-500 font-mono truncate">{w.path}</div>

            {w.isGit && w.worktrees.length > 0 && (
              <div className="mt-2 pl-2 border-l border-dashed border-white/10 flex flex-col gap-1.5">
                {w.worktrees.map(wt => (
                  <div
                    key={wt.path}
                    className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 transition-all text-xs cursor-pointer group/item"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 truncate" title={wt.path}>
                      <GitBranch size={12} className={wt.isMain ? 'text-purple-400' : 'text-emerald-400'} />
                      <span className={`truncate ${wt.isDirty ? 'text-amber-400 font-medium' : (wt.isMain ? 'text-slate-200' : 'text-slate-400')}`}>
                        {wt.branch || 'detached'}
                      </span>
                      {wt.isDirty && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_#f59e0b]" title="Uncommitted changes" />
                      )}
                      <span className={`badge ${wt.isMain ? 'badge-main' : 'badge-worktree'}`}>
                        {wt.isMain ? 'main' : 'wt'}
                      </span>
                    </div>
                    <div className={`flex gap-1 shrink-0 ${isMobile ? '' : 'opacity-0 group-hover/item:opacity-100 transition-opacity duration-150'}`}>
                      <button
                        className="action-btn"
                        onClick={(e) => { e.stopPropagation(); openTerminal(`${w.name} (${wt.branch || 'detached'})`, wt.path, w.defaultShell); }}
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
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
