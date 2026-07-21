import { useState } from 'react';
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

type TimelineItem =
  | { key: string; kind: 'tool'; msg: string }
  | { key: string; kind: 'subagent'; data: SubAgentItem }
  | { key: string; kind: 'task'; data: ChecklistTaskItem; isInProgress: boolean }
  | { key: string; kind: 'proc'; data: ProcessItem };

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

  const items: TimelineItem[] = [];

  if (hasActiveTool && toolProgressMsg) {
    items.push({ key: 'tool-active', kind: 'tool', msg: toolProgressMsg });
  }

  activeSubagents.forEach(sa => {
    items.push({ key: `sub-${sa.id}`, kind: 'subagent', data: sa });
  });

  activeChecklistTasks.forEach((t, idx) => {
    const isInProgress = t.status === '/' || (t.status || '').toLowerCase() === 'in_progress';
    items.push({ key: `task-${t.id || idx}`, kind: 'task', data: t, isInProgress });
  });

  activeProcs.forEach(p => {
    items.push({ key: `proc-${p.pid}`, kind: 'proc', data: p });
  });

  if (items.length === 0) return null;

  return (
    <div className="font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto scrollbar-thin select-none pl-1 mb-0">
      <div className="relative border-l-2 border-indigo-500/60 ml-3.5 pl-3.5 space-y-1 pt-0.5 pb-0">
        {/* Timeline Root Header / Toggle */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative flex items-center justify-between group cursor-pointer py-0.5 text-zinc-400 hover:text-zinc-200 transition"
        >
          <span className="absolute -left-[20px] text-indigo-400 font-bold select-none text-[11px]">
            ┌─►
          </span>
          <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wide text-zinc-300">
            <span className="text-indigo-400 font-mono">TASKS</span>
            <span className="text-zinc-400 font-mono font-normal">({items.length})</span>
            <span className="text-zinc-500 font-normal group-hover:text-indigo-300 text-[9px] bg-zinc-900/80 border border-zinc-800 px-1.5 py-0.2 rounded transition">
              {isExpanded ? '[-] collapse' : '[+] expand'}
            </span>
          </div>
        </div>

        {/* Expanded Tree Items */}
        {isExpanded &&
          items.map(item => (
            <div key={item.key} className="relative flex items-center justify-between group py-0.5">
              {/* Timeline Tree Branch Connector */}
              <span className="absolute -left-[20px] text-indigo-500/80 font-bold select-none text-[11px]">
                ├──
              </span>

              {item.kind === 'tool' && (
                <div className="flex items-center gap-1.5 text-indigo-300 min-w-0 pr-2">
                  <Wrench className="w-3 h-3 text-indigo-400 animate-spin shrink-0" />
                  <span className="text-indigo-400 font-bold shrink-0">[TOOL]:</span>
                  <span className="text-zinc-300 truncate">{item.msg}</span>
                </div>
              )}

              {item.kind === 'subagent' && (
                <div
                  onClick={() => onSelectSubAgent(item.data)}
                  className="flex items-center justify-between w-full hover:text-indigo-300 cursor-pointer transition"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-emerald-400 font-bold shrink-0">[SUBAGENT]:</span>
                    <span className="text-zinc-200 font-semibold truncate">
                      {item.data.role || item.data.typeName || `SubAgent-${item.data.id.slice(0, 6)}`}
                    </span>
                    {item.data.prompt && (
                      <span className="text-zinc-500 text-[10px] truncate max-w-xs font-sans">
                        — {item.data.prompt}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-indigo-400 group-hover:text-indigo-300 bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-900/50 shrink-0 ml-2 transition">
                    <Terminal className="w-2.5 h-2.5" />
                    Terminal
                  </span>
                </div>
              )}

              {item.kind === 'task' && (
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  {item.isInProgress ? (
                    <span className="text-amber-400 font-bold shrink-0">[RUNNING]:</span>
                  ) : (
                    <span className="text-zinc-500 font-bold shrink-0">[QUEUED]:</span>
                  )}
                  <span className={item.isInProgress ? 'text-zinc-200 font-medium truncate' : 'text-zinc-400 truncate'}>
                    {item.data.text}
                  </span>
                </div>
              )}

              {item.kind === 'proc' && (
                <div className="flex items-center gap-1.5 text-sky-300 min-w-0 pr-2">
                  <span className="text-sky-400 font-bold shrink-0">[PROC:{item.data.pid}]:</span>
                  <span className="text-zinc-300 truncate">
                    {item.data.name || item.data.commandLine || `Process #${item.data.pid}`}
                  </span>
                </div>
              )}
            </div>
          ))}

        {/* Bottom Connector line pointing directly into top edge of input card */}
        <div className="relative h-2 -mb-1">
          <span className="absolute -left-[20px] top-0 text-indigo-500 font-bold select-none text-[11px] leading-none">
            └──┐
          </span>
        </div>
      </div>
    </div>
  );
}
