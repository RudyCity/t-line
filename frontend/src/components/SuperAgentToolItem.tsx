import { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, Search, Terminal, Wrench, Cpu, Check, Copy, Code2, Maximize2, Minimize2 } from 'lucide-react';

interface SuperAgentToolItemProps {
  msg: {
    role: 'user' | 'assistant' | 'system' | 'tool' | 'thought' | 'connection';
    text: string;
    toolName?: string;
    args?: any;
    result?: any;
    callId?: string;
  };
}

export function SuperAgentToolItem({ msg }: SuperAgentToolItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullHeight, setFullHeight] = useState(false);

  let rawToolName = (msg.toolName || '').toLowerCase();

  // Safely parse args if string
  let args = msg.args || {};
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      args = { raw: msg.args };
    }
  }

  if (!rawToolName || rawToolName === 'tool') {
    const textMatch = (msg.text || '').match(/(?:Tool '|Invoking tool: |tool: )([a-zA-Z0-9_-]+)/i);
    if (textMatch && textMatch[1]) {
      rawToolName = textMatch[1].toLowerCase();
    } else if (args && typeof args === 'object') {
      if (args.Query || args.query || args.pattern || args.search || args.q) rawToolName = 'grep_search';
      else if (args.CommandLine || args.command || args.cmd) rawToolName = 'run_command';
      else if (args.AbsolutePath || args.TargetFile || args.path || args.file) rawToolName = 'view_file';
      else if (args.Subagents || args.subagents) rawToolName = 'invoke_subagent';
      else rawToolName = 'tool';
    } else {
      rawToolName = 'tool';
    }
  }

  // Safely parse result if stringified JSON
  let result = msg.result;
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      if (typeof parsed === 'object' && parsed !== null) {
        result = parsed;
      }
    } catch {
      // keep raw string
    }
  }

  const getToolDetails = () => {
    const actionName = rawToolName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // 1. Read / View File
    if (rawToolName.includes('view') || rawToolName.includes('read') || rawToolName.includes('file')) {
      const path = args.AbsolutePath || args.path || args.file || args.TargetFile || args.filePath || args.filename || args.Url || args.url || '';
      const filename = path ? String(path).split(/[/\\]/).pop() : '';
      let lines = '';
      if (args.StartLine && args.EndLine) {
        lines = `:L${args.StartLine}-${args.EndLine}`;
      } else if (args.StartLine) {
        lines = `:L${args.StartLine}`;
      }
      const rawTarget = filename || path || '';
      const cleanTarget = (rawTarget && rawTarget.toLowerCase() !== rawToolName && rawTarget.toLowerCase() !== 'read') ? rawTarget : 'file';
      return {
        action: 'Read',
        target: cleanTarget + lines,
        icon: <Code2 className="w-3 h-3 text-blue-400 shrink-0" />
      };
    }

    // 2. Edit / Replace / Write File
    if (rawToolName.includes('replace') || rawToolName.includes('write') || rawToolName.includes('edit')) {
      const path = args.TargetFile || args.path || args.file || args.filePath || '';
      const filename = path ? String(path).split(/[/\\]/).pop() : '';
      const desc = args.Description ? ` (${args.Description})` : '';
      const rawTarget = filename || path || '';
      const cleanTarget = (rawTarget && rawTarget.toLowerCase() !== rawToolName) ? rawTarget : 'file';
      return {
        action: 'Edited',
        target: cleanTarget + desc,
        icon: <FileCode className="w-3 h-3 text-emerald-400 shrink-0" />
      };
    }

    // 3. Search / Grep / Query
    if (rawToolName.includes('grep') || rawToolName.includes('search') || rawToolName.includes('query')) {
      const query = args.Query || args.query || args.pattern || args.search || args.q || args.searchTerm || args.text || args.Prompt || args.prompt || '';
      const path = args.SearchPath || args.path || args.TargetFile || args.file || '';
      const targetText = query ? `"${query}"` : (path ? String(path).split(/[/\\]/).pop() : 'workspace');
      return {
        action: 'Searched',
        target: targetText,
        icon: <Search className="w-3 h-3 text-amber-400 shrink-0" />
      };
    }

    // 4. Command Execution
    if (rawToolName.includes('command') || rawToolName.includes('shell') || rawToolName.includes('exec') || rawToolName.includes('run')) {
      const cmd = args.CommandLine || args.command || args.cmd || args.script || '';
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
        target: (role && role.toLowerCase() !== 'subagent' ? role : 'agent'),
        icon: <Cpu className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
      };
    }

    // 6. Manage Task / Manage Plan / Tasks
    if (rawToolName.includes('task') || rawToolName.includes('plan')) {
      const subAction = args.Action || args.action || '';
      const detail = args.Description || args.TargetFile || args.TaskId || args.Input || '';
      const targetText = subAction ? `${subAction}${detail ? ` (${detail})` : ''}` : detail;
      return {
        action: actionName,
        target: targetText || 'task',
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
    const primaryArgKey = typeof args === 'object' && args !== null
      ? Object.keys(args).find(k =>
          ['Action', 'action', 'Target', 'target', 'Description', 'description', 'Url', 'url', 'Prompt', 'prompt', 'Name', 'name', 'Title', 'title', 'Question', 'question', 'Query', 'query'].includes(k)
        )
      : undefined;
    const primaryArgVal = primaryArgKey ? String(args[primaryArgKey]) : '';
    const fallbackTarget = primaryArgVal || (typeof args === 'object' && args !== null && Object.keys(args).length > 0 ? JSON.stringify(args).slice(0, 50) : '');

    return {
      action: actionName,
      target: (fallbackTarget && fallbackTarget.toLowerCase() !== rawToolName ? fallbackTarget : 'step'),
      icon: <Wrench className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
    };
  };

  const info = getToolDetails();
  const displayTarget = info.target && info.target.toLowerCase() !== info.action.toLowerCase() && info.target.toLowerCase() !== rawToolName
    ? info.target
    : (rawToolName.includes('read') || rawToolName.includes('view') ? 'file' : rawToolName.includes('search') || rawToolName.includes('grep') ? 'workspace' : 'step');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = typeof result === 'string' ? result : JSON.stringify(result ?? args ?? msg.text, null, 2);
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasArgs = args && (
    typeof args === 'object' ? Object.keys(args).length > 0 : Boolean(args)
  );

  const hasResult = result !== undefined && result !== null;
  const isCompleted = hasResult || (msg.text && msg.text.includes('completed'));

  return (
    <div className="py-0.5 px-1 font-mono text-[11px] w-full select-text">
      {/* Clickable Compact Log Line */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer transition-colors py-0.5 select-none"
      >
        {info.icon}
        <span className="font-sans font-medium text-[var(--text-muted)]">{info.action}</span>
        <span className="font-mono text-[var(--text-main)] truncate max-w-md" title={displayTarget}>{displayTarget}</span>
        <span className="shrink-0">
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
          )}
        </span>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-1 ml-4 pl-2.5 border-l border-[var(--border-color)] text-[var(--text-muted)] font-mono text-[11px] space-y-1.5 select-text">
          <div className="flex items-center justify-between py-0.5 text-[10px] text-[var(--text-muted)] border-b border-[var(--border-color)] pb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text-main)] uppercase tracking-wider">{rawToolName || 'tool'} details</span>
              {msg.callId && (
                <span className="text-[9px] text-[var(--text-muted)] font-mono bg-[var(--bg-card)] px-1 py-0.2 rounded border border-[var(--border-color)]">
                  {msg.callId}
                </span>
              )}
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-medium ${
                isCompleted ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
              }`}>
                {isCompleted ? 'COMPLETED' : 'RUNNING'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setFullHeight(!fullHeight); }}
                className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition px-1.5 py-0.5 rounded bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)]"
                title={fullHeight ? "Collapse View" : "Expand Full View"}
              >
                {fullHeight ? <Minimize2 className="w-2.5 h-2.5" /> : <Maximize2 className="w-2.5 h-2.5" />}
                <span>{fullHeight ? 'Compact' : 'Full View'}</span>
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition px-1.5 py-0.5 rounded bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)]"
                title="Copy"
              >
                {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {hasArgs && (
            <div>
              <span className="text-[10px] text-[var(--color-primary)] font-semibold uppercase block mb-0.5">Arguments:</span>
              <pre className={`p-1.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] text-[var(--text-main)] overflow-x-auto font-mono custom-scrollbar ${
                fullHeight ? 'max-h-none' : 'max-h-48'
              }`}>
                {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}

          {hasResult && (
            <div>
              <span className="text-[10px] text-amber-400 font-semibold uppercase block mb-0.5">Output:</span>
              <pre className={`p-1.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] text-[var(--text-main)] overflow-x-auto font-mono whitespace-pre-wrap custom-scrollbar ${
                fullHeight ? 'max-h-none' : 'max-h-96'
              }`}>
                {typeof result === 'string' ? (result || '(empty output)') : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {!hasArgs && !hasResult && (
            <div>
              <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase block mb-0.5">Status / Log:</span>
              <pre className={`p-1.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] text-[var(--text-muted)] overflow-x-auto font-mono whitespace-pre-wrap custom-scrollbar ${
                fullHeight ? 'max-h-none' : 'max-h-32'
              }`}>
                {msg.text || 'Tool invocation completed.'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
