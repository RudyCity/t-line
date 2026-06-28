import React from 'react';
import { GitBranch, ZoomIn, ZoomOut, ExternalLink, Copy, Check } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';

export interface FooterProps {
  panelWorkspace: WorkspaceInfo | null;
  tunnelStatus: {
    active: boolean;
    url: string | null;
    type: 'quick' | 'token' | 'none';
    error: string | null;
  };
  terminalFontSize: number;
  defaultShell: string;
  setDefaultShell: (val: string) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleStartTunnel: (type: 'quick' | 'token') => void;
  handleStopTunnel: () => void;
}

export function Footer({
  panelWorkspace,
  tunnelStatus,
  terminalFontSize,
  defaultShell,
  setDefaultShell,
  handleZoomIn,
  handleZoomOut,
  handleStartTunnel,
  handleStopTunnel
}: FooterProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!tunnelStatus.url) return;
    try {
      await navigator.clipboard.writeText(tunnelStatus.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getWorkspaceActiveBranch = (workspace: WorkspaceInfo | null): { name: string; isDirty: boolean; isMain: boolean } | null => {
    if (!workspace || !workspace.isGit || !workspace.worktrees || workspace.worktrees.length === 0) return null;
    
    const activeWt = workspace.worktrees.find(wt => wt.path === workspace.path) 
      || workspace.worktrees.find(wt => wt.isMain) 
      || workspace.worktrees[0];
      
    if (!activeWt) return null;
    return {
      name: activeWt.branch || 'detached',
      isDirty: !!activeWt.isDirty,
      isMain: activeWt.isMain
    };
  };
  return (
    <footer className="app-footer flex items-center justify-between px-[20px] py-2 border-t border-white/5 bg-slate-950/85 text-xs text-slate-400 select-none shrink-0 h-9 z-20">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 font-medium text-slate-300">
          <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_6px_#a855f7]" />
          <span>t-line v1.1.3</span>
        </span>

        {panelWorkspace && (
          <span className="text-[11px] font-mono text-slate-500 hidden sm:flex items-center gap-2">
            <span>Workspace: {panelWorkspace.name}</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400 font-sans text-xs truncate max-w-[200px]" title={panelWorkspace.path}>
              {panelWorkspace.path}
            </span>
            {(() => {
              const activeBranch = getWorkspaceActiveBranch(panelWorkspace);
              if (!activeBranch) return null;
              return (
                <>
                  <span className="text-slate-700">|</span>
                  <span className="flex items-center gap-1 text-[11px] text-purple-400 font-sans" title={activeBranch.isDirty ? "Uncommitted changes" : "Git Branch"}>
                    <GitBranch size={11} className={activeBranch.isMain ? 'text-purple-400' : 'text-emerald-400'} />
                    <span className={activeBranch.isDirty ? 'text-amber-400 font-medium' : ''}>
                      {activeBranch.name}
                    </span>
                    {activeBranch.isDirty && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_#f59e0b]" />
                    )}
                  </span>
                </>
              );
            })()}
          </span>
        )}
      </div>

      {/* Zoom & Shell Controls (Dashboard Pill) */}
      <div className="flex items-center gap-3 bg-white/5 px-2.5 py-1 rounded border border-white/5">
        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button 
            className="action-btn text-slate-400 hover:text-white" 
            onClick={handleZoomOut} 
            title="Zoom Out Terminal font"
            style={{ padding: '1px', display: 'flex', alignItems: 'center' }}
          >
            <ZoomOut size={11} />
          </button>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {terminalFontSize}px
          </span>
          <button 
            className="action-btn text-slate-400 hover:text-white" 
            onClick={handleZoomIn} 
            title="Zoom In Terminal font"
            style={{ padding: '1px', display: 'flex', alignItems: 'center' }}
          >
            <ZoomIn size={11} />
          </button>
        </div>

        <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.08)' }} />

        {/* Shell Selector */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Shell:</span>
          <select 
            value={defaultShell} 
            onChange={(e) => setDefaultShell(e.target.value)}
            style={{ 
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.65rem', 
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0',
              outline: 'none'
            }}
            title="Default Shell for new tabs"
          >
            <option value="powershell" style={{ background: '#0e111a', color: 'var(--text-main)' }}>powershell</option>
            <option value="cmd" style={{ background: '#0e111a', color: 'var(--text-main)' }}>cmd</option>
            <option value="gitbash" style={{ background: '#0e111a', color: 'var(--text-main)' }}>gitbash</option>
            <option value="wsl" style={{ background: '#0e111a', color: 'var(--text-main)' }}>wsl</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">Cloudflare Tunnel:</span>
          <span className="flex items-center gap-1.5 font-medium px-2 py-0.5 rounded bg-white/5 text-[11px]">
            <span className={`h-1.5 w-1.5 rounded-full ${tunnelStatus.active ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]' : 'bg-red-400 shadow-[0_0_6px_#f87171]'}`} />
            <span className={tunnelStatus.active ? 'text-emerald-400' : 'text-red-400'}>
              {tunnelStatus.active ? 'Active' : 'Inactive'}
            </span>
          </span>
        </div>

        {tunnelStatus.active && tunnelStatus.url && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-sky-400 max-w-[200px] truncate" title={tunnelStatus.url}>
              {tunnelStatus.url}
            </span>
            <a 
              href={tunnelStatus.url} 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded transition-all duration-150"
            >
              <span>Open</span>
              <ExternalLink size={10} />
            </a>
            <button 
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded transition-all duration-150 cursor-pointer"
              title="Copy tunnel URL"
            >
              {copied ? (
                <>
                  <span>Copied</span>
                  <Check size={10} className="text-emerald-400" />
                </>
              ) : (
                <>
                  <span>Copy</span>
                  <Copy size={10} />
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center gap-1">
          {tunnelStatus.active ? (
            <button 
              onClick={handleStopTunnel}
              className="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[10px] font-medium transition-all cursor-pointer"
            >
              Stop
            </button>
          ) : (
            <>
              <button 
                onClick={() => handleStartTunnel('quick')}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-medium transition-all cursor-pointer"
              >
                Quick URL
              </button>
              <button 
                onClick={() => handleStartTunnel('token')}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-medium transition-all cursor-pointer"
              >
                Custom
              </button>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
