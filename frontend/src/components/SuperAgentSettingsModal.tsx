import React, { useState } from 'react';
import { X, Key, Sparkles, Sliders, Activity, Terminal, RefreshCw, Folder, Trash2 } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';
import { SuperAgentLoginManager, ProviderProfile } from './SuperAgentLoginManager';
import { SuperAgentPresetManager, ModelPreset } from './SuperAgentPresetManager';

interface SuperAgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces?: WorkspaceInfo[];
  workspace: string;
  setWorkspace: (w: string) => void;
  agentMode: 'single' | 'multi';
  setAgentMode: (m: 'single' | 'multi') => void;
  customArgs: string;
  setCustomArgs: (args: string) => void;
  setConnectTrigger: React.Dispatch<React.SetStateAction<number>>;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  onRefreshMonitor?: () => void;
  isLoadingMonitor?: boolean;
  onClearConsole?: () => void;
  providers: ProviderProfile[];
  activeProviderId: string;
  onSaveProvider: (provider: ProviderProfile) => Promise<void>;
  onDeleteProvider: (id: string) => Promise<void>;
  onSetActiveProvider: (id: string) => Promise<void>;
  presets: { single: ModelPreset[]; multi: ModelPreset[] };
  activePresetId: { single: string; multi: string };
  onSelectPreset: (presetId: string) => Promise<void>;
  onSaveCustomPreset: (mode: 'single' | 'multi', preset: { id: string; name: string; description?: string; models: any }) => Promise<void>;
  onDeleteCustomPreset: (mode: 'single' | 'multi', presetId: string) => Promise<void>;
  getAuthHeader: () => Record<string, string>;
  defaultTab?: 'login' | 'presets' | 'execution' | 'monitor';
}

export const SuperAgentSettingsModal: React.FC<SuperAgentSettingsModalProps> = ({
  isOpen,
  onClose,
  workspaces = [],
  workspace,
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
  providers,
  activeProviderId,
  onSaveProvider,
  onDeleteProvider,
  onSetActiveProvider,
  presets,
  activePresetId,
  onSelectPreset,
  onSaveCustomPreset,
  onDeleteCustomPreset,
  getAuthHeader,
  defaultTab = 'login'
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'presets' | 'execution' | 'monitor'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d111c] border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs font-sans">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#090c14] border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-700/50 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-100 text-sm tracking-wide">SuperAgent Configuration & Settings</h2>
              <p className="text-[11px] text-zinc-400">Manage LLM Login credentials, Model Presets, Execution mode & Live Monitor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 bg-[#090c14] border-b border-zinc-800/80 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('login')}
            className={`px-4 py-2.5 font-medium border-b-2 transition flex items-center gap-2 text-xs ${
              activeTab === 'login'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            Management Login ({providers.length})
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-2.5 font-medium border-b-2 transition flex items-center gap-2 text-xs ${
              activeTab === 'presets'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Model Presets
          </button>

          <button
            onClick={() => setActiveTab('execution')}
            className={`px-4 py-2.5 font-medium border-b-2 transition flex items-center gap-2 text-xs ${
              activeTab === 'execution'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            Execution & Workspace
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-4 py-2.5 font-medium border-b-2 transition flex items-center gap-2 text-xs ${
              activeTab === 'monitor'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            Monitor & Console
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-[#0d111c]">
          {activeTab === 'login' && (
            <SuperAgentLoginManager
              providers={providers}
              activeProviderId={activeProviderId}
              onSaveProvider={onSaveProvider}
              onDeleteProvider={onDeleteProvider}
              onSetActiveProvider={onSetActiveProvider}
              getAuthHeader={getAuthHeader}
            />
          )}

          {activeTab === 'presets' && (
            <SuperAgentPresetManager
              presets={presets}
              activePresetId={activePresetId}
              agentMode={agentMode}
              providers={providers}
              onSelectPreset={onSelectPreset}
              onSaveCustomPreset={onSaveCustomPreset}
              onDeleteCustomPreset={onDeleteCustomPreset}
            />
          )}

          {activeTab === 'execution' && (
            <div className="space-y-4">
              <div className="bg-[#121622] p-4 rounded-xl border border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-zinc-100 text-xs">
                  <Folder className="w-4 h-4 text-indigo-400" />
                  <span>Active Workspace Directory</span>
                </div>
                {workspaces.length > 0 ? (
                  <select
                    value={workspace}
                    onChange={(e) => {
                      setWorkspace(e.target.value);
                      localStorage.setItem('currentWorkspace', e.target.value);
                    }}
                    className="w-full bg-[#090c14] border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-200 font-mono outline-none focus:border-indigo-500 text-xs"
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
                    className="w-full bg-[#090c14] border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-200 font-mono outline-none focus:border-indigo-500 text-xs"
                    placeholder="Workspace directory path"
                  />
                )}
              </div>

              <div className="bg-[#121622] p-4 rounded-xl border border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-zinc-100 text-xs">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>Execution Mode & Custom CLI Flags</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400">Agent Mode</label>
                  <select
                    value={agentMode}
                    onChange={(e) => setAgentMode(e.target.value as 'single' | 'multi')}
                    className="w-full bg-[#090c14] border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-200 outline-none focus:border-indigo-500 text-xs"
                  >
                    <option value="single">Single Agent Mode</option>
                    <option value="multi">Multi-Agent Master Mode (--multi)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400">Custom CLI Arguments</label>
                  <input
                    type="text"
                    value={customArgs}
                    onChange={(e) => setCustomArgs(e.target.value)}
                    className="w-full bg-[#090c14] border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-200 font-mono outline-none focus:border-indigo-500 text-xs"
                    placeholder="e.g. --resume --verbose"
                  />
                </div>

                <button
                  onClick={() => {
                    setConnectTrigger(prev => prev + 1);
                    onClose();
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 text-xs shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Apply Settings & Restart SuperAgent Bridge
                </button>
              </div>
            </div>
          )}

          {activeTab === 'monitor' && (
            <div className="space-y-4">
              <div className="bg-[#121622] p-4 rounded-xl border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-zinc-100 text-xs">Live Process & Change Monitor Sidebar</h4>
                    <p className="text-[11px] text-zinc-400">Display running subagents, system processes, and git status</p>
                  </div>
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
                    onClick={onRefreshMonitor}
                    disabled={isLoadingMonitor}
                    className="w-full bg-[#090c14] hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-medium py-2 px-3 rounded-lg transition flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMonitor ? 'animate-spin' : ''}`} />
                    {isLoadingMonitor ? 'Refreshing...' : 'Refresh Monitor Data Now'}
                  </button>
                )}
              </div>

              {onClearConsole && (
                <div className="bg-[#121622] p-4 rounded-xl border border-zinc-800/80 space-y-2">
                  <h4 className="font-semibold text-zinc-100 text-xs flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    Console Output Tools
                  </h4>
                  <button
                    onClick={() => {
                      onClearConsole();
                      onClose();
                    }}
                    className="w-full bg-zinc-800/70 hover:bg-zinc-800 text-zinc-200 font-medium py-2 px-3 rounded-lg border border-zinc-700/50 transition flex items-center justify-center gap-2 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    Clear Current Console Log Output
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#090c14] border-t border-zinc-800/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
