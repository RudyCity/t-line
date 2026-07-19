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
    <div className="p-4 rounded-lg bg-amber-950/40 border-2 border-amber-500/80 text-amber-100 space-y-3 select-none">
      <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
        <AlertTriangle className="w-5 h-5" />
        <span>Tool Approval Required</span>
      </div>
      <p className="text-xs text-amber-200">
        {pendingPermission.description || `SuperAgent wants to execute: ${JSON.stringify(pendingPermission.toolCall)}`}
      </p>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => handlePermissionDecision(true)}
          className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs px-3 py-1.5 rounded flex items-center gap-1 transition cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" /> Allow Once
        </button>
        <button
          onClick={() => handlePermissionDecision('session')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3 py-1.5 rounded transition cursor-pointer"
        >
          Allow for Session
        </button>
        <button
          onClick={() => handlePermissionDecision(false)}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs px-3 py-1.5 rounded flex items-center gap-1 transition cursor-pointer"
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
    <div className="p-4 rounded-lg bg-indigo-950/50 border-2 border-indigo-500/80 text-indigo-100 space-y-3">
      <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm select-none">
        <HelpCircle className="w-5 h-5 text-indigo-400" />
        <span>Agent Question</span>
      </div>
      <p className="text-xs text-zinc-200 font-medium select-none">
        {pendingQuestion.question}
      </p>

      {pendingQuestion.options && pendingQuestion.options.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          {pendingQuestion.options.map(opt => (
            <label
              key={opt}
              className={`flex items-center gap-2 p-2 rounded border transition cursor-pointer text-xs ${
                isSelected(opt)
                  ? 'bg-indigo-900/40 border-indigo-500 text-white'
                  : 'bg-[#18181f] border-zinc-800 text-zinc-300 hover:bg-zinc-800/40'
              }`}
              onClick={() => handleToggle(opt)}
            >
              <input
                type={pendingQuestion.isMultiSelect ? 'checkbox' : 'radio'}
                checked={isSelected(opt)}
                readOnly
                className="accent-indigo-500"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={customQuestionInput}
          onChange={(e) => setCustomQuestionInput(e.target.value)}
          placeholder="Type your answer here..."
          className="w-full bg-[#18181f] border border-zinc-800 rounded p-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-sans resize-none h-16"
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
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold text-xs px-4 py-1.5 rounded transition cursor-pointer"
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
    <div className="p-4 rounded-lg bg-indigo-950/40 border-2 border-indigo-500/80 text-indigo-100 space-y-3 select-none">
      <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
        <span>⭐ Plan Approval Required</span>
      </div>
      <p className="text-xs text-zinc-300">
        The agent has prepared a plan. Please check and review the implementation plan details in the workspace first, then approve or reject to continue.
      </p>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => handlePlanApproval('approve')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-1.5 rounded flex items-center gap-1 transition cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" /> Approve Plan
        </button>
        <button
          onClick={() => handlePlanApproval('reject')}
          className="bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 font-semibold text-xs px-4 py-1.5 rounded flex items-center gap-1 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" /> Reject Plan
        </button>
      </div>
    </div>
  );
}
