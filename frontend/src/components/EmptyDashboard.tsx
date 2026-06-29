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
    <div className="welcome-card-outer">
      <div className="welcome-card-inner border border-white/5 bg-[#090c14]/40 backdrop-blur-md max-w-md w-full rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-center text-slate-400 mb-5 shadow-inner">
          <FolderPlus className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <h2 className="text-base sm:text-lg font-bold tracking-tight mb-3 text-slate-200">
          t-line Workspace Manager
        </h2>
        <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
          Manage your development directories and Git worktrees. Register a workspace folder to get started or open a terminal.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
          <button 
            className="px-4 py-2 rounded-lg bg-purple-600/90 hover:bg-purple-600 text-white font-semibold text-xs transition-all duration-150 active:scale-98 shadow-sm cursor-pointer" 
            onClick={() => setShowWorkspaceModal(true)}
          >
            Add Workspace
          </button>
          <button 
            className="px-4 py-2 rounded-lg border border-white/5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all duration-150 active:scale-98 cursor-pointer" 
            onClick={() => openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '')}
          >
            Open Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
