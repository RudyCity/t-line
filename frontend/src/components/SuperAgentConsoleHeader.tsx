import React, { useState, useRef, useEffect } from 'react';
import { 
  History, Folder, Sparkles, Key, Sliders, RefreshCw, Activity, Shield, Terminal, ChevronDown, Check, Cpu
} from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';
import { ModelPreset } from './SuperAgentPresetManager';
import { SuperAgentSettingsMenu } from './SuperAgentSettingsMenu';

interface SuperAgentConsoleHeaderProps {
  // Navigation & Sidebars
  activeTab: 'console' | 'audit';
  setActiveTab: (tab: 'console' | 'audit') => void;
  showHistorySidebar: boolean;
  setShowHistorySidebar: (show: boolean) => void;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  showSettingsMenu: boolean;
  setShowSettingsMenu: (show: boolean) => void;

  // Workspace
  workspaces: WorkspaceInfo[];
  workspace: string;
  setWorkspace: (w: string) => void;

  // Agent mode & flags
  agentMode: 'single' | 'multi';
  setAgentMode: (m: 'single' | 'multi') => void;
  customArgs: string;
  setCustomArgs: (a: string) => void;
  setConnectTrigger: React.Dispatch<React.SetStateAction<number>>;

  // Presets & Provider
  presets?: { single: ModelPreset[]; multi: ModelPreset[] };
  activePresetId?: { single: string; multi: string };
  onPresetChange?: (presetId: string) => void;
  activeProviderName?: string;
  onOpenSettingsModal?: (tab?: 'login' | 'presets' | 'execution' | 'monitor') => void;

  // Menu Handlers
  onRefreshMonitor?: () => void;
  isLoadingMonitor?: boolean;
  onClearConsole?: () => void;
  onOpenSettings?: () => void;

  // Connection state
  isConnected?: boolean;
}

export function SuperAgentConsoleHeader({
  activeTab,
  setActiveTab,
  showHistorySidebar,
  setShowHistorySidebar,
  showSidebar,
  setShowSidebar,
  showSettingsMenu,
  setShowSettingsMenu,
  workspaces = [],
  workspace,
  setWorkspace,
  agentMode,
  setAgentMode,
  customArgs,
  setCustomArgs,
  setConnectTrigger,
  presets = { single: [], multi: [] },
  activePresetId = { single: '', multi: '' },
  onPresetChange,
  activeProviderName = '',
  onOpenSettingsModal,
  onRefreshMonitor,
  isLoadingMonitor,
  onClearConsole,
  onOpenSettings,
  isConnected = true
}: SuperAgentConsoleHeaderProps) {
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  const currentModePresets = presets[agentMode] || [];
  const currentActivePreset = activePresetId[agentMode] || '';

  const activeWorkspaceName = workspace
    ? workspace.split(/[/\\]/).pop() || workspace
    : 'No Workspace';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
        setWorkspaceDropdownOpen(false);
      }
    };
    if (workspaceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [workspaceDropdownOpen]);

  return (
    <div className="bg-[#090d16] border-b border-zinc-800/80 flex flex-col w-full text-xs select-none shadow-sm font-sans">
      {/* Row 1: Main Header Navigation & Actions */}
      <div className="grid grid-cols-3 items-center px-4 py-2 min-h-[46px] w-full border-b border-zinc-800/50">
        {/* Left Column: History Toggle & Active Workspace Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            className={`px-2.5 py-1 text-[11px] rounded-md border transition flex items-center gap-1.5 cursor-pointer font-medium ${
              showHistorySidebar ? 'shadow-sm' : 'bg-[#121622] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            style={showHistorySidebar ? {
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-primary) 50%, transparent)',
              color: 'var(--color-primary)'
            } : undefined}
            title="Toggle Chat History Sidebar"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
          </button>

          {/* Quick Workspace Switcher Dropdown */}
          <div className="relative" ref={workspaceDropdownRef}>
            <button
              onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
              className="text-[11px] px-2.5 py-1 rounded-md border font-mono flex items-center gap-1.5 cursor-pointer transition max-w-[200px] truncate"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
                color: 'var(--color-primary)'
              }}
              title={`Active Workspace: ${workspace}`}
            >
              <Folder className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="truncate font-semibold">{activeWorkspaceName}</span>
              <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
            </button>

            {workspaceDropdownOpen && (
              <div className="absolute left-0 top-9 w-64 bg-[#0d121f] border border-zinc-800 rounded-lg shadow-xl z-50 p-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80 mb-1">
                  Select Active Workspace
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {workspaces.map(w => {
                    const isSelected = w.path === workspace;
                    return (
                      <button
                        key={w.id}
                        onClick={() => {
                          setWorkspace(w.path);
                          localStorage.setItem('currentWorkspace', w.path);
                          setWorkspaceDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between text-[11px] font-mono transition ${
                          isSelected ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800/60'
                        }`}
                      >
                        <span className="truncate">{w.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Segmented Tab Pill Nav */}
        <div className="flex justify-center">
          <div className="flex bg-[#121622] rounded-lg p-0.5 border border-zinc-800/80">
            <button
              onClick={() => setActiveTab('console')}
              className={`sa-tab-pill flex items-center gap-1.5 ${activeTab === 'console' ? 'font-medium shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              style={activeTab === 'console' ? {
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff'
              } : undefined}
            >
              <Terminal className="w-3.5 h-3.5" />
              Console
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`sa-tab-pill flex items-center gap-1.5 ${activeTab === 'audit' ? 'font-medium shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              style={activeTab === 'audit' ? {
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff'
              } : undefined}
            >
              <Shield className="w-3.5 h-3.5" />
              Audit Trails
            </button>
          </div>
        </div>

        {/* Right Column: Live Status, Monitor & Settings */}
        <div className="flex justify-end gap-2 items-center relative">
          {/* Real-time Connection Status Dot */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
            <span>{isConnected ? 'Connected' : 'Offline'}</span>
          </div>

          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`px-2.5 py-1 text-[11px] rounded-md border transition flex items-center gap-1.5 cursor-pointer font-medium ${
              showSidebar ? 'shadow-sm' : 'bg-[#121622] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            style={showSidebar ? {
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-primary) 50%, transparent)',
              color: 'var(--color-primary)'
            } : undefined}
            title="Toggle Live Monitor Sidebar"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Monitor</span>
          </button>

          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className={`px-2.5 py-1 text-[11px] rounded-md border transition flex items-center gap-1.5 cursor-pointer font-medium ${
              showSettingsMenu ? 'shadow-sm' : 'bg-[#121622] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            style={showSettingsMenu ? {
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-primary) 50%, transparent)',
              color: 'var(--color-primary)'
            } : undefined}
            title="SuperAgent & App Settings"
          >
            <Sliders className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Quick Settings Dropdown */}
          <SuperAgentSettingsMenu
            isOpen={showSettingsMenu}
            onClose={() => setShowSettingsMenu(false)}
            workspaces={workspaces}
            workspace={workspace}
            setWorkspace={setWorkspace}
            agentMode={agentMode}
            setAgentMode={setAgentMode}
            customArgs={customArgs}
            setCustomArgs={setCustomArgs}
            setConnectTrigger={setConnectTrigger}
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            onRefreshMonitor={onRefreshMonitor}
            isLoadingMonitor={isLoadingMonitor}
            onClearConsole={onClearConsole}
            onOpenGlobalSettings={onOpenSettings}
            onOpenSettingsModal={onOpenSettingsModal}
          />
        </div>
      </div>

      {/* Row 2: Context & Quick Config Sub-Toolbar */}
      {activeTab === 'console' && (
        <div className="px-4 py-1.5 bg-[#0b0e18] flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/40 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            {/* Model Preset Selector */}
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span className="text-zinc-400 font-medium">Preset:</span>
              <select
                value={currentActivePreset}
                onChange={(e) => onPresetChange?.(e.target.value)}
                className="bg-[#121622] border border-zinc-700/60 rounded-md px-2 py-0.5 text-zinc-200 outline-none focus:border-indigo-500 text-[11px] font-mono transition"
              >
                {currentModePresets.length === 0 ? (
                  <option value="">Default Model Preset</option>
                ) : (
                  currentModePresets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))
                )}
              </select>
            </div>

            {/* CLI Mode Segment Pills */}
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-amber-400" />
              <span className="text-zinc-400 font-medium">Mode:</span>
              <div className="flex rounded-md bg-[#121622] p-0.5 border border-zinc-700/60 font-mono text-[10px]">
                <button
                  onClick={() => setAgentMode('single')}
                  className={`px-2 py-0.5 rounded transition ${
                    agentMode === 'single' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setAgentMode('multi')}
                  className={`px-2 py-0.5 rounded transition ${
                    agentMode === 'multi' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Multi-Agent
                </button>
              </div>
            </div>

            {/* Custom CLI Args */}
            <div className="hidden lg:flex items-center gap-1.5">
              <span className="text-zinc-400 font-mono font-medium text-[10px]">Flags:</span>
              <input
                type="text"
                value={customArgs}
                onChange={(e) => setCustomArgs(e.target.value)}
                className="bg-[#121622] border border-zinc-700/60 rounded-md px-2 py-0.5 text-zinc-200 outline-none focus:border-indigo-500 font-mono w-28 text-[10px] transition"
                placeholder="e.g. --resume"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Active Provider Badge */}
            {onOpenSettingsModal && (
              <button
                onClick={() => onOpenSettingsModal('login')}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#121622] hover:bg-indigo-950/60 border border-zinc-700/60 text-zinc-300 hover:text-indigo-300 transition text-[10px] font-mono cursor-pointer"
                title="Manage Provider Credentials"
              >
                <Key className="w-3 h-3 text-indigo-400" />
                <span>{activeProviderName || 'Manage Login'}</span>
              </button>
            )}

            {/* Apply & Restart Button */}
            <button
              onClick={() => setConnectTrigger(prev => prev + 1)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[10px] transition cursor-pointer shadow-xs"
              title="Apply settings & restart SuperAgent bridge"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Apply & Restart</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

