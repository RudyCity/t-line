import React from 'react';
import { RefreshCw, Shield, Folder, Sparkles, Settings, History } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';

interface SuperAgentHeaderProps {
  agentMode: 'single' | 'multi';
  setAgentMode: (mode: 'single' | 'multi') => void;
  status: 'connected' | 'connecting' | 'disconnected';
  activeWorkspace?: WorkspaceInfo;
  activeProviderId: string;
  providers: Array<{ id: string; name: string }>;
  activePresetId: { single: string; multi: string };
  presets: { single: any[]; multi: any[] };
  getMainModelLabel: (preset: any) => string;
  onOpenSettings: (tab?: 'login' | 'presets' | 'execution' | 'monitor') => void;
  onOpenHistory: () => void;
  onReconnect: () => void;
}

export const SuperAgentHeader: React.FC<SuperAgentHeaderProps> = ({
  agentMode,
  setAgentMode,
  status,
  activeWorkspace,
  activeProviderId,
  providers,
  activePresetId,
  presets,
  getMainModelLabel,
  onOpenSettings,
  onOpenHistory,
  onReconnect
}) => {
  const currentPreset = (presets[agentMode] || []).find(
    p => p.id?.toLowerCase() === activePresetId[agentMode]?.toLowerCase() || p.name?.toLowerCase() === activePresetId[agentMode]?.toLowerCase()
  );
  const providerObj = providers.find(p => p.id === activeProviderId);

  return (
    <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-2.5 bg-[var(--bg-sidebar)] select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-sm font-bold tracking-wide text-purple-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" />
            SuperAgent R-Engine
          </span>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
          <button
            onClick={() => setAgentMode('single')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              agentMode === 'single'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/30 font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Single-Agent
          </button>
          <button
            onClick={() => setAgentMode('multi')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              agentMode === 'multi'
                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/30 font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Multi-Agent
          </button>
        </div>

        {/* Connection Status Badge */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
          <span className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-amber-400 animate-ping' : 'bg-rose-500'
          }`} />
          <span className="capitalize">{status}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {activeWorkspace && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-black/30 px-2.5 py-1 rounded-md border border-white/5 max-w-[200px] truncate" title={activeWorkspace.path}>
            <Folder className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">{activeWorkspace.name}</span>
          </div>
        )}

        {/* Model Badge Button */}
        <button
          onClick={() => onOpenSettings('presets')}
          className="flex items-center gap-1.5 text-xs font-medium text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 px-2.5 py-1 rounded-md border border-purple-500/20 transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>{getMainModelLabel(currentPreset)}</span>
          {providerObj && <span className="text-[10px] text-purple-400/70 border-l border-purple-500/20 pl-1.5">{providerObj.name}</span>}
        </button>

        {/* Action Controls */}
        <button
          onClick={() => onOpenSettings('login')}
          title="Login & Provider Settings"
          className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-all"
        >
          <Shield className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenHistory}
          title="Session History"
          className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-all"
        >
          <History className="w-4 h-4" />
        </button>

        <button
          onClick={() => onOpenSettings('execution')}
          title="Execution Settings"
          className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={onReconnect}
          title="Restart Agent Server"
          className="p-1.5 text-gray-400 hover:text-purple-300 bg-white/5 hover:bg-white/10 rounded-md transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
