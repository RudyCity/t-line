import { useState } from 'react';
import { Cpu, Terminal, ListTodo, ChevronUp, ChevronDown, Wrench } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(true);

  const activeSubagents = subagents.filter(sa => {
    const s = (sa.status || '').toUpperCase();
    return s === 'RUNNING' || s === 'ACTIVE';
  });

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
    <div className="mb-2 bg-[#0e0e12]/90 border border-zinc-800/70 rounded-lg shadow-md backdrop-blur-md overflow-hidden font-mono text-[11px] transition-all">
      {/* Minimal Header Bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-[#14141a] border-b border-zinc-800/60 select-none">
        <div className="flex items-center gap-1.5">
          <span className="relative flex items-center justify-center w-2 h-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative" />
          </span>
          <span className="font-bold text-zinc-300 tracking-tight uppercase">
            Active Tasks
          </span>
          <span className="text-[10px] text-indigo-400 bg-indigo-950/70 border border-indigo-800/50 px-1.5 py-0.2 rounded font-semibold">
            {totalActiveCount}
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition cursor-pointer flex items-center gap-0.5 text-[10px]"
          title={isExpanded ? 'Collapse active tasks' : 'Expand active tasks'}
        >
          <span>{isExpanded ? 'hide' : 'show'}</span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Compact Content */}
      {isExpanded ? (
        <div className="p-1.5 space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
          {/* Active Tool */}
          {hasActiveTool && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-950/30 border border-indigo-900/40 rounded text-indigo-300 truncate">
              <Wrench className="w-3 h-3 text-indigo-400 animate-spin shrink-0" />
              <span className="text-indigo-400 font-semibold shrink-0">[Tool]:</span>
              <span className="truncate text-zinc-300">{toolProgressMsg}</span>
            </div>
          )}

          {/* Active Subagents */}
          {activeSubagents.map(sa => (
            <div
              key={sa.id}
              onClick={() => onSelectSubAgent(sa)}
              className="flex items-center justify-between px-2 py-1 bg-[#121217] hover:bg-indigo-950/40 border border-zinc-800/60 hover:border-indigo-800/60 rounded transition cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <Cpu className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="font-bold text-zinc-200 group-hover:text-indigo-300 shrink-0">
                  {sa.role || sa.typeName || `SubAgent-${sa.id.slice(0, 5)}`}
                </span>
                {sa.prompt && (
                  <span className="text-[10px] text-zinc-500 truncate">
                    — {sa.prompt}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.2 rounded shrink-0 ml-1">
                <Terminal className="w-2.5 h-2.5" />
                <span>Live</span>
              </div>
            </div>
          ))}

          {/* Active Checklist Tasks (task.md) */}
          {activeChecklistTasks.map((t, idx) => {
            const isInProgress = t.status === '/' || (t.status || '').toLowerCase() === 'in_progress';
            return (
              <div
                key={t.id || idx}
                className="flex items-center gap-1.5 px-2 py-0.5 bg-[#121217] border border-zinc-800/60 rounded text-zinc-300 truncate"
              >
                <ListTodo className={`w-3 h-3 shrink-0 ${isInProgress ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
                <span className={`text-[9px] font-bold px-1 rounded shrink-0 ${
                  isInProgress ? 'bg-amber-950 text-amber-300 border border-amber-800/50' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {isInProgress ? '[/]' : '[ ]'}
                </span>
                <span className="truncate">{t.text}</span>
              </div>
            );
          })}

          {/* Active Background Processes */}
          {activeProcs.map(p => (
            <div
              key={p.pid}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-[#121217] border border-zinc-800/60 rounded text-zinc-300 truncate"
            >
              <Terminal className="w-3 h-3 text-sky-400 shrink-0" />
              <span className="text-[9px] font-bold bg-sky-950 text-sky-300 border border-sky-800/50 px-1 rounded shrink-0">
                PID {p.pid}
              </span>
              <span className="truncate">{p.name || p.commandLine || `Process #${p.pid}`}</span>
            </div>
          ))}
        </div>
      ) : (
        /* Single-line Collapsed Pills */
        <div className="px-2 py-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {activeSubagents.map(sa => (
            <button
              key={sa.id}
              onClick={() => onSelectSubAgent(sa)}
              className="flex items-center gap-1 px-2 py-0.5 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/50 rounded text-[10px] text-indigo-300 transition cursor-pointer shrink-0"
            >
              <Cpu className="w-2.5 h-2.5 text-emerald-400" />
              <span className="font-semibold">{sa.role || sa.typeName}</span>
            </button>
          ))}

          {activeChecklistTasks.map((t, idx) => {
            const isInProgress = t.status === '/' || (t.status || '').toLowerCase() === 'in_progress';
            return (
              <div
                key={t.id || idx}
                className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 shrink-0"
              >
                <span className={isInProgress ? 'text-amber-400 font-bold' : 'text-zinc-500'}>
                  {isInProgress ? '[/]' : '[ ]'}
                </span>
                <span className="truncate max-w-xs">{t.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
