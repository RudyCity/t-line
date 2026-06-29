import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  setPanelWorkspace: (ws: WorkspaceInfo | null) => void;
  setActivePanel: (panel: 'workspaces' | 'explorer' | 'changes') => void;
  handleOpenWorktreeModal: (w: WorkspaceInfo) => void;
  openTerminal: (name: string, path: string, shell?: string) => void;
  handleRemoveWorkspace: (path: string) => void;
  handleRemoveWorktree: (repoPath: string, wtPath: string) => void;
  onEditWorkspace: (ws: WorkspaceInfo) => void;
  deletingWorkspacePaths?: string[];
  deletingWorktreePaths?: string[];
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
  isMobile: boolean;
  activeTabId: string;
  tabs: TabData[];
  terminalInstances: Record<string, any>;
  openTerminal: (name: string, path: string, shell?: string) => void;
  handleRemoveWorktree: (repoPath: string, wtPath: string) => void;
  onWorkspaceClick: (wsId: string) => void;
  onWorktreeClick: (wsId: string, wtPath: string) => void;
  isPathInWorktree: (filePath: string, wtPath: string) => boolean;
  deletingWorktreePaths?: string[];
}

function WorktreeList({
  w,
  isMobile,
  activeTabId,
  tabs,
  terminalInstances,
  openTerminal,
  handleRemoveWorktree,
  onWorkspaceClick,
  onWorktreeClick,
  isPathInWorktree,
  deletingWorktreePaths = []
}: WorktreeListProps) {
  const [expanded, setExpanded] = useState(false);

  const sortedWts = useMemo(
    () => [...w.worktrees].sort((a, b) => (a.isMain ? -1 : b.isMain ? 1 : 0)),
    [w.worktrees]
  );

  const visibleWts = expanded || sortedWts.length <= BRANCH_LIMIT
    ? sortedWts
    : sortedWts.slice(0, BRANCH_LIMIT);

  const hiddenCount = sortedWts.length - BRANCH_LIMIT;

  if (!w.isGit || w.worktrees.length === 0) return null;

  return (
    <div className="mt-0.5 flex flex-col">
      {visibleWts.map((wt, idx) => {
        const isLast = idx === visibleWts.length - 1 && (expanded || sortedWts.length <= BRANCH_LIMIT);

        const isWtActive = activeTabId && tabs.some(t => t.id === activeTabId && (
          (t.type === 'file' && t.filePath && isPathInWorktree(t.filePath, wt.path)) ||
          (t.type === 'terminal' && t.layout && getTerminalIds(t.layout).some(id => {
            const inst = terminalInstances[id];
            return inst && isPathInWorktree(inst.cwd, wt.path);
          }))
        ));

        const wtProcesses = getRunningProcessesForPath(wt.path, terminalInstances);
        const hasWtRunning = wtProcesses.length > 0;
        const isWtClaudeActive = wtProcesses.some(p => p.isClaude);
        const isWtGeminiActive = wtProcesses.some(p => p.isGemini);
        const isWtCursorActive = wtProcesses.some(p => p.isCursor);
        const isWtSuperagentActive = wtProcesses.some(p => p.isSuperagent);

        if (deletingWorktreePaths?.includes(wt.path)) {
          return (
            <div key={wt.path} className={`tree-connector-wrapper ${isLast ? 'tree-item-last' : ''} opacity-60 animate-pulse pointer-events-none`}>
              <div className="tree-connector" />
              <div className="tree-item-content">
                <div className="flex items-center gap-2 py-1 px-1.5 text-[10px] text-red-300 font-mono">
                  <span className="h-2 w-2 rounded-full border border-red-400 border-t-transparent animate-spin shrink-0" />
                  <span className="truncate">Removing {wt.branch || 'detached'}...</span>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={wt.path}
            className={`tree-connector-wrapper ${isLast ? 'tree-item-last' : ''}`}
          >
            <div className="tree-connector" />
            <div className="tree-item-content">
              <div
                className={`flex items-center justify-between py-0.5 px-1.5 rounded-md hover:bg-white/5 transition-all text-xs cursor-pointer group/item ${
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
                  <div className="relative flex items-center shrink-0">
                    <GitBranch size={10} className={isWtActive ? 'text-purple-400 shrink-0' : (wt.isDirty ? 'text-amber-400 shrink-0' : 'text-slate-500 shrink-0')} />
                    {hasWtRunning && (
                      <span className="absolute -bottom-0.5 -right-0.5 ws-active-dot" style={{ width: '4px', height: '4px', boxShadow: '0 0 4px #10b981' }} title="Active processes running in terminal" />
                    )}
                  </div>
                  <span className={`truncate text-[11px] ${isWtActive ? 'text-purple-200' : (wt.isDirty ? 'text-amber-400' : 'text-slate-400')}`}>
                    {wt.branch || 'detached'}
                  </span>
                  <span className={`badge ${wt.isMain ? 'badge-main' : 'badge-worktree'} shrink-0 text-[9px] px-1 py-0`}>
                    {wt.isMain ? 'main' : 'wt'}
                  </span>
                  {isWtActive && (
                    <span className="ws-active-badge shrink-0" style={{ width: '11px', height: '11px', fontSize: '6px' }} title="Active worktree tab">
                      <Check size={7} strokeWidth={3} />
                    </span>
                  )}

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
                    onClick={(e) => { e.stopPropagation(); openTerminal(wt.isMain ? w.name : `${w.name} (${wt.branch || 'detached'})`, wt.path, w.defaultShell); }}
                    title={`Open terminal here (${w.defaultShell || 'default'})`}
                  >
                    <TerminalIcon size={10} />
                  </button>
                  {!wt.isMain && (
                    <button
                      className="action-btn action-btn-danger"
                      onClick={(e) => { e.stopPropagation(); handleRemoveWorktree(w.path, wt.path); }}
                      title="Delete worktree"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Expand / Collapse toggle */}
      {sortedWts.length > BRANCH_LIMIT && (
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
  setPanelWorkspace,
  setActivePanel,
  handleOpenWorktreeModal,
  openTerminal,
  handleRemoveWorkspace,
  handleRemoveWorktree,
  onEditWorkspace,
  deletingWorkspacePaths = [],
  deletingWorktreePaths = []
}: WorkspaceListProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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
    const hasDirty = (w: WorkspaceInfo) =>
      w.worktrees.some(wt => wt.isDirty && (wt.dirtyCount ?? 0) > 0);

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

      {/* ── Workspace cards ── */}
      <div className="workspace-list flex flex-col gap-1.5 px-3">
        {displayedWorkspaces.map(w => {
          const isActive = activeWorkspaceId === w.id;
          const totalDirty = w.worktrees.reduce((acc, wt) => acc + (wt.dirtyCount ?? 0), 0);
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
              } ${isDropdownOpen ? 'ws-card-dropdown-open' : ''}`}
              onClick={() => onWorkspaceClick(w.id)}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-medium truncate min-w-0 flex-1">
                  <div className="relative flex items-center shrink-0">
                    <Folder
                      size={14}
                      className={`shrink-0 ${isActive ? 'text-purple-400' : hasDirtyChanges ? 'text-amber-400' : 'text-sky-400'}`}
                    />
                    {hasRunning && (
                      <span className="absolute -bottom-0.5 -right-0.5 ws-active-dot" title="Active processes running in terminal" />
                    )}
                  </div>
                  <span
                    className={`text-[12px] font-semibold tracking-wide truncate ${isActive ? 'text-purple-200' : 'text-slate-100'}`}
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
                isMobile={isMobile}
                activeTabId={activeTabId}
                tabs={tabs}
                terminalInstances={terminalInstances}
                openTerminal={openTerminal}
                handleRemoveWorktree={handleRemoveWorktree}
                onWorkspaceClick={onWorkspaceClick}
                onWorktreeClick={onWorktreeClick}
                isPathInWorktree={isPathInWorktree}
                deletingWorktreePaths={deletingWorktreePaths}
              />
            </div>
          );
        })}

        {displayedWorkspaces.length === 0 && search && (
          <div className="ws-empty-search">
            No workspaces match "<strong>{search}</strong>"
          </div>
        )}
      </div>
    </div>
  );
}
