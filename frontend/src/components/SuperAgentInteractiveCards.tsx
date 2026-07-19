import { Check, X, AlertTriangle, HelpCircle } from 'lucide-react';

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
    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/60 text-amber-100 space-y-3 select-none shadow-lg backdrop-filter backdrop-blur-md">
      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs tracking-wide uppercase font-mono">
        <AlertTriangle className="w-4 h-4" />
        <span>Tool Approval Required</span>
      </div>
      <p className="text-xs text-amber-200/90 font-mono bg-amber-950/50 p-2.5 rounded-md border border-amber-500/20 leading-relaxed break-all">
        {pendingPermission.description || `SuperAgent wants to execute: ${JSON.stringify(pendingPermission.toolCall)}`}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => handlePermissionDecision(true)}
          className="bg-amber-600 hover:bg-amber-500 active:translate-y-0.5 text-white font-medium text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <Check className="w-3.5 h-3.5" /> Allow Once
        </button>
        <button
          onClick={() => handlePermissionDecision('session')}
          className="bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 text-white font-medium text-xs px-3 py-1.5 rounded-md transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          Allow for Session
        </button>
        <button
          onClick={() => handlePermissionDecision(false)}
          className="bg-zinc-800 hover:bg-zinc-700 active:translate-y-0.5 text-zinc-300 font-medium text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          <X className="w-3.5 h-3.5" /> Deny
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

  return (
    <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/50 text-indigo-100 space-y-3 shadow-lg backdrop-filter backdrop-blur-md">
      <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs tracking-wide uppercase font-mono select-none">
        <HelpCircle className="w-4 h-4 text-indigo-400" />
        <span>Agent Question</span>
      </div>
      <p className="text-xs text-zinc-200 font-medium leading-relaxed select-none">
        {pendingQuestion.question}
      </p>

      {pendingQuestion.options && pendingQuestion.options.length > 0 ? (
        <div className="space-y-2 pt-1">
          {pendingQuestion.options.map(opt => (
            <label
              key={opt}
              className={`flex items-center gap-2.5 p-2.5 rounded-md border transition cursor-pointer text-xs ${
                isSelected(opt)
                  ? 'bg-indigo-900/40 border-indigo-500 text-white shadow-sm'
                  : 'bg-[#121622] border-zinc-800 text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-700'
              }`}
              onClick={() => handleToggle(opt)}
            >
              <input
                type={pendingQuestion.isMultiSelect ? 'checkbox' : 'radio'}
                checked={isSelected(opt)}
                readOnly
                className="accent-indigo-500 rounded"
              />
              <span className="leading-snug">{opt}</span>
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={customQuestionInput}
          onChange={(e) => setCustomQuestionInput(e.target.value)}
          placeholder="Type your response..."
          className="w-full bg-[#121622] border border-zinc-700/60 rounded-md p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 font-sans resize-none h-20 transition-colors"
        />
      )}

      <div className="flex justify-end pt-1">
        <button
          onClick={handleQuestionSubmit}
          disabled={
            (!pendingQuestion.options || pendingQuestion.options.length === 0)
              ? !customQuestionInput.trim()
              : selectedQuestionAnswers.length === 0
          }
          className="bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:translate-y-0 text-white font-medium text-xs px-4 py-1.5 rounded-md transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          Submit Answer
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
    <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/60 text-indigo-100 space-y-3 select-none shadow-lg backdrop-filter backdrop-blur-md">
      <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs tracking-wide uppercase font-mono">
        <span>⭐ Plan Approval Required</span>
      </div>
      <p className="text-xs text-zinc-300 leading-relaxed">
        The agent has created an implementation plan. Review the plan details in the workspace, then authorize execution.
      </p>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => handlePlanApproval('approve')}
          className="bg-emerald-600 hover:bg-emerald-500 active:translate-y-0.5 text-white font-medium text-xs px-4 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <Check className="w-3.5 h-3.5" /> Approve & Execute Plan
        </button>
        <button
          onClick={() => handlePlanApproval('reject')}
          className="bg-zinc-800 hover:bg-zinc-700 active:translate-y-0.5 border border-zinc-700 text-zinc-300 font-medium text-xs px-4 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          <X className="w-3.5 h-3.5" /> Reject Plan
        </button>
      </div>
    </div>
  );
}
