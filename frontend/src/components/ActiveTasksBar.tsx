import { useState } from 'react';
import { Cpu, Terminal, ListTodo, ChevronUp, ChevronDown, Wrench, Activity } from 'lucide-react';
import { SubAgentItem } from './SubAgentTerminalModal';

export interface ChecklistTaskItem {
  id?: string;
  text: string;
  status: 'completed' | 'in_progress' | 'pending' | string;
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
    const s = (t.status || '').toLowerCase();
    return s === 'in_progress' || s === 'running' || s === '[/]';
  });

  const activeProcs = procs.filter(p => {
    const s = (p.status || '').toLowerCase();
    return !p.hasExited && s !== 'stopped' && s !== 'idle';
  });

  const hasActiveTool = Boolean(toolProgressMsg && toolProgressMsg.trim().length > 0);

  const totalActiveCount = activeSubagents.length + activeChecklistTasks.length + activeProcs.length + (hasActiveTool ? 1 : 0);

  if (totalActiveCount === 0) return null;

  return (
    <div className="mb-2 bg-[#121217]/95 border border-[#2a2a38] rounded-xl shadow-xl backdrop-blur-md overflow-hidden font-sans transition-all duration-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#17171d] border-b border-[#252530]">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
          </div>
          <Activity className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-zinc-200 tracking-wide uppercase font-mono">
            Active Tasks
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
            {totalActiveCount} RUNNING
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition cursor-pointer"
          title={isExpanded ? 'Collapse Active Tasks' : 'Expand Active Tasks'}
        >
          <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Main Body */}
      {isExpanded ? (
        <div className="p-2.5 space-y-2 max-h-52 overflow-y-auto scrollbar-thin">
          {hasActiveTool && (
            <div className="flex items-center gap-2.5 p-2 bg-indigo-950/30 border border-indigo-800/40 rounded-lg text-xs font-mono text-indigo-200">
              <Wrench className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
              <div className="flex-1 min-w-0 truncate">
                <span className="text-indigo-400 font-semibold mr-1.5">[Tool Execution]:</span>
                <span className="text-zinc-300">{toolProgressMsg}</span>
              </div>
            </div>
          )}

          {activeSubagents.map(sa => (
            <div
              key={sa.id}
              onClick={() => onSelectSubAgent(sa)}
              className="group flex items-center justify-between p-2.5 bg-[#17171f] hover:bg-indigo-950/40 border border-[#272733] hover:border-indigo-700/60 rounded-lg transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-emerald-950/60 border border-emerald-800/40 rounded-md text-emerald-400 shrink-0">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-zinc-100 group-hover:text-indigo-300 truncate">
                      {sa.role || sa.typeName || `SubAgent-${sa.id.slice(0, 6)}`}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-bold font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      SUBAGENT
                    </span>
                  </div>
                  {sa.prompt && (
                    <span className="text-[10px] text-zinc-400 font-sans truncate max-w-md">
                      {sa.prompt}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-mono text-indigo-400 group-hover:text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/60 px-2 py-1 rounded-md transition shrink-0 ml-2">
                <Terminal className="w-3 h-3" />
                <span>View Terminal</span>
              </div>
            </div>
          ))}

          {activeChecklistTasks.map((t, idx) => (
            <div
              key={t.id || idx}
              className="flex items-center justify-between p-2 bg-[#17171f] border border-[#272733] rounded-lg text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-amber-950/60 border border-amber-800/40 rounded-md text-amber-400 shrink-0">
                  <ListTodo className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold font-mono bg-amber-950/80 text-amber-300 border border-amber-800/60 px-1.5 py-0.5 rounded-full shrink-0">
                    IN PROGRESS
                  </span>
                  <span className="text-zinc-200 font-mono text-xs truncate">
                    {t.text}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {activeProcs.map(p => (
            <div
              key={p.pid}
              className="flex items-center justify-between p-2 bg-[#17171f] border border-[#272733] rounded-lg text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-sky-950/60 border border-sky-800/40 rounded-md text-sky-400 shrink-0">
                  <Terminal className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold font-mono bg-sky-950/80 text-sky-300 border border-sky-800/60 px-1.5 py-0.5 rounded-full shrink-0">
                    PID {p.pid}
                  </span>
                  <span className="text-zinc-300 font-mono text-xs truncate">
                    {p.name || p.commandLine || `Process #${p.pid}`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-1.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {activeSubagents.map(sa => (
            <button
              key={sa.id}
              onClick={() => onSelectSubAgent(sa)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800/60 rounded-full text-xs font-mono text-indigo-300 transition cursor-pointer shrink-0"
            >
              <Cpu className="w-3 h-3 text-emerald-400" />
              <span className="font-semibold">{sa.role || sa.typeName}</span>
              <span className="text-[10px] text-emerald-400">• Terminal</span>
            </button>
          ))}

          {activeChecklistTasks.map((t, idx) => (
            <div
              key={t.id || idx}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/40 border border-amber-800/40 rounded-full text-xs font-mono text-amber-300 shrink-0"
            >
              <ListTodo className="w-3 h-3 text-amber-400" />
              <span className="truncate max-w-xs">{t.text}</span>
            </div>
          ))}

          {hasActiveTool && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/40 border border-indigo-800/40 rounded-full text-xs font-mono text-indigo-300 shrink-0">
              <Wrench className="w-3 h-3 text-indigo-400 animate-spin" />
              <span className="truncate max-w-xs">{toolProgressMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
