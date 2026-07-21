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
  onSelectPreset: (mode: 'single' | 'multi', presetId: string) => Promise<void>;
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
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs font-sans">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[var(--panel-header-bg)] border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/50 text-[var(--color-primary)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-main)] text-sm tracking-wide">SuperAgent Configuration & Settings</h2>
              <p className="text-[11px] text-[var(--text-muted)]">Manage LLM Login credentials, Model Presets, Execution mode & Live Monitor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 py-2.5 bg-[var(--panel-header-bg)] border-b border-[var(--border-color)] flex items-center gap-1.5 overflow-x-auto shrink-0">
          {[
            { id: 'login' as const, label: `Management Login (${providers.length})`, icon: Key },
            { id: 'presets' as const, label: 'Model Presets', icon: Sparkles },
            { id: 'execution' as const, label: 'Execution & Workspace', icon: Sliders },
            { id: 'monitor' as const, label: 'Monitor & Console', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 text-xs cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? 'border-[var(--color-primary)]/40 text-[var(--color-primary)] bg-[var(--color-primary)]/15 font-semibold shadow-xs'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--color-primary)]' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-[var(--bg-card)]">
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
              <div className="bg-[var(--bg-sidebar)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[var(--text-main)] text-xs">
                  <Folder className="w-4 h-4 text-[var(--color-primary)]" />
                  <span>Active Workspace Directory</span>
                </div>
                {workspaces.length > 0 ? (
                  <select
                    value={workspace}
                    onChange={(e) => {
                      setWorkspace(e.target.value);
                      localStorage.setItem('currentWorkspace', e.target.value);
                    }}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] font-mono outline-none focus:border-[var(--color-primary)] text-xs"
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
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] font-mono outline-none focus:border-[var(--color-primary)] text-xs"
                    placeholder="Workspace directory path"
                  />
                )}
              </div>

              <div className="bg-[var(--bg-sidebar)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[var(--text-main)] text-xs">
                  <Sliders className="w-4 h-4 text-[var(--color-primary)]" />
                  <span>Execution Mode & Custom CLI Flags</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-muted)]">Agent Mode</label>
                  <select
                    value={agentMode}
                    onChange={(e) => setAgentMode(e.target.value as 'single' | 'multi')}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] text-xs"
                  >
                    <option value="single">Single Agent Mode</option>
                    <option value="multi">Multi-Agent Master Mode (--multi)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-[var(--text-muted)]">Custom CLI Arguments</label>
                  <input
                    type="text"
                    value={customArgs}
                    onChange={(e) => setCustomArgs(e.target.value)}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] font-mono outline-none focus:border-[var(--color-primary)] text-xs"
                    placeholder="e.g. --resume --verbose"
                  />
                </div>

                <button
                  onClick={() => {
                    setConnectTrigger(prev => prev + 1);
                    onClose();
                  }}
                  className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 text-xs shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Apply Settings & Restart SuperAgent Bridge
                </button>
              </div>
            </div>
          )}

          {activeTab === 'monitor' && (
            <div className="space-y-4">
              <div className="bg-[var(--bg-sidebar)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-[var(--text-main)] text-xs">Live Process & Change Monitor Sidebar</h4>
                    <p className="text-[11px] text-[var(--text-muted)]">Display running subagents, system processes, and git status</p>
                  </div>
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
                    onClick={onRefreshMonitor}
                    disabled={isLoadingMonitor}
                    className="w-full bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] border border-[var(--border-color)] font-medium py-2 px-3 rounded-lg transition flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMonitor ? 'animate-spin' : ''}`} />
                    {isLoadingMonitor ? 'Refreshing...' : 'Refresh Monitor Data Now'}
                  </button>
                )}
              </div>

              {onClearConsole && (
                <div className="bg-[var(--bg-sidebar)] p-4 rounded-xl border border-[var(--border-color)] space-y-2">
                  <h4 className="font-semibold text-[var(--text-main)] text-xs flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[var(--color-primary)]" />
                    Console Output Tools
                  </h4>
                  <button
                    onClick={() => {
                      onClearConsole();
                      onClose();
                    }}
                    className="w-full bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] font-medium py-2 px-3 rounded-lg border border-[var(--border-color)] transition flex items-center justify-center gap-2 text-xs"
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
        <div className="px-6 py-3 bg-[var(--panel-header-bg)] border-t border-[var(--border-color)] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
