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
    const actionName = rawToolName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // 1. Read / View File
    if (rawToolName.includes('view') || rawToolName.includes('read_file')) {
      const path = args.AbsolutePath || args.path || args.file || args.TargetFile || '';
      const filename = path ? path.split(/[/\\]/).pop() : '';
      let lines = '';
      if (args.StartLine && args.EndLine) {
        lines = `:L${args.StartLine}-${args.EndLine}`;
      } else if (args.StartLine) {
        lines = `:L${args.StartLine}`;
      }
      return {
        action: 'Read',
        target: (filename || path || 'file') + lines,
        icon: <Code2 className="w-3 h-3 text-blue-400 shrink-0" />
      };
    }

    // 2. Edit / Replace / Write File
    if (rawToolName.includes('replace') || rawToolName.includes('write') || rawToolName.includes('edit')) {
      const path = args.TargetFile || args.path || args.file || '';
      const filename = path ? path.split(/[/\\]/).pop() : '';
      const desc = args.Description ? ` (${args.Description})` : '';
      return {
        action: 'Edited',
        target: (filename || path || 'file') + desc,
        icon: <FileCode className="w-3 h-3 text-emerald-400 shrink-0" />
      };
    }

    // 3. Search / Grep
    if (rawToolName.includes('grep') || rawToolName.includes('search')) {
      const query = args.Query || args.query || args.pattern || '';
      return {
        action: 'Searched',
        target: query ? `"${query}"` : 'workspace',
        icon: <Search className="w-3 h-3 text-amber-400 shrink-0" />
      };
    }

    // 4. Command Execution
    if (rawToolName.includes('command') || rawToolName.includes('shell') || rawToolName.includes('exec') || rawToolName.includes('run')) {
      const cmd = args.CommandLine || args.command || args.cmd || '';
      return {
        action: 'Ran',
        target: cmd || 'command',
        icon: <Terminal className="w-3 h-3 text-purple-400 shrink-0" />
      };
    }

    // 5. Subagent Operations
    if (rawToolName.includes('subagent')) {
      const role = args.name || args.Role || args.role || args.Subagents?.[0]?.Role || args.Action || '';
      return {
        action: 'Subagent',
        target: role || rawToolName,
        icon: <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
      };
    }

    // 6. Manage Task / Manage Plan / Tasks
    if (rawToolName.includes('task') || rawToolName.includes('plan')) {
      const subAction = args.Action || args.action || '';
      const detail = args.Description || args.TargetFile || args.TaskId || args.Input || '';
      const targetText = subAction ? `${subAction}${detail ? ` (${detail})` : ''}` : detail;
      return {
        action: actionName,
        target: targetText || rawToolName,
        icon: <Wrench className="w-3 h-3 text-cyan-400 shrink-0" />
      };
    }

    // 7. Schedule / Timer
    if (rawToolName.includes('schedule') || rawToolName.includes('timer')) {
      const prompt = args.Prompt || '';
      const duration = args.DurationSeconds ? `${args.DurationSeconds}s` : args.CronExpression || '';
      return {
        action: 'Schedule',
        target: `${duration}${prompt ? `: ${prompt}` : ''}`,
        icon: <Wrench className="w-3 h-3 text-amber-400 shrink-0" />
      };
    }

    // 8. General Smart Fallback for any other tool
    const primaryArgKey = Object.keys(args).find(k => 
      ['Action', 'action', 'Target', 'target', 'Description', 'description', 'Url', 'url', 'Prompt', 'prompt', 'Name', 'name', 'Title', 'title', 'Question', 'question'].includes(k)
    );
    const primaryArgVal = primaryArgKey ? String(args[primaryArgKey]) : '';
    
    return {
      action: actionName,
      target: primaryArgVal || (Object.keys(args).length > 0 ? JSON.stringify(args).slice(0, 50) : rawToolName),
      icon: <Wrench className="w-3 h-3 text-zinc-400 shrink-0" />
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
    <div className="py-0.5 px-1 font-mono text-[11px] w-full select-text">
      {/* Clickable Compact Log Line */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors py-0.5 select-none"
      >
        {info.icon}
        <span className="font-sans font-medium text-zinc-400">{info.action}</span>
        <span className="font-mono text-zinc-300 truncate max-w-md">{info.target}</span>
        <span className="shrink-0">
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-zinc-600" />
          )}
        </span>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-1 ml-4 pl-2.5 border-l border-zinc-800 text-zinc-400 font-mono text-[11px] space-y-1.5 select-text">
          <div className="flex items-center justify-between py-0.5 text-[10px] text-zinc-500">
            <span>{rawToolName} details</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-zinc-400 hover:text-white transition"
              title="Copy"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {msg.args && Object.keys(msg.args).length > 0 && (
            <div>
              <span className="text-[10px] text-indigo-400 font-semibold uppercase block">Arguments:</span>
              <pre className="p-1 text-[10px] text-indigo-200/90 overflow-x-auto max-h-32 overflow-y-auto font-mono">
                {JSON.stringify(msg.args, null, 2)}
              </pre>
            </div>
          )}

          {result !== undefined && (
            <div>
              <span className="text-[10px] text-amber-400 font-semibold uppercase block">Output:</span>
              <pre className="p-1 text-[10px] text-zinc-300 overflow-x-auto max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
