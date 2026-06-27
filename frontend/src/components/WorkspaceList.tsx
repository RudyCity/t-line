import React from 'react';
import { Folder, GitFork, GitCompare, FolderTree, Terminal as TerminalIcon, Trash2, GitBranch } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';

export interface WorkspaceListProps {
  workspaces: WorkspaceInfo[];
  setPanelWorkspace: (ws: WorkspaceInfo | null) => void;
  setActivePanel: (panel: 'workspaces' | 'explorer' | 'changes') => void;
  handleOpenWorktreeModal: (w: WorkspaceInfo) => void;
  openTerminal: (name: string, path: string, shell?: string) => void;
  handleRemoveWorkspace: (path: string) => void;
  handleRemoveWorktree: (repoPath: string, wtPath: string) => void;
}

export function WorkspaceList({
  workspaces,
  setPanelWorkspace,
  setActivePanel,
  handleOpenWorktreeModal,
  openTerminal,
  handleRemoveWorkspace,
  handleRemoveWorktree
}: WorkspaceListProps): React.JSX.Element {
  return (
    <div className="workspace-list flex flex-col gap-2.5 px-3">
      {workspaces.map(w => (
        <div key={w.id} className="group p-3 rounded-lg border border-white/5 bg-slate-900/10 backdrop-blur-md hover:bg-slate-900/40 hover:border-purple-500/20 transition-all duration-300 relative overflow-hidden flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium truncate">
              <Folder size={16} className="text-sky-400 shrink-0" />
              <span className="text-sm font-semibold tracking-wide text-slate-100 truncate" title={w.path}>{w.name}</span>
            </div>
            
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
              {w.isGit && (
                <button className="action-btn" onClick={() => handleOpenWorktreeModal(w)} title="New Worktree branch">
                  <GitFork size={13} />
                </button>
              )}
              {w.isGit && (
                <button className="action-btn" onClick={() => { setPanelWorkspace(w); setActivePanel('changes'); }} title="Git Changes">
                  <GitCompare size={13} />
                </button>
              )}
              <button className="action-btn" onClick={() => { setPanelWorkspace(w); setActivePanel('explorer'); }} title="Browse Files">
                <FolderTree size={13} />
              </button>
              <button className="action-btn" onClick={() => openTerminal(w.name, w.path, w.defaultShell)} title={`Open terminal (${w.defaultShell || 'default'})`}>
                <TerminalIcon size={13} />
              </button>
              <button className="action-btn action-btn-danger" onClick={() => handleRemoveWorkspace(w.path)} title="Remove workspace">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">{w.path}</div>

          {w.isGit && w.worktrees.length > 0 && (
            <div className="mt-2 pl-2 border-l border-dashed border-white/10 flex flex-col gap-1.5">
              {w.worktrees.map(wt => (
                <div key={wt.path} className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 transition-all text-xs cursor-pointer group/item">
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
                  <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 shrink-0">
                     <button className="action-btn" onClick={() => openTerminal(`${w.name} (${wt.branch || 'detached'})`, wt.path, w.defaultShell)} title={`Open terminal here (${w.defaultShell || 'default'})`}>
                      <TerminalIcon size={11} />
                    </button>
                    {!wt.isMain && (
                      <button className="action-btn action-btn-danger" onClick={() => handleRemoveWorktree(w.path, wt.path)} title="Delete worktree">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
