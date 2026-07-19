import { RefreshCw, Folder } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';

interface SuperAgentConsoleHeaderProps {
  workspaces: WorkspaceInfo[];
  workspace: string;
  setWorkspace: (w: string) => void;
  agentMode: 'single' | 'multi';
  setAgentMode: (m: 'single' | 'multi') => void;
  customArgs: string;
  setCustomArgs: (a: string) => void;
  setConnectTrigger: React.Dispatch<React.SetStateAction<number>>;
}

export function SuperAgentConsoleHeader({
  workspaces,
  workspace,
  setWorkspace,
  agentMode,
  setAgentMode,
  customArgs,
  setCustomArgs,
  setConnectTrigger
}: SuperAgentConsoleHeaderProps) {
  return (
    <div className="bg-[#090c14] border-b border-zinc-800/80 px-4 py-2.5 flex flex-wrap items-center gap-4 text-xs select-none w-full shadow-sm">
      <div className="flex flex-col gap-1">
        <label className="text-zinc-400 font-medium flex items-center gap-1 text-[11px] tracking-wide">
          <Folder className="w-3 h-3 text-indigo-400" /> Active Workspace
        </label>
        <div className="flex gap-1">
          {workspaces.length > 0 ? (
            <select
              value={workspace}
              onChange={(e) => {
                setWorkspace(e.target.value);
                localStorage.setItem('currentWorkspace', e.target.value);
              }}
              className="bg-[#121622] border border-zinc-700/60 rounded-md px-2.5 py-1 text-zinc-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 w-64 text-xs font-mono transition-colors"
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
              className="bg-[#121622] border border-zinc-700/60 rounded-md px-2.5 py-1 text-zinc-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 w-64 text-xs font-mono transition-colors"
              placeholder="Workspace directory path"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-zinc-400 font-medium text-[11px] tracking-wide">CLI Mode</label>
        <select
          value={agentMode}
          onChange={(e) => setAgentMode(e.target.value as 'single' | 'multi')}
          className="bg-[#121622] border border-zinc-700/60 rounded-md px-2.5 py-1 text-zinc-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 text-xs transition-colors"
        >
          <option value="single">Single Agent Mode</option>
          <option value="multi">Multi-Agent Master (--multi)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-zinc-400 font-medium text-[11px] tracking-wide">Custom CLI Flags</label>
        <input
          type="text"
          value={customArgs}
          onChange={(e) => setCustomArgs(e.target.value)}
          className="bg-[#121622] border border-zinc-700/60 rounded-md px-2.5 py-1 text-zinc-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 w-36 text-xs font-mono transition-colors"
          placeholder="e.g. --resume"
        />
      </div>

      <div className="flex items-end h-full pt-4">
        <button
          onClick={() => setConnectTrigger(prev => prev + 1)}
          className="sa-btn-primary flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw className="w-3 h-3" />
          Apply & Restart Bridge
        </button>
      </div>
    </div>
  );
}
