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
    <div className="group relative p-4 rounded-xl bg-[#0d0a07]/95 border border-amber-800/80 hover:border-amber-700/60 text-amber-100 space-y-3.5 shadow-xl backdrop-blur-md transition-all duration-200">
      {/* Top Header Badge */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-mono font-semibold uppercase tracking-widest">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Tool Approval Required</span>
        </div>
      </div>

      {/* Description / Tool Call Details */}
      <p className="text-xs text-amber-200/90 font-mono bg-[#16120e]/60 p-3 rounded-lg border border-amber-900/40 leading-relaxed break-all select-all">
        {pendingPermission.description || `SuperAgent wants to execute: ${JSON.stringify(pendingPermission.toolCall)}`}
      </p>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-900/20">
        <button
          onClick={() => handlePermissionDecision(true)}
          className="bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-medium text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Allow Once</span>
        </button>
        <button
          onClick={() => handlePermissionDecision('session')}
          className="bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-medium text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition-all duration-150 cursor-pointer"
        >
          <span>Allow for Session</span>
        </button>
        <button
          onClick={() => handlePermissionDecision(false)}
          className="bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] border border-zinc-700/60 text-zinc-300 font-medium text-xs px-3.5 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
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
    <div className="group relative p-4 rounded-xl bg-[#090d16]/95 border border-zinc-800/90 hover:border-zinc-700/80 text-zinc-100 space-y-3.5 shadow-xl backdrop-blur-md transition-all duration-200">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
            Agent Question
          </span>
        </div>
        {pendingQuestion.isMultiSelect && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300">
            Select Multiple
          </span>
        )}
      </div>

      {/* Question Text */}
      <p className="text-xs sm:text-sm font-medium text-zinc-100 leading-snug tracking-tight">
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
                    ? 'bg-indigo-950/40 border-indigo-500/60 text-white shadow-sm ring-1 ring-indigo-500/20'
                    : 'bg-[#101522]/60 border-zinc-800/80 text-zinc-300 hover:bg-[#151c2e] hover:border-zinc-700 hover:text-zinc-100'
                }`}
              >
                <div
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all duration-150 ${
                    pendingQuestion.isMultiSelect ? 'rounded' : 'rounded-full'
                  } ${
                    active
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'border border-zinc-700 bg-zinc-900/50 text-transparent'
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
            className="w-full bg-[#101522]/80 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 font-sans resize-none h-20 transition-all duration-150"
          />
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/50">
        <span className="text-[10px] text-zinc-500 font-mono">
          {hasOptions ? `${selectedQuestionAnswers.length} selected` : ''}
        </span>
        <button
          onClick={handleQuestionSubmit}
          disabled={isSubmitDisabled}
          className="bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-medium text-xs px-4 py-1.5 rounded-lg shadow-sm hover:shadow-indigo-500/20 transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
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
    <div className="group relative p-4 rounded-xl bg-[#090d16]/95 border border-indigo-800/80 hover:border-indigo-700/60 text-indigo-100 space-y-3.5 shadow-xl backdrop-blur-md transition-all duration-200">
      {/* Top Header Badge */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-semibold">
          Plan Approval Required
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-300 leading-relaxed font-medium">
        The agent has created an implementation plan. Review the plan details in the workspace, then authorize execution.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-900/20">
        <button
          onClick={() => handlePlanApproval('approve')}
          className="bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-medium text-xs px-4 py-1.5 rounded-lg shadow-sm hover:shadow-emerald-500/20 transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Approve & Execute Plan</span>
        </button>
        <button
          onClick={() => handlePlanApproval('reject')}
          className="bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] border border-zinc-700/60 text-zinc-300 font-medium text-xs px-4 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Reject Plan</span>
        </button>
      </div>
    </div>
  );
}
