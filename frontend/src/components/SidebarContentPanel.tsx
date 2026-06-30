import React from 'react';
import { Plus, Terminal as TerminalIcon, FileCode, FolderTree, GitCompare, GitBranch } from 'lucide-react';
import { TabData, TerminalInstanceData, WorkspaceInfo, WorktreeInfo } from '../hooks/useTerminals';
import { WorkspaceList } from './WorkspaceList';
import { FileExplorer, GitChanges, GitFileStatus } from './FilePanel';

// ─── Permanent Workspace + Worktree Switcher ────────────────────────────────

interface WorkspaceSwitcherProps {
  panelWorkspace: WorkspaceInfo | null;
  panelWorktreePath: string | null;
  onWorkspaceClick: (wsId: string) => void;
  onWorktreeClick: (wsId: string, wtPath: string) => void;
}

function WorkspaceSwitcher({
  panelWorkspace,
  panelWorktreePath,
  onWorkspaceClick,
  onWorktreeClick,
}: WorkspaceSwitcherProps) {
  if (!panelWorkspace) return null;

  const mainWt: WorktreeInfo | undefined = panelWorkspace.worktrees?.find(wt => wt.isMain);
  const otherWts: WorktreeInfo[] = panelWorkspace.worktrees?.filter(wt => !wt.isMain) ?? [];
  const hasWorktrees = (panelWorkspace.worktrees?.length ?? 0) > 0;

  const isMainActive = !panelWorktreePath || panelWorktreePath === mainWt?.path;

  return (
    <>
      <style>{`
        .ws-switcher {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.12);
          flex-shrink: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .ws-switcher::-webkit-scrollbar { display: none; }
        .ws-switcher-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-main);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          white-space: nowrap;
          flex-shrink: 0;
          padding-right: 4px;
        }
        .ws-pill-sep {
          color: rgba(255,255,255,0.2);
          font-size: 0.65rem;
          flex-shrink: 0;
          user-select: none;
        }
        .ws-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.68rem;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.03);
          color: var(--text-muted);
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.13s;
        }
        .ws-pill:hover {
          background: rgba(255,255,255,0.07);
          color: var(--text-main);
          border-color: rgba(255,255,255,0.14);
        }
        .ws-pill-active {
          background: rgba(168,85,247,0.13) !important;
          border-color: rgba(168,85,247,0.35) !important;
          color: var(--color-primary, #a855f7) !important;
        }
      `}</style>

      <div className="ws-switcher">
        {/* Active workspace name */}
        <span className="ws-switcher-label">{panelWorkspace.name}</span>

        {hasWorktrees && (
          <>
            <span className="ws-pill-sep">›</span>

            {/* Main worktree */}
            <button
              className={`ws-pill${isMainActive ? ' ws-pill-active' : ''}`}
              onClick={() => onWorkspaceClick(panelWorkspace.id)}
              title={mainWt?.path ?? panelWorkspace.path}
            >
              <GitBranch size={10} />
              {mainWt?.branch || 'main'}
            </button>

            {/* Other worktrees */}
            {otherWts.map(wt => {
              const isActive = panelWorktreePath === wt.path;
              const label = wt.branch || wt.path.split(/[\\/]/).pop() || 'worktree';
              return (
                <button
                  key={wt.path}
                  className={`ws-pill${isActive ? ' ws-pill-active' : ''}`}
                  onClick={() => onWorktreeClick(panelWorkspace.id, wt.path)}
                  title={wt.path}
                >
                  <GitBranch size={10} />
                  {label}
                </button>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}


// ─── SidebarContentPanel ────────────────────────────────────────────────────

interface SidebarContentPanelProps {
  activePanel: 'workspaces' | 'explorer' | 'changes' | 'tabs';
  setActivePanel: (panel: 'workspaces' | 'explorer' | 'changes' | 'tabs') => void;
  workspaces: WorkspaceInfo[];
  panelWorkspace: WorkspaceInfo | null;
  setPanelWorkspace: (ws: WorkspaceInfo | null) => void;
  tabs: TabData[];
  setActiveTabId: (id: string) => void;
  activeTabId: string;
  terminalInstances: Record<string, TerminalInstanceData>;
  setShowWorkspaceModal: (show: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  handleOpenWorktreeModal: (ws: WorkspaceInfo) => void;
  openTerminal: (name: string, cwd: string) => void;
  handleRemoveWorkspace: (id: string) => void;
  handleRemoveWorktree: (wsId: string, path: string) => void;
  openFileTab: (filePath: string, name: string) => void;
  closeTerminal: (id: string, e: React.MouseEvent) => void;
  workspaceActiveTab: Record<string, string>;
  onWorkspaceClick: (wsId: string) => void;
  onWorktreeClick: (wsId: string, wtPath: string) => void;
  changedFiles?: GitFileStatus[];
  gitStatusLoading?: boolean;
  refreshGitStatus?: () => void;
  onEditWorkspace?: (ws: WorkspaceInfo) => void;
  deletingWorkspacePaths?: string[];
  deletingWorktreePaths?: string[];
  panelWorktreePath?: string | null;
  fsChangeTrigger?: number;
  onOpenBranchModal?: () => void;
}

export function SidebarContentPanel({
  activePanel,
  setActivePanel,
  workspaces,
  panelWorkspace,
  setPanelWorkspace,
  tabs,
  setActiveTabId,
  activeTabId,
  terminalInstances,
  setShowWorkspaceModal,
  setSidebarOpen,
  handleOpenWorktreeModal,
  openTerminal,
  handleRemoveWorkspace,
  handleRemoveWorktree,
  openFileTab,
  closeTerminal,
  workspaceActiveTab,
  onWorkspaceClick,
  onWorktreeClick,
  changedFiles = [],
  gitStatusLoading = false,
  refreshGitStatus,
  onEditWorkspace,
  deletingWorkspacePaths = [],
  deletingWorktreePaths = [],
  panelWorktreePath = null,
  fsChangeTrigger = 0,
  onOpenBranchModal
}: SidebarContentPanelProps) {
  return (
    <div
      className="sidebar-content"
      style={{
        padding: activePanel === 'workspaces' ? '16px 0px' : '0px',
        gap: activePanel === 'workspaces' ? '16px' : '0px'
      }}
    >
      {/* ── Active Tabs / Terminals Panel (Mobile Only) ── */}
      {activePanel === 'tabs' && (
        <div className="flex flex-col gap-3 p-4 w-full h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Active Tabs</span>
            <button
              className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              onClick={() => {
                openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '');
                setSidebarOpen(false);
              }}
            >
              <Plus size={12} />
              <span>New Tab</span>
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {tabs.map(t => {
              const isFile = t.type === 'file';
              const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
              const shellType = focusedInst?.shellType || '';
              const isActive = activeTabId === t.id;

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveTabId(t.id);
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-600/10 border-purple-500/30 text-purple-200 shadow-sm'
                      : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {isFile ? (
                      <FileCode size={13} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
                    ) : (
                      <TerminalIcon size={13} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
                    )}
                    <span className="text-xs font-semibold truncate">{t.name}</span>
                    {shellType && (
                      <span className="text-[9px] font-mono opacity-50">({shellType})</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTerminal(t.id, e);
                    }}
                    className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors text-sm font-bold"
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {tabs.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">No active tabs</div>
            )}
          </div>
        </div>
      )}

      {/* ── Workspaces Panel ── */}
      {activePanel === 'workspaces' && (
        <div>
          <div className="section-title" style={{ padding: '0 16px' }}>
            <span>Workspaces</span>
            <button className="action-btn" onClick={() => { setShowWorkspaceModal(true); setSidebarOpen(false); }} title="Add Workspace">
              <Plus size={16} />
            </button>
          </div>

          <WorkspaceList
            workspaces={workspaces}
            tabs={tabs}
            activeTabId={activeTabId}
            terminalInstances={terminalInstances}
            workspaceActiveTab={workspaceActiveTab}
            onWorkspaceClick={onWorkspaceClick}
            onWorktreeClick={onWorktreeClick}
            setPanelWorkspace={setPanelWorkspace}
            setActivePanel={setActivePanel}
            handleOpenWorktreeModal={handleOpenWorktreeModal}
            openTerminal={openTerminal}
            handleRemoveWorkspace={handleRemoveWorkspace}
            handleRemoveWorktree={handleRemoveWorktree}
            onEditWorkspace={onEditWorkspace || (() => {})}
            deletingWorkspacePaths={deletingWorkspacePaths}
            deletingWorktreePaths={deletingWorktreePaths}
            panelWorktreePath={panelWorktreePath}
            panelWorkspace={panelWorkspace}
          />

          {workspaces.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.85rem', padding: '16px' }}>
              No workspaces registered.
            </div>
          )}
        </div>
      )}

      {/* ── File Explorer Panel ── */}
      {activePanel === 'explorer' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {workspaces.length > 0 && panelWorkspace && (
            <WorkspaceSwitcher
              panelWorkspace={panelWorkspace}
              panelWorktreePath={panelWorktreePath}
              onWorkspaceClick={onWorkspaceClick}
              onWorktreeClick={onWorktreeClick}
            />
          )}
          {panelWorkspace ? (
            <FileExplorer
              rootPath={panelWorktreePath || panelWorkspace.path}
              token={localStorage.getItem('token') || ''}
              onFileClick={openFileTab}
              changedFiles={changedFiles}
              onRefresh={refreshGitStatus}
              refreshTrigger={fsChangeTrigger}
            />
          ) : (
            <div className="panel-empty" style={{ flex: 1 }}>
              <FolderTree size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <span>No workspace selected</span>
            </div>
          )}
        </div>
      )}

      {/* ── Git Changes Panel ── */}
      {activePanel === 'changes' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {workspaces.filter(w => w.isGit).length > 0 && panelWorkspace?.isGit && (
            <WorkspaceSwitcher
              panelWorkspace={panelWorkspace}
              panelWorktreePath={panelWorktreePath}
              onWorkspaceClick={onWorkspaceClick}
              onWorktreeClick={onWorktreeClick}
            />
          )}
          {panelWorkspace && panelWorkspace.isGit ? (
            <GitChanges
              workspaceId={panelWorkspace.id}
              token={localStorage.getItem('token') || ''}
              files={changedFiles}
              loading={gitStatusLoading}
              onRefresh={refreshGitStatus || (() => {})}
              worktreePath={panelWorktreePath}
              onOpenBranchModal={onOpenBranchModal}
              onFileOpen={openFileTab}
              workspacePath={panelWorkspace.path}
            />
          ) : (
            <div className="panel-empty" style={{ flex: 1 }}>
              <GitCompare size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <span>No Git workspace selected</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
