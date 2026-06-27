import React from 'react';
import { FolderPlus } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';

export interface EmptyDashboardProps {
  setShowWorkspaceModal: (val: boolean) => void;
  openTerminal: (name: string, path: string, shell?: string) => void;
  panelWorkspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
}

export function EmptyDashboard({
  setShowWorkspaceModal,
  openTerminal,
  panelWorkspace,
  workspaces
}: EmptyDashboardProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-center flex-1 p-4 sm:p-8">
      <div className="relative p-[1.5px] rounded-2xl bg-gradient-to-r from-purple-500/30 via-violet-600/30 to-cyan-500/30 shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden max-w-xl w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 blur-2xl opacity-40 pointer-events-none" />
        <div className="relative bg-[#07090f]/95 rounded-[14px] p-6 sm:p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 sm:mb-6 shadow-[0_0_15px_rgba(168,85,247,0.15)] animate-pulse">
            <FolderPlus className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-2 sm:mb-3 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Manage Workspaces & Git Worktrees
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs sm:max-w-sm mb-6 sm:mb-8 leading-relaxed">
            Register workspaces, view git branch/worktree checkouts, and launch terminal instances inside specific project directories.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button className="btn btn-primary w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm shadow-lg shadow-purple-500/10 hover:shadow-[0_0_15px_rgba(168,85,247,0.45)] transition-all duration-300 animate-pulse cursor-pointer" onClick={() => setShowWorkspaceModal(true)}>
              Add Workspace Folder
            </button>
            <button className="btn btn-secondary w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm border border-white/5 hover:border-white/10 cursor-pointer" onClick={() => openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '')}>
              Open Terminal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
