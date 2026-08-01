import React, { useEffect, useRef } from 'react';
import { Settings, RefreshCw, Activity, Trash2, X, ExternalLink, Folder, Key, Sparkles, Server } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';

interface SuperAgentSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces?: WorkspaceInfo[];
  workspace?: string;
  setWorkspace?: (workspace: string) => void;
  agentMode: 'single' | 'multi';
  setAgentMode: (mode: 'single' | 'multi') => void;
  customArgs: string;
  setCustomArgs: (args: string) => void;
  setConnectTrigger: React.Dispatch<React.SetStateAction<number>>;
  showSidebar?: boolean;
  setShowSidebar?: (show: boolean) => void;
  onClearConsole?: () => void;
  onOpenSettingsModal?: (tab?: 'login' | 'presets' | 'execution' | 'mcp' | 'skills' | 'memory' | 'chains') => void;
}

export const SuperAgentSettingsMenu: React.FC<SuperAgentSettingsMenuProps> = ({
  isOpen,
  onClose,
  workspaces = [],
  workspace = '',
  setWorkspace,
  agentMode,
  setAgentMode,
  customArgs,
  setCustomArgs,
  setConnectTrigger,
  onClearConsole,
  onOpenSettingsModal
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-11 w-72 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 p-2 text-xs font-sans animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Sleek Minimal Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--border-color)]/60 mb-1.5">
        <div className="flex items-center gap-2">
          <Settings className="w-3.5 h-3.5 text-[var(--color-primary)]" />
          <span className="font-semibold text-[var(--text-main)] text-xs">SuperAgent Settings</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] transition cursor-pointer"
          title="Close menu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1 max-h-[75vh] overflow-y-auto pr-0.5">
        {/* Quick Tools & Settings Action Grid */}
        {onOpenSettingsModal && (
          <div className="p-1 space-y-1">
            <div className="text-[10px] font-medium text-[var(--text-muted)] px-2 py-0.5 uppercase tracking-wider">
              Quick Config
            </div>
            
            <button
              onClick={() => {
                onOpenSettingsModal('login');
                onClose();
              }}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--color-primary-glow)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--color-primary)]/40 text-[var(--color-primary)] transition flex items-center justify-between text-xs cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 shrink-0" />
                <span>Logins & Presets</span>
              </div>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>

            <div className="grid grid-cols-3 gap-1 pt-0.5">
              <button
                onClick={() => {
                  onOpenSettingsModal('skills');
                  onClose();
                }}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md transition font-medium cursor-pointer text-[11px] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)]/70"
              >
                <Sparkles className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
                <span>Skills</span>
              </button>
              <button
                onClick={() => {
                  onOpenSettingsModal('memory');
                  onClose();
                }}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md transition font-medium cursor-pointer text-[11px] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)]/70"
              >
                <Activity className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
                <span>Memory</span>
              </button>
              <button
                onClick={() => {
                  onOpenSettingsModal('mcp');
                  onClose();
                }}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md transition font-medium cursor-pointer text-[11px] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)]/70"
              >
                <Server className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
                <span>MCP</span>
              </button>
            </div>
          </div>
        )}

        <div className="h-px bg-[var(--border-color)]/60 my-1" />

        {/* Minimal Workspace & Mode Controls */}
        <div className="p-2 space-y-2 bg-[var(--bg-card)]/50 rounded-lg border border-[var(--border-color)]/50">
          {setWorkspace && (
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-[var(--text-muted)] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Folder className="w-3 h-3 text-[var(--color-primary)]" />
                  Workspace
                </span>
              </label>
              {workspaces.length > 0 ? (
                <select
                  value={workspace}
                  onChange={(e) => {
                    setWorkspace(e.target.value);
                    localStorage.setItem('currentWorkspace', e.target.value);
                  }}
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2 py-1 text-[var(--text-main)] font-mono outline-none focus:border-[var(--color-primary)] text-[11px] transition truncate"
                >
                  {workspaces.map(w => (
                    <option key={w.id} value={w.path}>{w.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={workspace}
                  onChange={(e) => {
                    setWorkspace(e.target.value);
                    localStorage.setItem('currentWorkspace', e.target.value);
                  }}
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2 py-1 text-[var(--text-main)] font-mono outline-none focus:border-[var(--color-primary)] text-[11px] transition"
                  placeholder="Path"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 items-center">
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)]">Mode</label>
              <select
                value={agentMode}
                onChange={(e) => setAgentMode(e.target.value as 'single' | 'multi')}
                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2 py-1 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] text-[11px] transition"
              >
                <option value="single">Single Agent</option>
                <option value="multi">Multi-Agent</option>
              </select>
            </div>
            
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)]">CLI Args</label>
              <input
                type="text"
                value={customArgs}
                onChange={(e) => setCustomArgs(e.target.value)}
                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2 py-1 text-[var(--text-main)] font-mono outline-none focus:border-[var(--color-primary)] text-[11px] transition"
                placeholder="--resume"
              />
            </div>
          </div>

          <button
            onClick={() => {
              setConnectTrigger(prev => prev + 1);
              onClose();
            }}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-1 px-2.5 rounded-md transition flex items-center justify-center gap-1.5 text-[11px] cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Apply & Restart Bridge
          </button>
        </div>

        {/* Minimal Quick Actions & Toggles */}
        <div className="p-1 space-y-0.5">
          {onClearConsole && (
            <button
              onClick={() => {
                onClearConsole();
                onClose();
              }}
              className="w-full px-2 py-1 rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-[var(--surface-overlay-hover)] transition flex items-center gap-2 text-[11px] font-medium cursor-pointer"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>Clear Console Output</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
