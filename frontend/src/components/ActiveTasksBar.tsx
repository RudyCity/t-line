import { Terminal, Wrench } from 'lucide-react';
import { SubAgentItem } from './SubAgentTerminalModal';

export interface ChecklistTaskItem {
  id?: string;
  text: string;
  status: 'completed' | 'in_progress' | 'pending' | 'x' | '/' | ' ' | string;
  depth?: number;
}

export interface ProcessItem {
  pid: number;
  name: string;
  status: 'running' | 'idle' | 'stopped' | string;
  commandLine?: string;
  hasExited?: boolean;
}

interface ActiveTasksBarProps {
  subagents: SubAgentItem[];
  procs: ProcessItem[];
  checklistTasks: ChecklistTaskItem[];
  toolProgressMsg?: string;
  onSelectSubAgent: (subagent: SubAgentItem) => void;
}

export function ActiveTasksBar({
  subagents = [],
  procs = [],
  checklistTasks = [],
  toolProgressMsg,
  onSelectSubAgent,
}: ActiveTasksBarProps) {
  const activeSubagents = subagents.filter(sa => {
    const s = (sa.status || '').toUpperCase();
    return s === 'RUNNING' || s === 'ACTIVE';
  });

  // Checklist tasks that are not yet finished
  const activeChecklistTasks = checklistTasks.filter(t => {
    const s = (t.status || '').trim().toLowerCase();
    return s !== 'x' && s !== 'completed';
  });

  const activeProcs = procs.filter(p => {
    const s = (p.status || '').toLowerCase();
    return !p.hasExited && s !== 'stopped' && s !== 'idle';
  });

  const hasActiveTool = Boolean(toolProgressMsg && toolProgressMsg.trim().length > 0);

  const totalActiveCount = activeSubagents.length + activeChecklistTasks.length + activeProcs.length + (hasActiveTool ? 1 : 0);

  if (totalActiveCount === 0) return null;

  return (
    <div className="mb-2 space-y-1 font-sans text-xs max-h-44 overflow-y-auto scrollbar-thin">
      {hasActiveTool && (
        <div className="flex items-center gap-2 px-2 py-1 bg-indigo-950/30 border border-indigo-900/40 rounded font-mono text-[11px] text-indigo-300">
          <Wrench className="w-3 h-3 text-indigo-400 animate-spin shrink-0" />
          <span className="text-indigo-400 font-semibold shrink-0">[Tool]:</span>
          <span className="text-zinc-300 truncate">{toolProgressMsg}</span>
        </div>
      )}

      {activeSubagents.map(sa => (
        <div
          key={sa.id}
          onClick={() => onSelectSubAgent(sa)}
          className="group flex items-center justify-between px-2.5 py-1 bg-[#141419]/90 hover:bg-indigo-950/40 border border-zinc-800/60 hover:border-indigo-800/60 rounded font-mono text-[11px] transition cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-zinc-200 group-hover:text-indigo-300 truncate">
              {sa.role || sa.typeName || `SubAgent-${sa.id.slice(0, 6)}`}
            </span>
            {sa.prompt && (
              <span className="text-[10px] text-zinc-500 font-sans truncate max-w-xs">
                — {sa.prompt}
              </span>
            )}
          </div>

          <span className="flex items-center gap-1 text-[10px] text-indigo-400 group-hover:text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-900/40 shrink-0 ml-2">
            <Terminal className="w-2.5 h-2.5" />
            Terminal
          </span>
        </div>
      ))}

      {activeChecklistTasks.map((t, idx) => {
        const isInProgress = t.status === '/' || (t.status || '').toLowerCase() === 'in_progress';
        return (
          <div
            key={t.id || idx}
            className="flex items-center justify-between px-2.5 py-1 bg-[#141419]/90 border border-zinc-800/60 rounded font-mono text-[11px]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-[9px] font-bold px-1 py-0.2 rounded shrink-0 ${
                isInProgress
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
              }`}>
                {isInProgress ? 'RUNNING' : 'QUEUED'}
              </span>
              <span className="text-zinc-300 truncate">
                {t.text}
              </span>
            </div>
          </div>
        );
      })}

      {activeProcs.map(p => (
        <div
          key={p.pid}
          className="flex items-center justify-between px-2.5 py-1 bg-[#141419]/90 border border-zinc-800/60 rounded font-mono text-[11px]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[9px] font-bold bg-sky-950/80 text-sky-300 border border-sky-800/60 px-1 py-0.2 rounded shrink-0">
              PID {p.pid}
            </span>
            <span className="text-zinc-300 truncate">
              {p.name || p.commandLine || `Process #${p.pid}`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
