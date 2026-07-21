import React from 'react';
import { RefreshCw, Folder, Sparkles, Key, Sliders } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';
import { ModelPreset } from './SuperAgentPresetManager';

interface SuperAgentConsoleHeaderProps {
  workspaces: WorkspaceInfo[];
  workspace: string;
  setWorkspace: (w: string) => void;
  agentMode: 'single' | 'multi';
  setAgentMode: (m: 'single' | 'multi') => void;
  customArgs: string;
  setCustomArgs: (a: string) => void;
  setConnectTrigger: React.Dispatch<React.SetStateAction<number>>;
  presets?: { single: ModelPreset[]; multi: ModelPreset[] };
  activePresetId?: { single: string; multi: string };
  onPresetChange?: (presetId: string) => void;
  activeProviderName?: string;
  onOpenSettingsModal?: (tab?: 'login' | 'presets' | 'execution' | 'monitor') => void;
}

export function SuperAgentConsoleHeader({
  workspaces,
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
  onOpenSettingsModal
}: SuperAgentConsoleHeaderProps) {
  const currentModePresets = presets[agentMode] || [];
  const currentActivePreset = activePresetId[agentMode] || '';

  return (
    <div className="bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs select-none w-full shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        {/* Workspace Selector */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[var(--text-muted)] font-medium flex items-center gap-1 text-[10px] tracking-wide">
            <Folder className="w-3 h-3 text-[var(--color-primary)]" /> Active Workspace
          </label>
          <div className="flex gap-1">
            {workspaces.length > 0 ? (
              <select
                value={workspace}
                onChange={(e) => {
                  setWorkspace(e.target.value);
                  localStorage.setItem('currentWorkspace', e.target.value);
                }}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-2.5 py-1 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] w-52 text-xs font-mono transition-colors"
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
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-2.5 py-1 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] w-52 text-xs font-mono transition-colors"
                placeholder="Workspace path"
              />
            )}
          </div>
        </div>

        {/* Model Preset Selector */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[var(--text-muted)] font-medium flex items-center gap-1 text-[10px] tracking-wide">
            <Sparkles className="w-3 h-3 text-[var(--color-primary)]" /> Model Preset
          </label>
          <select
            value={currentActivePreset}
            onChange={(e) => onPresetChange?.(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-2.5 py-1 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] w-44 text-xs transition-colors"
          >
            {currentModePresets.length === 0 ? (
              <option value="">Default Preset</option>
            ) : (
              currentModePresets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            )}
          </select>
        </div>

        {/* CLI Mode */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[var(--text-muted)] font-medium text-[10px] tracking-wide">CLI Mode</label>
          <select
            value={agentMode}
            onChange={(e) => setAgentMode(e.target.value as 'single' | 'multi')}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-2.5 py-1 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] text-xs transition-colors"
          >
            <option value="single">Single Agent</option>
            <option value="multi">Multi-Agent Master</option>
          </select>
        </div>

        {/* Custom CLI Flags */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[var(--text-muted)] font-medium text-[10px] tracking-wide">CLI Flags</label>
          <input
            type="text"
            value={customArgs}
            onChange={(e) => setCustomArgs(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md px-2.5 py-1 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] w-28 text-xs font-mono transition-colors"
            placeholder="e.g. --resume"
          />
        </div>
      </div>

      {/* Right Controls: Provider Badge & Full Settings Trigger */}
      <div className="flex items-center gap-2 pt-3 sm:pt-0">
        {onOpenSettingsModal && (
          <button
            onClick={() => onOpenSettingsModal('login')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-card)] hover:bg-[var(--color-primary-glow)] border border-[var(--border-color)] text-[var(--text-main)] hover:text-[var(--color-primary)] transition text-[11px]"
            title="Manage Provider Credentials & Login"
          >
            <Key className="w-3 h-3 text-[var(--color-primary)]" />
            <span>{activeProviderName || 'Manage Login'}</span>
          </button>
        )}

        {onOpenSettingsModal && (
          <button
            onClick={() => onOpenSettingsModal('login')}
            className="p-1 rounded-md bg-[var(--bg-card)] hover:bg-[var(--color-primary)] text-[var(--text-muted)] hover:text-white border border-[var(--border-color)] transition"
            title="Open Full SuperAgent Settings"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={() => setConnectTrigger(prev => prev + 1)}
          className="sa-btn-primary flex items-center gap-1 py-1 px-2.5 text-xs shadow-xs"
          title="Apply settings & restart bridge"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Apply</span>
        </button>
      </div>
    </div>
  );
}
