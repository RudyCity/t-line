import React, { useState, useEffect } from 'react';
import {
  Plus, Terminal as TerminalIcon, FileCode, Settings, LogOut, X,
  ZoomIn, ZoomOut, Globe, ExternalLink, Copy, Check, Info, RefreshCw,
  LayoutGrid, GitCompare, Zap, HelpCircle, Link as LinkIcon, Server
} from 'lucide-react';
import { TabData, TerminalInstanceData, WorkspaceInfo } from '../hooks/useTerminals';
import { Select } from './Form';
import { MultiTunnelStatus } from '../hooks/useTunnel';

interface SavedPrompt {
  id: string;
  name: string;
  command: string;
  cwd: string;
  shellType: string;
}

export interface WorkspaceChainNodeInfo {
  id: string;
  label: string;
  type: 'local' | 'ssh';
  role: 'main' | 'module' | 'deploy' | 'dependency' | 'test' | 'staging' | 'custom';
  path?: string;
  description?: string;
}

export interface WorkspaceChainInfo {
  id: string;
  name: string;
  description?: string;
  primaryNodeId: string;
  nodes: WorkspaceChainNodeInfo[];
}

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
  setShowSettingsModal: (val: boolean) => void;
  handleLogout: () => void;
  // Terminal controls (from footer center section)
  terminalFontSize: number;
  defaultShell: string;
  setDefaultShell: (val: string) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  activeTabType?: 'terminal' | 'file' | 'diff' | 'grid' | 'browser' | 'agent' | null;
  onRefreshTerminal?: () => void;
  // Tunnel (from footer right section)
  tunnelStatus: MultiTunnelStatus;
  tunnelLoading: { tline: boolean; custom: boolean };
  handleStartTunnel: (target: 'tline' | 'custom', type: 'quick' | 'token', customPort?: number) => void;
  handleStopTunnel: (target: 'tline' | 'custom') => void;
  // Saved Prompts (Quick Launch)
  savedPrompts?: SavedPrompt[];
  onRunSavedPrompt?: (prompt: SavedPrompt) => void;
  onDeleteSavedPrompt?: (id: string) => void;
  onAddSavedPrompt?: () => void;
  // Shortcut help
  onShowShortcutHelp?: () => void;
  // Workspace Chain
  activeChain?: WorkspaceChainInfo | null;
  activeChainNodeId?: string;
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
  savedPrompts = [],
  onRunSavedPrompt,
  onDeleteSavedPrompt,
  onAddSavedPrompt,
  onShowShortcutHelp,
  activeChain: propActiveChain,
  activeChainNodeId: propActiveNodeId,
}: RightSidebarProps) {
  const [copied, setCopied] = useState(false);
  const [chainInfo, setChainInfo] = useState<WorkspaceChainInfo | null>(propActiveChain || null);
  const [activeNodeId, setActiveNodeId] = useState<string>(propActiveNodeId || '');

  useEffect(() => {
    if (propActiveChain) setChainInfo(propActiveChain);
  }, [propActiveChain]);

  useEffect(() => {
    if (propActiveNodeId) setActiveNodeId(propActiveNodeId);
  }, [propActiveNodeId]);

  useEffect(() => {
    const fetchChain = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const wsParam = panelWorkspace?.path ? `?workspace=${encodeURIComponent(panelWorkspace.path)}` : '';
        const res = await fetch(`/api/superagent/workspace/chains/active${wsParam}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.activeChain && Array.isArray(data.activeChain.nodes) && data.activeChain.nodes.length > 0) {
            setChainInfo(data.activeChain);
            if (data.activeNodeId) setActiveNodeId(data.activeNodeId);
          } else {
            setChainInfo(null);
          }
        } else {
          setChainInfo(null);
        }
      } catch (err) {
        console.error('Failed to fetch workspace chain in RightSidebar:', err);
        setChainInfo(null);
      }
    };
    fetchChain();
  }, [panelWorkspace?.path]);

  const handleCopy = async () => {
    if (!tunnelStatus.tline.url) return;
    try {
      await navigator.clipboard.writeText(tunnelStatus.tline.url);
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
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)] '
                      : 'bg-[var(--bg-card)]/50 border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {t.type === 'file' ? (
                      <FileCode size={13} className={isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'} />
                    ) : t.type === 'diff' ? (
                      <GitCompare size={13} className={isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'} />
                    ) : t.type === 'grid' ? (
                      <LayoutGrid size={13} className={isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'} />
                    ) : t.type === 'browser' ? (
                      <Globe size={13} className={isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'} />
                    ) : (
                      <TerminalIcon size={13} className={isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'} />
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
              <div className="text-center py-8 text-xs text-[var(--text-muted)] font-medium">No active tabs</div>
            )}
          </div>
        </div>

        {/* ─── Active Workspace Chain (Only visible if workspace has a valid chain) ─── */}
        {chainInfo && chainInfo.nodes && chainInfo.nodes.length > 0 && (
          <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1.5">
                <LinkIcon size={12} className="text-purple-400" />
                Workspace Chain
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded border bg-purple-500/10 border-purple-500/30 text-purple-300">
                {chainInfo.name}
              </span>
            </div>

            <div className="flex flex-col gap-2 p-3 rounded-lg border bg-[var(--bg-card)]/50 border-[var(--border-color)] text-xs">
              {chainInfo.nodes.map(node => {
                const isPrimary = node.id === chainInfo.primaryNodeId;
                const isCurrentNode = node.id === activeNodeId || (!activeNodeId && isPrimary);

                return (
                  <div
                    key={node.id}
                    className={`flex items-center justify-between p-2 rounded border font-mono text-[11px] transition-all ${
                      isCurrentNode
                        ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                        : 'bg-black/20 border-white/5 text-[var(--text-muted)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Server size={12} className={isPrimary ? 'text-amber-400 shrink-0' : 'text-slate-400 shrink-0'} />
                      <span className="truncate font-semibold">{node.label}</span>
                      {node.type === 'ssh' && (
                        <span className="text-[9px] bg-sky-950/40 text-sky-300 border border-sky-500/30 px-1 py-0.2 rounded font-sans">SSH</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isPrimary && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-sans font-semibold">PRIMARY</span>
                      )}
                      {isCurrentNode && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-sans font-semibold">ACTIVE</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Quick Launch (mobile only) ─── */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border-color)]">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold flex items-center gap-1.5">
              <Zap size={12} className="text-amber-400" />
              Quick Launch
            </span>
            <button
              onClick={() => {
                onAddSavedPrompt?.();
                onClose();
              }}
              className="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--color-primary)] text-[var(--text-main)] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus size={11} />
              <span>Add</span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {savedPrompts.map(prompt => (
              <div
                key={prompt.id}
                onClick={() => {
                  onRunSavedPrompt?.(prompt);
                  onClose();
                }}
                className="flex items-center justify-between p-3 rounded-lg border bg-[var(--bg-card)]/50 border-[var(--border-color)] hover:border-[var(--color-primary)]/30 hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer group"
              >
                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                  <span className="text-xs font-semibold text-[var(--text-main)] truncate">{prompt.name}</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] truncate">{prompt.command}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSavedPrompt?.(prompt.id);
                  }}
                  className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors text-sm font-bold opacity-80 hover:opacity-100 ml-2"
                  title="Delete Shortcut"
                >
                  ×
                </button>
              </div>
            ))}
            {savedPrompts.length === 0 && (
              <div className="text-center py-4 text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-color)] rounded-lg">
                No quick launch shortcuts added yet
              </div>
            )}
          </div>
        </div>

        {/* ─── Terminal Controls (mobile only) ─── */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border-color)]">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Terminal Controls</span>

          {/* Font size */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-[var(--bg-card)] border-[var(--border-color)]">
            <span className="text-xs text-[var(--text-muted)] font-medium">Font Size</span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleZoomOut}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer p-1 rounded flex items-center justify-center"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-[11px] bg-[var(--bg-main)]/60 px-2 py-0.5 rounded font-mono font-semibold text-[var(--color-primary)] min-w-[36px] text-center border border-[var(--border-color)]">
                {terminalFontSize}px
              </span>
              <button
                onClick={handleZoomIn}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer p-1 rounded flex items-center justify-center"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </div>

          {/* Shell Selector */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-[var(--bg-card)]/50 border-[var(--border-color)]">
            <span className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1.5">
              <TerminalIcon size={12} className="text-[var(--text-muted)]" />
              Default Shell
            </span>
            <Select
              value={defaultShell}
              onChange={(val) => setDefaultShell(val)}
              className="w-32 text-xs"
              options={[
                { value: 'powershell', label: 'powershell' },
                { value: 'cmd', label: 'cmd' },
                { value: 'gitbash', label: 'git bash' },
                { value: 'wsl', label: 'wsl' }
              ]}
            />
          </div>

          {/* Refresh Terminal */}
          {activeTabType === 'terminal' && onRefreshTerminal && (
            <button
              onClick={() => { onRefreshTerminal(); onClose(); }}
              className="flex items-center gap-3 p-3 rounded-lg border text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-all text-xs font-medium cursor-pointer w-full text-left"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg-card) 60%, transparent)',
                borderColor: 'var(--border-color)',
              }}
            >
              <RefreshCw size={13} className="text-[var(--text-muted)]" />
              <span>Restart Terminal</span>
            </button>
          )}
        </div>

        {/* ─── Cloudflare Tunnel (mobile only) ─── */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Cloudflare Tunnel</span>
            {/* Status badge */}
            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
              tunnelLoading.tline
                ? 'bg-sky-500/5 border-sky-500/20 text-sky-400'
                : (tunnelStatus.tline.active
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                    : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)]')
            }`}>
              {tunnelLoading.tline ? (
                <span className="h-1.5 w-1.5 rounded-full border border-sky-400/30 border-t-sky-400 animate-spin" />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${
                  tunnelStatus.tline.active ? 'bg-emerald-400 animate-pulse ' : 'bg-[var(--text-dark)]'
                }`} />
              )}
              <span className="font-semibold">
                {tunnelLoading.tline
                  ? (tunnelStatus.tline.active ? 'Stopping...' : 'Starting...')
                  : (tunnelStatus.tline.active ? 'Active' : 'Inactive')}
              </span>
            </span>
          </div>

          {/* Active URL */}
          {tunnelStatus.tline.active && tunnelStatus.tline.url && (
            <div className="flex items-center gap-2 bg-sky-950/20 border border-sky-500/20 px-3 py-2 rounded-lg text-[11px] font-mono text-sky-400">
              <Globe size={12} className="text-sky-400 animate-pulse shrink-0" />
              <span className="flex-1 truncate" title={tunnelStatus.tline.url}>
                {tunnelStatus.tline.url.replace(/^https?:\/\//, '')}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={tunnelStatus.tline.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-sky-300 p-1 rounded transition-colors flex items-center"
                  title="Open Tunnel URL"
                >
                  <ExternalLink size={12} />
                </a>
                <button
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-[var(--color-primary)] p-1 rounded transition-colors flex items-center cursor-pointer"
                  title="Copy Tunnel URL"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
                {tunnelStatus.tline.type === 'quick' && (
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
            {tunnelStatus.tline.active ? (
              <button
                onClick={() => { handleStopTunnel('tline'); onClose(); }}
                disabled={tunnelLoading.tline}
                className={`flex-1 py-2 rounded-lg border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium transition-all ${
                  tunnelLoading.tline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                Stop Tunnel
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleStartTunnel('tline', 'quick')}
                  disabled={tunnelLoading.tline}
                  className={`flex-1 py-2 rounded-lg border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs font-medium transition-all ${
                    tunnelLoading.tline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  Quick URL
                </button>
                <button
                  onClick={() => handleStartTunnel('tline', 'token')}
                  disabled={tunnelLoading.tline}
                  className={`flex-1 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-medium transition-all ${
                    tunnelLoading.tline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  Custom
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="flex flex-col gap-2 pt-4 border-t border-[var(--border-color)]">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-1">Actions</span>
          <button
            className="flex items-center gap-3 p-3 rounded-lg border text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-all text-xs font-medium cursor-pointer w-full text-left"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-card) 50%, transparent)',
              borderColor: 'var(--border-color)'
            }}
            onClick={() => {
              onShowShortcutHelp?.();
              onClose();
            }}
          >
            <HelpCircle size={14} className="text-[var(--text-muted)]" />
            <span>Keyboard Shortcuts</span>
          </button>
          <button
            className="flex items-center gap-3 p-3 rounded-lg border text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-all text-xs font-medium cursor-pointer w-full text-left"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-card) 50%, transparent)',
              borderColor: 'var(--border-color)'
            }}
            onClick={() => {
              setShowSettingsModal(true);
              onClose();
            }}
          >
            <Settings size={14} className="text-[var(--text-muted)]" />
            <span>Settings</span>
          </button>
          <button
            className="flex items-center gap-3 p-3 rounded-lg border text-red-400 hover:bg-red-950/20 border-red-500/10 transition-all text-xs font-medium cursor-pointer w-full text-left"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-card) 50%, transparent)',
            }}
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
