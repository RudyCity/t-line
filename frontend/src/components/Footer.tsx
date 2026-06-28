import React from 'react';
import { GitBranch, ZoomIn, ZoomOut, ExternalLink, Copy, Check, Info, Terminal, Folder, Globe, RefreshCw } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';
import { Toast } from './Toast';

export interface FooterProps {
  panelWorkspace: WorkspaceInfo | null;
  tunnelStatus: {
    active: boolean;
    url: string | null;
    type: 'quick' | 'token' | 'none';
    error: string | null;
  };
  tunnelLoading: boolean;
  terminalFontSize: number;
  defaultShell: string;
  setDefaultShell: (val: string) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleStartTunnel: (type: 'quick' | 'token') => void;
  handleStopTunnel: () => void;
  activeTabType?: 'terminal' | 'file' | null;
  onRefreshTerminal?: () => void;
  activeTabPath?: string;
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
  handleStopTunnel,
  tunnelLoading,
  activeTabType,
  onRefreshTerminal,
  activeTabPath
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

  const getWorkspaceActiveBranch = (
    workspace: WorkspaceInfo | null,
    tabPath?: string
  ): { name: string; isDirty: boolean; isMain: boolean } | null => {
    if (!workspace || !workspace.isGit || !workspace.worktrees || workspace.worktrees.length === 0) return null;
    
    const isPathInWorktree = (filePath: string, wtPath: string) => {
      const normFile = filePath.toLowerCase().replace(/\\/g, '/');
      const normWt = wtPath.toLowerCase().replace(/\\/g, '/');
      return normFile === normWt || normFile.startsWith(normWt + '/');
    };

    let activeWt = null;
    if (tabPath) {
      activeWt = workspace.worktrees.find(wt => isPathInWorktree(tabPath, wt.path));
    }

    if (!activeWt) {
      activeWt = workspace.worktrees.find(wt => wt.path === workspace.path) 
        || workspace.worktrees.find(wt => wt.isMain) 
        || workspace.worktrees[0];
    }
      
    if (!activeWt) return null;
    return {
      name: activeWt.branch || 'detached',
      isDirty: !!activeWt.isDirty,
      isMain: activeWt.isMain
    };
  };

  const getRelativeActivePath = (
    workspace: WorkspaceInfo | null,
    tabPath?: string
  ): string => {
    if (!workspace) return '';
    if (!tabPath) return workspace.name;

    const normTab = tabPath.toLowerCase().replace(/\\/g, '/');
    
    if (workspace.worktrees) {
      for (const wt of workspace.worktrees) {
        const normWt = wt.path.toLowerCase().replace(/\\/g, '/');
        if (normTab === normWt || normTab.startsWith(normWt + '/')) {
          const rel = tabPath.slice(wt.path.length).replace(/\\/g, '/');
          const cleanRel = rel.startsWith('/') ? rel.slice(1) : rel;
          const prefix = wt.isMain ? workspace.name : `${workspace.name} (${wt.branch || 'wt'})`;
          return cleanRel ? `${prefix}/${cleanRel}` : prefix;
        }
      }
    }

    const normWS = workspace.path.toLowerCase().replace(/\\/g, '/');
    if (normTab.startsWith(normWS)) {
      const rel = tabPath.slice(workspace.path.length).replace(/\\/g, '/');
      const cleanRel = rel.startsWith('/') ? rel.slice(1) : rel;
      return cleanRel ? `${workspace.name}/${cleanRel}` : workspace.name;
    }

    return workspace.name;
  };

  return (
    <>
      <footer className="app-footer flex items-center justify-between px-6 border-t border-white/10 bg-[#080b13]/90 backdrop-blur-md text-xs text-slate-400 select-none shrink-0 h-9 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
      {/* Left Section: Version & Workspace */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-sans text-[10px] font-semibold tracking-wider hover:bg-purple-500/20 hover:border-purple-500/35 transition-all duration-200 cursor-pointer">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]" />
          <span>t-line v1.3.54</span>
        </span>

        {panelWorkspace && (
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <span className="text-slate-700">|</span>
            <span
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors duration-150 cursor-pointer"
              title={`Open in Explorer: ${activeTabPath || panelWorkspace.path}`}
              onClick={() => {
                const folderPath = activeTabPath || panelWorkspace.path;
                if ((window as any).electron?.openFolder) {
                  (window as any).electron.openFolder(folderPath);
                }
              }}
            >
              <Folder size={11} className="text-purple-400" />
              <span className="font-semibold text-slate-300 truncate max-w-[250px]">{getRelativeActivePath(panelWorkspace, activeTabPath)}</span>
            </span>
            
            {(() => {
              const activeBranch = getWorkspaceActiveBranch(panelWorkspace, activeTabPath);
              if (!activeBranch) return null;
              return (
                <>
                  <span className="text-slate-700">|</span>
                  <span 
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded font-sans text-[11px] transition-all duration-150 ${
                      activeBranch.isDirty 
                        ? 'bg-amber-500/5 border border-amber-500/20 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/30' 
                        : 'bg-slate-900/60 border border-white/5 text-slate-300 hover:border-white/10 hover:bg-slate-900'
                    }`} 
                    title={activeBranch.isDirty ? "Uncommitted changes" : "Git Branch"}
                  >
                    <GitBranch size={11} className={activeBranch.isMain ? 'text-purple-400' : 'text-emerald-400'} />
                    <span className="font-medium">{activeBranch.name}</span>
                  </span>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Center Section: Zoom & Shell Controls (Dashboard Pill) — hidden on mobile */}
      <div className="hidden sm:flex items-center gap-3 bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full border border-white/5 hover:border-white/10 transition-all duration-200 shadow-inner">
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button 
            className="text-slate-400 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer p-0.5 rounded flex items-center justify-center animate-none" 
            onClick={handleZoomOut} 
            title="Zoom Out Terminal font"
          >
            <ZoomOut size={12} />
          </button>
          <span className="text-[10px] bg-slate-950/60 px-1.5 py-0.5 rounded font-mono font-semibold text-purple-300 min-w-[28px] text-center border border-white/5">
            {terminalFontSize}px
          </span>
          <button 
            className="text-slate-400 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer p-0.5 rounded flex items-center justify-center animate-none" 
            onClick={handleZoomIn} 
            title="Zoom In Terminal font"
          >
            <ZoomIn size={12} />
          </button>
        </div>

        <div className="w-px h-3.5 bg-white/10" />

        {/* Shell Selector */}
        <div className="flex items-center gap-1.5">
          <Terminal size={11} className="text-slate-400" />
          <select 
            value={defaultShell} 
            onChange={(e) => setDefaultShell(e.target.value)}
            className="bg-transparent border-none text-slate-300 font-mono font-semibold text-[10px] cursor-pointer outline-none focus:ring-0 select-none py-0 pr-4 pl-0 transition-colors duration-150 hover:text-white"
            title="Default Shell for new tabs"
            style={{ 
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='rgba(148,163,184,0.8)' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
              backgroundPosition: 'right center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '8px 8px',
            }}
          >
            <option value="powershell" className="bg-[#0b0e14] text-slate-300">powershell</option>
            <option value="cmd" className="bg-[#0b0e14] text-slate-300">cmd</option>
            <option value="gitbash" className="bg-[#0b0e14] text-slate-300">gitbash</option>
            <option value="wsl" className="bg-[#0b0e14] text-slate-300">wsl</option>
          </select>
        </div>

        {activeTabType === 'terminal' && onRefreshTerminal && (
          <>
            <div className="w-px h-3.5 bg-white/10" />
            <button
              onClick={onRefreshTerminal}
              className="text-slate-400 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer p-0.5 rounded flex items-center justify-center animate-none"
              title="Restart current terminal process"
            >
              <RefreshCw size={11} className="hover:rotate-45 transition-transform duration-200" />
            </button>
          </>
        )}
      </div>

      {/* Right Section: Cloudflare Tunnel & Status — hidden on mobile */}
      <div className="hidden sm:flex items-center gap-2.5">
        {/* Cloudflare Tunnel status */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 hidden md:inline-block">Cloudflare Tunnel:</span>
          
          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
            tunnelLoading 
              ? 'bg-sky-500/5 border-sky-500/20 text-sky-400' 
              : (tunnelStatus.active 
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.05)]' 
                  : 'bg-slate-900/60 border-white/5 text-slate-500')
          }`}>
            {tunnelLoading ? (
              <span className="h-1.5 w-1.5 rounded-full border border-sky-400/30 border-t-sky-400 animate-spin" />
            ) : (
              <span className={`h-1.5 w-1.5 rounded-full ${
                tunnelStatus.active 
                  ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]' 
                  : 'bg-slate-600'
              }`} />
            )}
            <span className="font-semibold">
              {tunnelLoading 
                ? (tunnelStatus.active ? 'Stopping...' : 'Starting...') 
                : (tunnelStatus.active ? 'Active' : 'Inactive')}
            </span>
          </span>
        </div>

        {/* Active Tunnel URL Info */}
        {tunnelStatus.active && tunnelStatus.url && (
          <div className="flex items-center gap-1.5 bg-sky-950/20 border border-sky-500/20 px-2 py-0.5 rounded-md text-[10px] font-mono text-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.05)]">
            <Globe size={11} className="text-sky-400 animate-pulse" />
            <span className="max-w-[140px] md:max-w-[200px] truncate" title={tunnelStatus.url}>
              {tunnelStatus.url.replace(/^https?:\/\//, '')}
            </span>
            
            <div className="w-px h-2.5 bg-sky-500/20" />
            
            <div className="flex items-center gap-1">
              <a 
                href={tunnelStatus.url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-slate-400 hover:text-sky-300 p-0.5 rounded transition-colors duration-150 flex items-center justify-center"
                title="Open Tunnel URL"
              >
                <ExternalLink size={10} />
              </a>
              <button 
                onClick={handleCopy}
                className="text-slate-400 hover:text-purple-300 p-0.5 rounded transition-colors duration-150 flex items-center justify-center cursor-pointer"
                title="Copy Tunnel URL"
              >
                {copied ? (
                  <Check size={10} className="text-emerald-400" />
                ) : (
                  <Copy size={10} />
                )}
              </button>
              {tunnelStatus.type === 'quick' && (
                <span 
                  className="text-slate-500 hover:text-slate-300 transition-colors cursor-help flex items-center p-0.5" 
                  title="Tip: Newly created trycloudflare URLs can take 5-15 seconds for DNS to propagate. If you see 'Site can't be reached', wait a few seconds and reload."
                >
                  <Info size={11} />
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {tunnelStatus.active ? (
            <button 
              onClick={handleStopTunnel}
              disabled={tunnelLoading}
              className={`px-2.5 py-0.5 rounded-full border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[10px] font-medium transition-all duration-150 hover:-translate-y-[0.5px] active:translate-y-0 ${
                tunnelLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              Stop
            </button>
          ) : (
            <>
              <button 
                onClick={() => handleStartTunnel('quick')}
                disabled={tunnelLoading}
                className={`px-2.5 py-0.5 rounded-full border border-purple-500/25 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 text-[10px] font-medium transition-all duration-150 hover:-translate-y-[0.5px] active:translate-y-0 ${
                  tunnelLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                Quick URL
              </button>
              <button 
                onClick={() => handleStartTunnel('token')}
                disabled={tunnelLoading}
                className={`px-2.5 py-0.5 rounded-full border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] font-medium transition-all duration-150 hover:-translate-y-[0.5px] active:translate-y-0 ${
                  tunnelLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                Custom
              </button>
            </>
          )}
        </div>
      </div>
    </footer>
    <Toast />
    </>
  );
}
