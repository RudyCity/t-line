import { useState, useRef, useEffect } from 'react';
import { X, Copy, Check, ArrowDown, Cpu, Sparkles, Terminal } from 'lucide-react';

export interface SubAgentItem {
  id: string;
  typeName?: string;
  role?: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'IDLE' | string;
  prompt?: string;
  result?: string;
  logs?: string[];
  startedAt?: string;
  completedAt?: string;
  model?: string;
}

interface SubAgentTerminalModalProps {
  subagent: SubAgentItem | null;
  onClose: () => void;
}

export function SubAgentTerminalModal({ subagent, onClose }: SubAgentTerminalModalProps) {
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [subagent?.logs, subagent?.result, autoScroll]);

  if (!subagent) return null;

  const logs = subagent.logs || [];
  const hasContent = logs.length > 0 || !!subagent.result || !!subagent.prompt;

  const fullText = [
    subagent.prompt ? `[TASK PROMPT]\n${subagent.prompt}\n` : '',
    ...logs,
    subagent.result ? `\n[RESULT SUMMARY]\n${subagent.result}` : ''
  ].filter(Boolean).join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    const s = (subagent.status || 'RUNNING').toUpperCase();
    if (s === 'RUNNING' || s === 'ACTIVE') {
      return (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          RUNNING
        </span>
      );
    }
    if (s === 'COMPLETED' || s === 'DONE') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-500 border border-indigo-500/30">
          ✓ COMPLETED
        </span>
      );
    }
    if (s === 'FAILED' || s === 'ERROR') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30">
          ✕ ERROR
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
        {s}
      </span>
    );
  };

  const isProcess = subagent.typeName === 'Process' || subagent.id.startsWith('proc-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col w-full max-w-4xl h-[80vh] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden font-sans">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--panel-header-bg)] border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-lg border shrink-0 ${isProcess ? 'bg-sky-950/40 border-sky-500/40 text-sky-400' : 'bg-[var(--color-primary-glow)] border-[var(--color-primary)]/40 text-[var(--color-primary)]'}`}>
              {isProcess ? <Terminal className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[var(--text-main)] font-mono truncate">
                  {subagent.role || subagent.typeName || `SubAgent-${subagent.id}`}
                </span>
                {getStatusBadge()}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                ID: {subagent.id} {subagent.model ? `• Model: ${subagent.model}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!hasContent}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)] rounded-lg text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
              title="Copy Output Logs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[11px]">{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1.5 border rounded-lg text-xs transition flex items-center gap-1 cursor-pointer ${
                autoScroll ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] border-[var(--color-primary)]/60' : 'bg-[var(--bg-sidebar)] text-[var(--text-muted)] border-[var(--border-color)]'
              }`}
              title="Toggle Auto Scroll"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-white bg-[var(--bg-sidebar)] hover:bg-red-950/80 hover:border-red-800/60 border border-[var(--border-color)] rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Terminal Content */}
        <div className="flex-1 p-4 bg-[var(--bg-main)] overflow-y-auto font-mono text-xs leading-relaxed text-[var(--text-main)] select-text scrollbar-thin">
          {subagent.prompt && (
            <div className="mb-4 p-3 bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/30 rounded-lg">
              <span className="text-[10px] text-[var(--color-primary)] uppercase tracking-wider font-bold block mb-1">
                {isProcess ? 'Command Line / Task' : 'Input Prompt / Task'}
              </span>
              <p className="whitespace-pre-wrap text-[var(--text-main)]">{subagent.prompt}</p>
            </div>
          )}

          {logs.length > 0 ? (
            <div className="space-y-1">
              {logs.map((logLine, index) => {
                const isErr = logLine.toLowerCase().includes('error') || logLine.toLowerCase().includes('fail');
                const isSuccess = logLine.toLowerCase().includes('success') || logLine.toLowerCase().includes('complete');
                const isTool = logLine.startsWith('Tool:') || logLine.includes('toolCall');

                return (
                  <div
                    key={index}
                    className={`py-0.5 whitespace-pre-wrap ${
                      isErr
                        ? 'text-red-400'
                        : isSuccess
                        ? 'text-emerald-400'
                        : isTool
                        ? 'text-amber-300'
                        : 'text-[var(--text-main)]'
                    }`}
                  >
                    <span className="text-[var(--text-muted)] select-none mr-2 font-mono text-[10px]">
                      [{index + 1}]
                    </span>
                    {logLine}
                  </div>
                );
              })}
            </div>
          ) : (
            !subagent.result && (
              <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)] gap-2">
                <Sparkles className="w-6 h-6 animate-pulse text-[var(--color-primary)]" />
                <span className="text-xs">{isProcess ? 'Streaming process output...' : 'Streaming subagent terminal output...'}</span>
              </div>
            )
          )}

          {subagent.result && (
            <div className="mt-4 p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-lg">
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold block mb-1">
                Final Result Summary
              </span>
              <div className="whitespace-pre-wrap text-emerald-200">{subagent.result}</div>
            </div>
          )}

          <div ref={terminalEndRef} />
        </div>

        {/* Status Bar Footer */}
        <div className="px-4 py-2 bg-[var(--panel-header-bg)] border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)] flex justify-between items-center shrink-0">
          <span>{isProcess ? 'Process / Task ID' : 'Subagent ID'}: {subagent.id}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {isProcess ? 'Live Process Terminal Output' : 'Live Subagent Session Active'}
          </span>
        </div>
      </div>
    </div>
  );
}
