import { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, Search, Terminal, Wrench, Cpu, Check, Copy, Code2 } from 'lucide-react';

interface SuperAgentToolItemProps {
  msg: {
    role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
    text: string;
    toolName?: string;
    args?: any;
    result?: any;
  };
}

export function SuperAgentToolItem({ msg }: SuperAgentToolItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const rawToolName = (msg.toolName || msg.text || 'tool').toLowerCase();
  const args = msg.args || {};
  const result = msg.result;

  const getToolDetails = () => {
    // Read / View File
    if (rawToolName.includes('view') || rawToolName.includes('read')) {
      const path = args.AbsolutePath || args.path || args.file || args.TargetFile || '';
      const filename = path ? path.split(/[/\\]/).pop() : '';
      let lines = '';
      if (args.StartLine && args.EndLine) {
        lines = `#L${args.StartLine}-${args.EndLine}`;
      } else if (args.StartLine) {
        lines = `#L${args.StartLine}`;
      }
      return {
        verb: 'Analyzed',
        icon: <Code2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
        target: filename || path || 'file',
        detail: lines,
        badgeColor: 'text-blue-400'
      };
    }

    // Edit / Replace / Write File
    if (rawToolName.includes('replace') || rawToolName.includes('write') || rawToolName.includes('edit')) {
      const path = args.TargetFile || args.path || args.file || '';
      const filename = path ? path.split(/[/\\]/).pop() : '';
      return {
        verb: 'Edited',
        icon: <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
        target: filename || path || 'file',
        detail: '',
        badgeColor: 'text-emerald-400'
      };
    }

    // Search / Grep
    if (rawToolName.includes('grep') || rawToolName.includes('search')) {
      const query = args.Query || args.query || args.pattern || '';
      return {
        verb: 'Searched',
        icon: <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
        target: query ? `"${query}"` : 'workspace',
        detail: '',
        badgeColor: 'text-amber-400'
      };
    }

    // Command Execution
    if (rawToolName.includes('command') || rawToolName.includes('shell') || rawToolName.includes('exec') || rawToolName.includes('run')) {
      const cmd = args.CommandLine || args.command || args.cmd || '';
      return {
        verb: 'Executed',
        icon: <Terminal className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
        target: cmd || 'command',
        detail: '',
        badgeColor: 'text-purple-400'
      };
    }

    // Subagent Spawn
    if (rawToolName.includes('subagent')) {
      const role = args.Role || args.role || 'subagent';
      return {
        verb: 'Spawned Subagent',
        icon: <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />,
        target: role,
        detail: '',
        badgeColor: 'text-indigo-400'
      };
    }

    // Default Fallback
    return {
      verb: 'Used Tool',
      icon: <Wrench className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
      target: rawToolName,
      detail: '',
      badgeColor: 'text-zinc-400'
    };
  };

  const info = getToolDetails();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = typeof result === 'string' ? result : JSON.stringify(result ?? args, null, 2);
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-1 font-mono text-xs select-none">
      {/* Clickable Header Bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-[#0d101a] hover:bg-[#141826] border border-zinc-800/70 hover:border-zinc-700/80 cursor-pointer transition-all duration-150 group shadow-xs"
      >
        <span className="text-zinc-500 shrink-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-300" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          )}
        </span>

        <span className="text-zinc-400 font-sans text-[11px] shrink-0 font-medium">{info.verb}</span>
        {info.icon}
        <span className="font-semibold text-zinc-200 truncate max-w-sm">{info.target}</span>

        {info.detail && (
          <span className="text-[10px] text-zinc-500 font-mono ml-0.5">{info.detail}</span>
        )}

        <span className="ml-auto text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors uppercase font-bold tracking-wider font-mono">
          {rawToolName}
        </span>
      </div>

      {/* Expanded Body Panel */}
      {expanded && (
        <div className="mt-1.5 ml-4 p-3 rounded-lg bg-[#060810] border border-zinc-800/80 text-zinc-300 font-mono text-xs space-y-2.5 shadow-md">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-1.5">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              Tool Arguments & Execution Result
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800/60 hover:bg-zinc-700/60 transition"
              title="Copy details"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {msg.args && Object.keys(msg.args).length > 0 && (
            <div>
              <span className="text-[10px] text-indigo-400 font-semibold uppercase block mb-1">Arguments:</span>
              <pre className="p-2 bg-[#090c14] rounded border border-zinc-800/80 text-[11px] text-indigo-200/90 overflow-x-auto max-h-40 overflow-y-auto font-mono">
                {JSON.stringify(msg.args, null, 2)}
              </pre>
            </div>
          )}

          {result !== undefined && (
            <div>
              <span className="text-[10px] text-amber-400 font-semibold uppercase block mb-1">Result / Output:</span>
              <pre className="p-2 bg-[#090c14] rounded border border-zinc-800/80 text-[11px] text-zinc-300 overflow-x-auto max-h-60 overflow-y-auto font-mono whitespace-pre-wrap">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
