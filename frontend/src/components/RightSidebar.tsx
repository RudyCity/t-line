import React from 'react';
import {
  Plus, Terminal as TerminalIcon, FileCode, Settings, LogOut, X,
  ZoomIn, ZoomOut, Globe, ExternalLink, Copy, Check, Info, RefreshCw
} from 'lucide-react';
import { TabData, TerminalInstanceData, WorkspaceInfo } from '../hooks/useTerminals';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: TabData[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  openTerminal: (name: string, cwd: string) => void;
  closeTerminal: (id: string, e: React.MouseEvent) => void;
  workspaces: WorkspaceInfo[];
  panelWorkspace: WorkspaceInfo | null;
  terminalInstances: Record<string, TerminalInstanceData>;
  setShowSettingsModal: (show: boolean) => void;
  handleLogout: () => void;
  // Terminal controls (from footer center section)
  terminalFontSize: number;
  defaultShell: string;
  setDefaultShell: (val: string) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  activeTabType?: 'terminal' | 'file' | null;
  onRefreshTerminal?: () => void;
  // Tunnel (from footer right section)
  tunnelStatus: {
    active: boolean;
    url: string | null;
    type: 'quick' | 'token' | 'none';
    error: string | null;
  };
  tunnelLoading: boolean;
  handleStartTunnel: (type: 'quick' | 'token') => void;
  handleStopTunnel: () => void;
}

export function RightSidebar({
  isOpen,
  onClose,
  tabs,
  activeTabId,
  setActiveTabId,
  openTerminal,
  closeTerminal,
  workspaces,
  panelWorkspace,
  terminalInstances,
  setShowSettingsModal,
  handleLogout,
  terminalFontSize,
  defaultShell,
  setDefaultShell,
  handleZoomIn,
  handleZoomOut,
  activeTabType,
  onRefreshTerminal,
  tunnelStatus,
  tunnelLoading,
  handleStartTunnel,
  handleStopTunnel,
}: RightSidebarProps) {
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

  return (
    <div className={`right-sidebar ${isOpen ? 'right-sidebar-open' : ''}`}>
      {/* Header */}
      <div className="sidebar-header flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-purple-400 shrink-0" />
          <span className="logo-text" style={{ fontSize: '1.05rem', fontWeight: 600 }}>Menu</span>
        </div>
        <button className="action-btn" onClick={onClose} title="Close Menu">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6" style={{ scrollbarWidth: 'none' }}>

        {/* Active Tabs Section */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Active Tabs</span>
            <button
              className="px-2.5 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              onClick={() => {
                openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '');
                onClose();
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
                    onClose();
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

        {/* ─── Terminal Controls (mobile only) ─── */}
        <div className="flex flex-col gap-3 pt-4 border-t border-white/5 sm:hidden">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Terminal Controls</span>

          {/* Font size */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-900/40 border-white/5">
            <span className="text-xs text-slate-400 font-medium">Font Size</span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleZoomOut}
                className="text-slate-400 hover:text-white active:scale-95 transition-all cursor-pointer p-1 rounded flex items-center justify-center"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-[11px] bg-slate-950/60 px-2 py-0.5 rounded font-mono font-semibold text-purple-300 min-w-[36px] text-center border border-white/5">
                {terminalFontSize}px
              </span>
              <button
                onClick={handleZoomIn}
                className="text-slate-400 hover:text-white active:scale-95 transition-all cursor-pointer p-1 rounded flex items-center justify-center"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </div>

          {/* Shell Selector */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-900/40 border-white/5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <TerminalIcon size={12} className="text-slate-500" />
              Default Shell
            </span>
            <select
              value={defaultShell}
              onChange={(e) => setDefaultShell(e.target.value)}
              className="bg-slate-950 border border-white/10 text-slate-300 font-mono font-semibold text-xs cursor-pointer outline-none rounded px-2 py-1 transition-colors hover:text-white"
            >
              <option value="powershell" className="bg-[#0b0e14] text-slate-300">powershell</option>
              <option value="cmd" className="bg-[#0b0e14] text-slate-300">cmd</option>
              <option value="gitbash" className="bg-[#0b0e14] text-slate-300">gitbash</option>
              <option value="wsl" className="bg-[#0b0e14] text-slate-300">wsl</option>
            </select>
          </div>

          {/* Refresh Terminal */}
          {activeTabType === 'terminal' && onRefreshTerminal && (
            <button
              onClick={() => { onRefreshTerminal(); onClose(); }}
              className="flex items-center gap-3 p-3 rounded-lg border bg-slate-900/40 border-white/5 text-slate-300 hover:bg-slate-800/40 transition-all text-xs font-medium cursor-pointer w-full text-left"
            >
              <RefreshCw size={13} className="text-slate-400" />
              <span>Restart Terminal</span>
            </button>
          )}
        </div>

        {/* ─── Cloudflare Tunnel (mobile only) ─── */}
        <div className="flex flex-col gap-3 pt-4 border-t border-white/5 sm:hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Cloudflare Tunnel</span>
            {/* Status badge */}
            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
              tunnelLoading
                ? 'bg-sky-500/5 border-sky-500/20 text-sky-400'
                : (tunnelStatus.active
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                    : 'bg-slate-900/60 border-white/5 text-slate-500')
            }`}>
              {tunnelLoading ? (
                <span className="h-1.5 w-1.5 rounded-full border border-sky-400/30 border-t-sky-400 animate-spin" />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${
                  tunnelStatus.active ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]' : 'bg-slate-600'
                }`} />
              )}
              <span className="font-semibold">
                {tunnelLoading
                  ? (tunnelStatus.active ? 'Stopping...' : 'Starting...')
                  : (tunnelStatus.active ? 'Active' : 'Inactive')}
              </span>
            </span>
          </div>

          {/* Active URL */}
          {tunnelStatus.active && tunnelStatus.url && (
            <div className="flex items-center gap-2 bg-sky-950/20 border border-sky-500/20 px-3 py-2 rounded-lg text-[11px] font-mono text-sky-400">
              <Globe size={12} className="text-sky-400 animate-pulse shrink-0" />
              <span className="flex-1 truncate" title={tunnelStatus.url}>
                {tunnelStatus.url.replace(/^https?:\/\//, '')}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={tunnelStatus.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-sky-300 p-1 rounded transition-colors flex items-center"
                  title="Open Tunnel URL"
                >
                  <ExternalLink size={12} />
                </a>
                <button
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-purple-300 p-1 rounded transition-colors flex items-center cursor-pointer"
                  title="Copy Tunnel URL"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
                {tunnelStatus.type === 'quick' && (
                  <span
                    className="text-slate-500 hover:text-slate-300 transition-colors cursor-help p-1"
                    title="Newly created trycloudflare URLs can take 5-15 seconds for DNS to propagate."
                  >
                    <Info size={12} />
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {tunnelStatus.active ? (
              <button
                onClick={() => { handleStopTunnel(); onClose(); }}
                disabled={tunnelLoading}
                className={`flex-1 py-2 rounded-lg border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium transition-all ${
                  tunnelLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                Stop Tunnel
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleStartTunnel('quick')}
                  disabled={tunnelLoading}
                  className={`flex-1 py-2 rounded-lg border border-purple-500/25 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 text-xs font-medium transition-all ${
                    tunnelLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  Quick URL
                </button>
                <button
                  onClick={() => handleStartTunnel('token')}
                  disabled={tunnelLoading}
                  className={`flex-1 py-2 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-all ${
                    tunnelLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  Custom
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Actions</span>
          <button
            className="flex items-center gap-3 p-3 rounded-lg border bg-slate-900/40 border-white/5 text-slate-300 hover:bg-slate-800/40 transition-all text-xs font-medium cursor-pointer w-full text-left"
            onClick={() => {
              setShowSettingsModal(true);
              onClose();
            }}
          >
            <Settings size={14} className="text-slate-400" />
            <span>Settings</span>
          </button>
          <button
            className="flex items-center gap-3 p-3 rounded-lg border bg-slate-900/40 border-white/5 text-red-400 hover:bg-red-950/20 border-red-500/10 transition-all text-xs font-medium cursor-pointer w-full text-left"
            onClick={() => {
              handleLogout();
              onClose();
            }}
          >
            <LogOut size={14} className="text-red-400" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
