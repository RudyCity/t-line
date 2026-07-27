import React from 'react';
import { Network, Bot, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface SubagentInstance {
  id: string;
  role: string;
  typeName: string;
  status: 'running' | 'completed' | 'failed';
  currentTask?: string;
  fileScope?: string[];
}

interface SubagentTreeVisualizerProps {
  instances: SubagentInstance[];
}

export const SubagentTreeVisualizer: React.FC<SubagentTreeVisualizerProps> = ({ instances }) => {
  return (
    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg font-sans text-xs">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
        <Network className="w-4 h-4 text-cyan-400" />
        <span className="font-semibold text-slate-200">Subagent Hierarchy & Worktrees</span>
        <span className="ml-auto text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-2 py-0.5 rounded-full font-mono">
          {instances.length} Active Node(s)
        </span>
      </div>

      {instances.length === 0 ? (
        <div className="py-4 text-center text-slate-500 text-[11px]">
          Tidak ada Subagent yang sedang berjalan. Mode Single Agent aktif.
        </div>
      ) : (
        <div className="space-y-2">
          {instances.map((inst) => (
            <div key={inst.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-md flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-slate-200">{inst.role}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">{inst.typeName}</span>
                </div>
                {inst.status === 'running' && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded-full">
                    <Clock className="w-3 h-3 animate-spin" /> Running
                  </span>
                )}
                {inst.status === 'completed' && (
                  <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </span>
                )}
                {inst.status === 'failed' && (
                  <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800/50 px-1.5 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Failed
                  </span>
                )}
              </div>

              {inst.currentTask && (
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900/80 p-1.5 rounded border border-slate-800/50">
                  {inst.currentTask}
                </div>
              )}

              {inst.fileScope && inst.fileScope.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap text-[10px]">
                  <span className="text-slate-500">Scope:</span>
                  {inst.fileScope.map((scope, i) => (
                    <span key={i} className="bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                      {scope}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
