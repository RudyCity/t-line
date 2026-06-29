import React from 'react';
import { FolderPlus } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';

export interface EmptyDashboardProps {
  setShowWorkspaceModal: (val: boolean) => void;
  openTerminal: (name: string, path: string, shell?: string) => void;
  panelWorkspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
  panelWorktreePath?: string | null;
}

export function EmptyDashboard({
  setShowWorkspaceModal,
  openTerminal,
  panelWorkspace,
  workspaces,
  panelWorktreePath
}: EmptyDashboardProps): React.JSX.Element {
  return (
    <div className="welcome-card-outer">
      <div className="welcome-card-inner max-w-md w-full rounded-2xl">
        <div 
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border flex items-center justify-center mb-5 shadow-inner"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
            borderColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
            color: 'var(--color-primary)'
          }}
        >
          <FolderPlus className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <h2 className="text-base sm:text-lg font-bold tracking-tight mb-3" style={{ color: 'var(--text-main)' }}>
          t-line Workspace Manager
        </h2>
        <p className="text-[11px] sm:text-xs max-w-xs mb-6 leading-relaxed" style={{ color: 'color-mix(in srgb, var(--text-main) 70%, transparent)' }}>
          Manage your development directories and Git worktrees. Register a workspace folder to get started or open a terminal.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
          <button 
            className="px-4 py-2 rounded-lg text-white font-semibold text-xs transition-all duration-150 active:scale-98 shadow-sm cursor-pointer" 
            onClick={() => setShowWorkspaceModal(true)}
            style={{
              backgroundColor: 'var(--color-primary)',
              boxShadow: '0 2px 8px var(--color-primary-glow)',
              border: 'none'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)' }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-primary)' }}
          >
            Add Workspace
          </button>
          <button 
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-98 cursor-pointer border" 
            onClick={() => {
              const targetPath = panelWorktreePath || panelWorkspace?.path || workspaces[0]?.path || '';
              const targetWt = panelWorkspace?.worktrees?.find(wt => wt.path === panelWorktreePath);
              const targetName = panelWorktreePath 
                ? `${panelWorkspace?.name} (${targetWt?.branch || 'worktree'})`
                : 'Shell';
              openTerminal(targetName, targetPath, panelWorkspace?.defaultShell);
            }}
            style={{
              borderColor: 'var(--border-color)',
              backgroundColor: 'color-mix(in srgb, var(--bg-card) 60%, transparent)',
              color: 'color-mix(in srgb, var(--text-main) 80%, transparent)'
            }}
            onMouseOver={(e) => { 
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--text-main)';
            }}
            onMouseOut={(e) => { 
              e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--bg-card) 60%, transparent)';
              e.currentTarget.style.color = 'color-mix(in srgb, var(--text-main) 80%, transparent)';
            }}
          >
            Open Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
