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
    <div className="p-3 bg-[var(--r-ui-color-surface,var(--bg-card))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] rounded-lg font-sans text-xs">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--r-ui-color-border-subtle,var(--border-color))]">
        <Network className="w-4 h-4 text-[var(--r-ui-color-accent-primary,var(--color-primary))]" />
        <span className="font-semibold text-[var(--r-ui-color-text-primary,var(--text-main))]">Subagent Hierarchy & Worktrees</span>
        <span className="ml-auto text-[10px] bg-[var(--r-ui-color-accent-primary)]/10 text-[var(--r-ui-color-accent-primary,var(--color-primary))] border border-[var(--r-ui-color-accent-primary)]/20 px-2 py-0.5 rounded-full font-mono font-medium">
          {instances.length} Active Node(s)
        </span>
      </div>

      {instances.length === 0 ? (
        <div className="py-4 text-center text-[var(--r-ui-color-text-tertiary,var(--text-dark))] text-[11px]">
          Tidak ada Subagent yang sedang berjalan. Mode Single Agent aktif.
        </div>
      ) : (
        <div className="space-y-2">
          {instances.map((inst) => (
            <div key={inst.id} className="p-2.5 bg-[var(--r-ui-color-canvas,var(--bg-main))] border border-[var(--r-ui-color-border-subtle,var(--border-color))] rounded-md flex flex-col gap-1.5 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[var(--r-ui-color-accent-primary,var(--color-primary))]" />
                  <span className="font-semibold text-[var(--r-ui-color-text-primary,var(--text-main))]">{inst.role}</span>
                  <span className="text-[10px] text-[var(--r-ui-color-text-secondary,var(--text-muted))] bg-[var(--r-ui-color-surface-elevated,var(--bg-card))] px-1.5 py-0.5 rounded font-mono border border-[var(--r-ui-color-border-subtle,var(--border-color))]">{inst.typeName}</span>
                </div>
                {inst.status === 'running' && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--r-ui-color-success)] bg-[var(--r-ui-color-success-bg,rgba(16,185,129,0.1))] border border-[var(--r-ui-color-success)]/30 px-2 py-0.5 rounded-full font-mono">
                    <Clock className="w-3 h-3 animate-spin" /> Running
                  </span>
                )}
                {inst.status === 'completed' && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--r-ui-color-accent-primary,var(--color-primary))] bg-[var(--r-ui-color-accent-primary)]/10 border border-[var(--r-ui-color-accent-primary)]/30 px-2 py-0.5 rounded-full font-mono">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </span>
                )}
                {inst.status === 'failed' && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--r-ui-color-error)] bg-[var(--r-ui-color-error-bg,rgba(239,68,68,0.1))] border border-[var(--r-ui-color-error)]/30 px-2 py-0.5 rounded-full font-mono">
                    <AlertCircle className="w-3 h-3" /> Failed
                  </span>
                )}
              </div>

              {inst.currentTask && (
                <div className="text-[11px] text-[var(--r-ui-color-text-secondary,var(--text-muted))] font-mono bg-[var(--r-ui-color-surface-elevated,var(--bg-card))] p-2 rounded border border-[var(--r-ui-color-border-subtle,var(--border-color))]">
                  {inst.currentTask}
                </div>
              )}

              {inst.fileScope && inst.fileScope.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap text-[10px]">
                  <span className="text-[var(--r-ui-color-text-tertiary,var(--text-dark))]">Scope:</span>
                  {inst.fileScope.map((scope, i) => (
                    <span key={i} className="bg-[var(--r-ui-color-surface-elevated,var(--bg-card))] text-[var(--r-ui-color-text-secondary,var(--text-muted))] px-1.5 py-0.2 rounded font-mono border border-[var(--r-ui-color-border-subtle,var(--border-color))]">
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
