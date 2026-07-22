import React, { useEffect, useRef } from 'react';
import { Settings, RefreshCw, Activity, Trash2, Sliders, X, Terminal, ExternalLink, Folder, Key } from 'lucide-react';
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
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  onRefreshMonitor?: () => void;
  isLoadingMonitor?: boolean;
  onClearConsole?: () => void;
  onOpenGlobalSettings?: () => void;
  onOpenSettingsModal?: (tab?: 'login' | 'presets' | 'execution' | 'monitor') => void;
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
  showSidebar,
  setShowSidebar,
  onRefreshMonitor,
  isLoadingMonitor,
  onClearConsole,
  onOpenGlobalSettings,
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
      className="absolute right-0 top-11 w-84 sm:w-96 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-2xl z-50 p-4 text-xs font-sans animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Menu Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)] mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/50 text-[var(--color-primary)]">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-[var(--text-main)] text-xs">SuperAgent Quick Settings</h4>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/40">
                v1.2.520
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">Manage workspace, login, presets & monitor</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] transition"
          title="Close menu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-0.5">
        {/* Combined SuperAgent Login & Presets Settings Link */}
        {onOpenSettingsModal && (
          <button
            onClick={() => {
              onOpenSettingsModal('login');
              onClose();
            }}
            className="w-full p-2.5 rounded-lg bg-[var(--color-primary-glow)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--color-primary)]/50 text-[var(--color-primary)] transition flex items-center justify-between cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="p-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--color-primary)]">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-xs text-[var(--color-primary)] flex items-center gap-1.5">
                  <span>Manage Login & Model Presets</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">Configure API Keys, LLM logins, and model presets</p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
          </button>
        )}
        {/* Section 1: Agent & Workspace Config */}
        <div className="bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-color)] space-y-2.5">
          <div className="flex items-center gap-1.5 text-[var(--text-main)] font-medium text-[11px]">
            <Sliders className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>Workspace & Agent Configuration</span>
          </div>

          {setWorkspace && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                <Folder className="w-3 h-3 text-[var(--color-primary)]" />
                Active Workspace
              </label>
              {workspaces.length > 0 ? (
                <select
                  value={workspace}
                  onChange={(e) => {
                    setWorkspace(e.target.value);
                    localStorage.setItem('currentWorkspace', e.target.value);
                  }}
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2.5 py-1.5 text-[var(--text-main)] font-mono outline-none focus:border-[var(--color-primary)] text-xs transition truncate"
                >
                  {workspaces.map(w => (
                    <option key={w.id} value={w.path}>{w.name} ({w.path})</option>
                  ))}
                  {!workspaces.some(w => w.path === workspace) && workspace && (
                    <option value={workspace}>Custom ({workspace})</option>
                  )}
                </select>
              ) : (
                <input
                  type="text"
                  value={workspace}
                  onChange={(e) => {
                    setWorkspace(e.target.value);
                    localStorage.setItem('currentWorkspace', e.target.value);
                  }}
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2.5 py-1.5 text-[var(--text-main)] font-mono outline-none focus:border-[var(--color-primary)] text-xs transition"
                  placeholder="Workspace directory path"
                />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] text-[var(--text-muted)]">Execution Mode</label>
            <select
              value={agentMode}
              onChange={(e) => setAgentMode(e.target.value as 'single' | 'multi')}
              className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2.5 py-1.5 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] text-xs transition"
            >
              <option value="single">Single Agent Mode</option>
              <option value="multi">Multi-Agent Master (--multi)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-[var(--text-muted)]">Custom CLI Arguments</label>
            <input
              type="text"
              value={customArgs}
              onChange={(e) => setCustomArgs(e.target.value)}
              className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2.5 py-1.5 text-[var(--text-main)] font-mono outline-none focus:border-[var(--color-primary)] text-xs transition"
              placeholder="e.g. --resume"
            />
          </div>

          <button
            onClick={() => {
              setConnectTrigger(prev => prev + 1);
              onClose();
            }}
            className="w-full mt-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 text-xs shadow-sm"
          >
            <RefreshCw className="w-3 h-3" />
            Apply & Restart Bridge
          </button>
        </div>

        {/* Section 2: Live Monitor Options */}
        <div className="bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-color)] space-y-2.5">
          <div className="flex items-center gap-1.5 text-[var(--text-main)] font-medium text-[11px]">
            <Activity className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>Monitor Panel</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[var(--text-main)] text-[11px]">Show Live Monitor Sidebar</span>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                showSidebar ? 'bg-[var(--color-primary)]' : 'bg-[var(--bg-main)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  showSidebar ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {onRefreshMonitor && (
            <button
              onClick={() => {
                onRefreshMonitor();
              }}
              disabled={isLoadingMonitor}
              className="w-full bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] border border-[var(--border-color)] font-medium py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingMonitor ? 'animate-spin' : ''}`} />
              {isLoadingMonitor ? 'Refreshing Data...' : 'Refresh Monitor Data'}
            </button>
          )}
        </div>

        {/* Section 3: Console Tools */}
        {onClearConsole && (
          <div className="bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-color)] space-y-2">
            <div className="flex items-center gap-1.5 text-[var(--text-main)] font-medium text-[11px]">
              <Terminal className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span>Console Tools</span>
            </div>
            <button
              onClick={() => {
                onClearConsole();
                onClose();
              }}
              className="w-full bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] font-medium py-1.5 px-3 rounded-md border border-[var(--border-color)] transition flex items-center justify-center gap-1.5 text-xs"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              Clear Console Output
            </button>
          </div>
        )}

        {/* Section 4: Global App Settings Link */}
        {onOpenGlobalSettings && (
          <button
            onClick={() => {
              onOpenGlobalSettings();
              onClose();
            }}
            className="w-full bg-[var(--color-primary-glow)] hover:bg-[var(--surface-overlay-hover)] text-[var(--color-primary)] border border-[var(--color-primary)]/50 font-medium py-2 px-3 rounded-lg transition flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span>Global App Settings</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--color-primary)]" />
          </button>
        )}
      </div>
    </div>
  );
};
