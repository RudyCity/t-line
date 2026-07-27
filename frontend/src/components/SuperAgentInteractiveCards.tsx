import React from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';

export interface PendingPermission {
  permissionId: string;
  toolCall: any;
  description?: string;
}

export interface PendingQuestion {
  questionId: string;
  question: string;
  options?: string[];
  isMultiSelect?: boolean;
}

interface PermissionCardProps {
  pendingPermission: PendingPermission;
  handlePermissionDecision: (approval: boolean | 'session') => void;
}

export function PermissionCard({ pendingPermission, handlePermissionDecision }: PermissionCardProps) {
  return (
    <div className="group relative p-4 rounded-xl bg-[var(--bg-card)] border border-amber-500/50 hover:border-amber-500 text-[var(--text-main)] space-y-3.5  backdrop-blur-md transition-all duration-200">
      {/* Top Header Badge */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-mono font-semibold uppercase tracking-widest">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Tool Approval Required</span>
        </div>
      </div>

      {/* Description / Tool Call Details */}
      <p className="text-xs text-[var(--text-main)] font-mono bg-[var(--bg-sidebar)] p-3 rounded-lg border border-amber-500/30 leading-relaxed break-all select-all">
        {pendingPermission.description || `SuperAgent wants to execute: ${JSON.stringify(pendingPermission.toolCall)}`}
      </p>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-color)]">
        <button
          onClick={() => handlePermissionDecision(true)}
          className="bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-medium text-xs px-3.5 py-1.5 rounded-lg  transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Allow Once</span>
        </button>
        <button
          onClick={() => handlePermissionDecision('session')}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] text-white font-medium text-xs px-3.5 py-1.5 rounded-lg  transition-all duration-150 cursor-pointer"
        >
          <span>Allow for Session</span>
        </button>
        <button
          onClick={() => handlePermissionDecision(false)}
          className="bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] active:scale-[0.98] border border-[var(--border-color)] text-[var(--text-main)] font-medium text-xs px-3.5 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Deny</span>
        </button>
      </div>
    </div>
  );
}

interface QuestionCardProps {
  pendingQuestion: PendingQuestion;
  selectedQuestionAnswers: string[];
  setSelectedQuestionAnswers: React.Dispatch<React.SetStateAction<string[]>>;
  customQuestionInput: string;
  setCustomQuestionInput: (val: string) => void;
  handleQuestionSubmit: () => void;
}

export function QuestionCard({
  pendingQuestion,
  selectedQuestionAnswers,
  setSelectedQuestionAnswers,
  customQuestionInput,
  setCustomQuestionInput,
  handleQuestionSubmit
}: QuestionCardProps) {
  const isSelected = (opt: string) => selectedQuestionAnswers.includes(opt);
  const handleToggle = (opt: string) => {
    if (pendingQuestion.isMultiSelect) {
      setSelectedQuestionAnswers(prev =>
        prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
      );
    } else {
      setSelectedQuestionAnswers([opt]);
    }
  };

  const hasOptions = pendingQuestion.options && pendingQuestion.options.length > 0;
  const isSubmitDisabled = hasOptions
    ? selectedQuestionAnswers.length === 0
    : !customQuestionInput.trim();

  return (
    <div className="group relative p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--color-primary)]/50 text-[var(--text-main)] space-y-3.5  backdrop-blur-md transition-all duration-200">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]"></span>
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-primary)] font-semibold">
            Agent Question
          </span>
        </div>
        {pendingQuestion.isMultiSelect && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/40 text-[var(--color-primary)]">
            Select Multiple
          </span>
        )}
      </div>

      {/* Question Text */}
      <p className="text-xs sm:text-sm font-medium text-[var(--text-main)] leading-snug tracking-tight">
        {pendingQuestion.question}
      </p>

      {/* Options List or Input Area */}
      {hasOptions ? (
        <div className="space-y-1.5 pt-0.5">
          {pendingQuestion.options!.map(opt => {
            const active = isSelected(opt);
            return (
              <div
                key={opt}
                onClick={() => handleToggle(opt)}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all duration-150 cursor-pointer select-none text-xs ${
                  active
                    ? 'bg-[var(--color-primary-glow)] border-[var(--color-primary)] text-[var(--text-main)]  ring-1 ring-[var(--color-primary)]/20'
                    : 'bg-[var(--bg-sidebar)] border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--surface-overlay-hover)] hover:border-[var(--border-color)] hover:text-[var(--text-main)]'
                }`}
              >
                <div
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all duration-150 ${
                    pendingQuestion.isMultiSelect ? 'rounded' : 'rounded-full'
                  } ${
                    active
                      ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                      : 'border border-[var(--border-color)] bg-[var(--bg-main)] text-transparent'
                  }`}
                >
                  {pendingQuestion.isMultiSelect ? (
                    <Check className="w-3 h-3 stroke-[3]" />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full bg-white transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
                  )}
                </div>
                <span className="leading-snug pt-0.5">{opt}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pt-0.5">
          <textarea
            value={customQuestionInput}
            onChange={(e) => setCustomQuestionInput(e.target.value)}
            placeholder="Type your response..."
            className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg p-3 text-xs text-[var(--text-main)] placeholder:[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary-glow)] font-sans resize-none h-20 transition-all duration-150"
          />
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]">
        <span className="text-[10px] text-[var(--text-muted)] font-mono">
          {hasOptions ? `${selectedQuestionAnswers.length} selected` : ''}
        </span>
        <button
          onClick={handleQuestionSubmit}
          disabled={isSubmitDisabled}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:active:scale-100 text-white font-medium text-xs px-4 py-1.5 rounded-lg   transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
        >
          <span>Submit Answer</span>
        </button>
      </div>
    </div>
  );
}

interface PlanCardProps {
  pendingPlanApproval: boolean;
  handlePlanApproval: (action: 'approve' | 'reject') => void;
}

export function PlanCard({ pendingPlanApproval, handlePlanApproval }: PlanCardProps) {
  if (!pendingPlanApproval) return null;
  return (
    <div className="group relative p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--color-primary)]/50 hover:border-[var(--color-primary)] text-[var(--text-main)] space-y-3.5  backdrop-blur-md transition-all duration-200">
      {/* Top Header Badge */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]"></span>
        </span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-primary)] font-semibold">
          Plan Approval Required
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--text-main)] leading-relaxed font-medium">
        The agent has created an implementation plan. Review the plan details in the workspace, then authorize execution.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-color)]">
        <button
          onClick={() => handlePlanApproval('approve')}
          className="bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-medium text-xs px-4 py-1.5 rounded-lg  hover: transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Approve & Execute Plan</span>
        </button>
        <button
          onClick={() => handlePlanApproval('reject')}
          className="bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] active:scale-[0.98] border border-[var(--border-color)] text-[var(--text-main)] font-medium text-xs px-4 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Reject Plan</span>
        </button>
      </div>
    </div>
  );
}

export interface AdvisorResultCardProps {
  title?: string;
  verdict?: 'PASS' | 'WARN' | 'BLOCK' | 'SUGGESTION' | 'INFO';
  confidence?: number;
  summary?: string;
  reasoning?: string;
  suggestions?: string[];
  rawText?: string;
}

export function AdvisorResultCard({
  title = 'Execution Advisor Result',
  verdict = 'INFO',
  confidence,
  summary,
  reasoning,
  suggestions = [],
  rawText,
}: AdvisorResultCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const getVerdictStyle = (v: string) => {
    switch (v.toUpperCase()) {
      case 'PASS':
      case 'SUCCESS':
      case 'APPROVED':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <Check className="w-4 h-4 text-emerald-400 shrink-0" />,
        };
      case 'WARN':
      case 'WARNING':
      case 'CAUTION':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          badge: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
        };
      case 'BLOCK':
      case 'FAIL':
      case 'ERROR':
      case 'DENIED':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
          badge: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
          icon: <X className="w-4 h-4 text-rose-400 shrink-0" />,
        };
      case 'SUGGESTION':
      case 'RECOMMENDATION':
        return {
          bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
          badge: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
          icon: <AlertTriangle className="w-4 h-4 text-cyan-400 shrink-0" />,
        };
      default:
        return {
          bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
          badge: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
          icon: <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0" />,
        };
    }
  };

  const style = getVerdictStyle(verdict);

  const handleCopy = () => {
    const textToCopy = rawText || `${title} [${verdict}]: ${summary || reasoning || ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`my-2 p-3.5 rounded-xl border backdrop-blur-md transition-all duration-200 ${style.bg} space-y-2.5`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {style.icon}
          <span className="font-semibold text-xs text-[var(--text-main)] truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confidence !== undefined && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-card)]/60 text-[var(--text-secondary)] border border-[var(--border-color)]">
              Confidence: {Math.round(confidence * (confidence <= 1 ? 100 : 1))}%
            </span>
          )}
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${style.badge}`}>
            {verdict}
          </span>
        </div>
      </div>

      {/* Primary Summary */}
      {summary && (
        <p className="text-xs text-[var(--text-main)] leading-relaxed font-medium">
          {summary}
        </p>
      )}

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-white/5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
            Suggested Actions:
          </span>
          <ul className="space-y-1">
            {suggestions.map((item, idx) => (
              <li key={idx} className="text-xs flex items-start gap-1.5 text-[var(--text-main)]">
                <span className="text-[var(--color-primary)] font-bold">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reasoning or Raw Text Toggle */}
      {(reasoning || rawText) && (
        <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[11px]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--color-primary)] hover:underline flex items-center gap-1 font-mono font-medium cursor-pointer"
          >
            {expanded ? 'Hide Details' : 'View Details & Reasoning'}
          </button>
          <button
            onClick={handleCopy}
            className="text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors px-2 py-0.5 rounded bg-[var(--bg-card)]/40 border border-[var(--border-color)] text-[10px] cursor-pointer flex items-center gap-1"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Expanded Content */}
      {expanded && (reasoning || rawText) && (
        <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 font-mono text-[11px] text-[var(--text-main)] whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-48">
          {reasoning || rawText}
        </div>
      )}
    </div>
  );
}

