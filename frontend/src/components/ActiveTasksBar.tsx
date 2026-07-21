import { useState } from 'react';
import { Cpu, Terminal, Wrench } from 'lucide-react';
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
  const totalCount = activeSubagents.length + activeChecklistTasks.length + activeProcs.length + (hasActiveTool ? 1 : 0);

  if (totalCount === 0) return null;

  return (
    <div className="mb-2 bg-[#121215]/90 border border-zinc-800/80 rounded-lg p-2 font-mono text-xs shadow-lg backdrop-blur-sm select-none">
      {/* Header Line */}
      <div className="flex items-center justify-between pb-1 mb-1 border-b border-zinc-800/60 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5 font-semibold text-indigo-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active Tasks ({totalCount})</span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-zinc-500 hover:text-zinc-300 text-[10px] flex items-center gap-0.5 cursor-pointer"
        >
          {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
        </button>
      </div>

      {/* Detailed View */}
      {isExpanded ? (
        <div className="space-y-1 max-h-44 overflow-y-auto scrollbar-thin">
          {hasActiveTool && (
            <div className="flex items-center gap-2 text-indigo-300 text-[11px] py-0.5 px-1 bg-indigo-950/40 rounded">
              <Wrench className="w-3 h-3 text-indigo-400 animate-spin shrink-0" />
              <span className="truncate">{toolProgressMsg}</span>
            </div>
          )}

          {activeSubagents.map(sa => (
            <div
              key={sa.id}
              onClick={() => onSelectSubAgent(sa)}
              className="flex items-center justify-between py-1 px-1.5 bg-zinc-900/60 hover:bg-indigo-950/50 rounded border border-zinc-800/50 hover:border-indigo-700/50 cursor-pointer text-[11px]"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Cpu className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="font-semibold text-zinc-200 truncate">
                  {sa.role || sa.typeName || `SubAgent-${sa.id.slice(0, 4)}`}
                </span>
                {sa.prompt && <span className="text-zinc-500 truncate text-[10px] hidden sm:inline">- {sa.prompt}</span>}
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold shrink-0 pl-1">Terminal ↗</span>
            </div>
          ))}

          {activeChecklistTasks.map((t, idx) => {
            const isInProgress = t.status === '/' || (t.status || '').toLowerCase() === 'in_progress';
            return (
              <div key={t.id || idx} className="flex items-center gap-2 py-0.5 px-1 text-[11px]">
                <span className={isInProgress ? 'text-amber-400 font-bold' : 'text-zinc-500 font-bold'}>
                  {isInProgress ? '▸ [/]' : '  [ ]'}
                </span>
                <span className={`truncate ${isInProgress ? 'text-amber-200 font-medium' : 'text-zinc-400'}`}>
                  {t.text}
                </span>
              </div>
            );
          })}

          {activeProcs.map(p => (
            <div key={p.pid} className="flex items-center gap-2 py-0.5 px-1 text-[11px] text-zinc-400">
              <Terminal className="w-3 h-3 text-sky-400 shrink-0" />
              <span className="truncate">{p.name || p.commandLine || `PID ${p.pid}`}</span>
            </div>
          ))}
        </div>
      ) : (
        /* Collapsed minimal horizontal list */
        <div className="flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-none py-0.5">
          {activeSubagents.map(sa => (
            <span
              key={sa.id}
              onClick={() => onSelectSubAgent(sa)}
              className="text-emerald-400 font-semibold cursor-pointer hover:underline shrink-0"
            >
              🤖 {sa.role || sa.typeName}
            </span>
          ))}
          {activeChecklistTasks.map((t, idx) => {
            const isInProgress = t.status === '/' || (t.status || '').toLowerCase() === 'in_progress';
            return (
              <span key={idx} className={`shrink-0 ${isInProgress ? 'text-amber-300 font-medium' : 'text-zinc-400'}`}>
                {isInProgress ? '🟡' : '⚪'} {t.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
