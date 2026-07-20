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
      className="absolute right-0 top-11 w-84 sm:w-96 bg-[#0d111c] border border-zinc-800 rounded-xl shadow-2xl z-50 p-4 text-xs font-sans animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Menu Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-700/50 text-indigo-400">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-zinc-100 text-xs">SuperAgent Quick Settings</h4>
            <p className="text-[10px] text-zinc-400">Manage workspace, login, presets & monitor</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
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
            className="w-full p-2.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/50 text-indigo-200 transition flex items-center justify-between cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="p-1.5 rounded-md bg-indigo-900/50 border border-indigo-700/50 text-indigo-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-xs text-indigo-300 flex items-center gap-1.5">
                  <span>Manage Login & Model Presets</span>
                </div>
                <p className="text-[10px] text-zinc-400">Configure API Keys, LLM logins, and model presets</p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          </button>
        )}
        {/* Section 1: Agent & Workspace Config */}
        <div className="bg-[#121622] p-3 rounded-lg border border-zinc-800/60 space-y-2.5">
          <div className="flex items-center gap-1.5 text-zinc-300 font-medium text-[11px]">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Workspace & Agent Configuration</span>
          </div>

          {setWorkspace && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 flex items-center gap-1">
                <Folder className="w-3 h-3 text-indigo-400" />
                Active Workspace
              </label>
              {workspaces.length > 0 ? (
                <select
                  value={workspace}
                  onChange={(e) => {
                    setWorkspace(e.target.value);
                    localStorage.setItem('currentWorkspace', e.target.value);
                  }}
                  className="w-full bg-[#090c14] border border-zinc-700/60 rounded-md px-2.5 py-1.5 text-zinc-200 font-mono outline-none focus:border-indigo-500 text-xs transition truncate"
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
                  className="w-full bg-[#090c14] border border-zinc-700/60 rounded-md px-2.5 py-1.5 text-zinc-200 font-mono outline-none focus:border-indigo-500 text-xs transition"
                  placeholder="Workspace directory path"
                />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400">Execution Mode</label>
            <select
              value={agentMode}
              onChange={(e) => setAgentMode(e.target.value as 'single' | 'multi')}
              className="w-full bg-[#090c14] border border-zinc-700/60 rounded-md px-2.5 py-1.5 text-zinc-200 outline-none focus:border-indigo-500 text-xs transition"
            >
              <option value="single">Single Agent Mode</option>
              <option value="multi">Multi-Agent Master (--multi)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400">Custom CLI Arguments</label>
            <input
              type="text"
              value={customArgs}
              onChange={(e) => setCustomArgs(e.target.value)}
              className="w-full bg-[#090c14] border border-zinc-700/60 rounded-md px-2.5 py-1.5 text-zinc-200 font-mono outline-none focus:border-indigo-500 text-xs transition"
              placeholder="e.g. --resume"
            />
          </div>

          <button
            onClick={() => {
              setConnectTrigger(prev => prev + 1);
              onClose();
            }}
            className="w-full mt-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 text-xs shadow-sm"
          >
            <RefreshCw className="w-3 h-3" />
            Apply & Restart Bridge
          </button>
        </div>

        {/* Section 2: Live Monitor Options */}
        <div className="bg-[#121622] p-3 rounded-lg border border-zinc-800/60 space-y-2.5">
          <div className="flex items-center gap-1.5 text-zinc-300 font-medium text-[11px]">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Monitor Panel</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-300 text-[11px]">Show Live Monitor Sidebar</span>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                showSidebar ? 'bg-indigo-600' : 'bg-zinc-700'
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
              className="w-full bg-[#090c14] hover:bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 font-medium py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingMonitor ? 'animate-spin' : ''}`} />
              {isLoadingMonitor ? 'Refreshing Data...' : 'Refresh Monitor Data'}
            </button>
          )}
        </div>

        {/* Section 3: Console Tools */}
        {onClearConsole && (
          <div className="bg-[#121622] p-3 rounded-lg border border-zinc-800/60 space-y-2">
            <div className="flex items-center gap-1.5 text-zinc-300 font-medium text-[11px]">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Console Tools</span>
            </div>
            <button
              onClick={() => {
                onClearConsole();
                onClose();
              }}
              className="w-full bg-zinc-800/70 hover:bg-zinc-800 text-zinc-200 font-medium py-1.5 px-3 rounded-md border border-zinc-700/50 transition flex items-center justify-center gap-1.5 text-xs"
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
            className="w-full bg-indigo-950/40 hover:bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 font-medium py-2 px-3 rounded-lg transition flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>Global App Settings</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
          </button>
        )}
      </div>
    </div>
  );
};
