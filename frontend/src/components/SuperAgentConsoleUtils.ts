import { ModelPreset } from './SuperAgentPresetManager';

export const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const fetchCliPromptHistory = async (): Promise<string[]> => {
  try {
    const res = await fetch('/api/superagent/history', { headers: getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.history)) {
        return data.history;
      }
    }
  } catch (e) {
    console.error('Failed to fetch CLI prompt history:', e);
  }
  return [];
};

export const readFileAsText = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });

export const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });

export const getMainModelLabel = (preset: ModelPreset | undefined, agentMode: 'single' | 'multi') => {
  if (!preset?.models) return 'Unknown';
  const m = preset.models;
  if (agentMode === 'multi' && m.master) return typeof m.master === 'object' ? m.master.model : m.master;
  if (m.superagent) return typeof m.superagent === 'object' ? m.superagent.model : m.superagent;
  if (m.MODEL) return typeof m.MODEL === 'object' ? (m.MODEL as any).model : m.MODEL;
  if (m.MODEL_SINGLE) return typeof m.MODEL_SINGLE === 'object' ? (m.MODEL_SINGLE as any).model : m.MODEL_SINGLE;
  return 'Default';
};

export const handleAgentEventPayload = (
  payload: any,
  setLoading: (l: boolean) => void,
  setToolProgressMsg: (m: string) => void,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setSubagentList: React.Dispatch<React.SetStateAction<any[]>>,
  setPendingPermission: (p: any) => void,
  setPendingQuestion: (q: any) => void,
  setSelectedQuestionAnswers: (a: any[]) => void,
  setCustomQuestionInput: (i: string) => void,
  setPendingPlanApproval: (b: boolean) => void,
  isAbortedRef: React.MutableRefObject<boolean>
) => {
  if (payload.type === 'chat_response') {
    // Handle all error scenarios from server
    const result = payload.result;
    const isError = payload.success === false || result?.error || result?.raw;

    if (isError) {
      setLoading(false);
      setToolProgressMsg('');
      const errorText = result?.error
        || (result?.raw ? `Unexpected server response: ${String(result.raw).slice(0, 300)}` : null)
        || result?.message
        || 'Unknown server error';
      setMessages(prev => [...prev, { role: 'system', text: `Error: ${errorText}` }]);
    }
    // If success and no error, the response was accepted — SSE events deliver the actual content
  } else if (payload.type === 'status') {
    if (typeof payload.text === 'string') {
      const statusLower = payload.text.toLowerCase();
      if (statusLower.includes('aborted')) {
        setLoading(false);
        setToolProgressMsg('');
      }
      // Also stop loading for failure statuses
      if (statusLower.includes('failed to') || statusLower.includes('error')) {
        setLoading(false);
        setToolProgressMsg('');
      }
      const isConnNoise = statusLower.includes('websocket') ||
                          statusLower.includes('connected to superagent') ||
                          statusLower.includes('starting superagent') ||
                          statusLower.includes('restarting superagent');
      if (!isConnNoise) {
        setMessages(prev => [...prev, { role: 'system', text: payload.text }]);
      }
    }
  } else if (payload.type === 'agent_event') {
    const innerEvent = payload.event;
    if (innerEvent.type === 'done' || innerEvent.type === 'goal_done') {
      if (!isAbortedRef.current) {
        setLoading(false);
        setToolProgressMsg('');
      }
      return;
    }

    if (isAbortedRef.current) return;

    if (innerEvent.type === 'tool_start') {
      setLoading(true);
      const toolName = innerEvent.toolCall?.name || innerEvent.toolCall?.toolName || innerEvent.toolName || innerEvent.name || 'tool';
      const args = innerEvent.toolCall?.args || innerEvent.args;

      if (toolName === 'invoke_subagent' && args) {
        const subagentsPayload = args.Subagents || args.subagents || [];
        if (Array.isArray(subagentsPayload)) {
          subagentsPayload.forEach((sa: any) => {
            const saId = Math.random().toString(36).substring(7);
            setSubagentList(prev => [
              {
                id: saId,
                role: sa.Role || sa.role || sa.TypeName || 'subagent',
                typeName: sa.TypeName || sa.typeName,
                status: 'RUNNING',
                prompt: sa.Prompt || sa.prompt,
                logs: [`[${new Date().toLocaleTimeString()}] Subagent launched: ${sa.Role || sa.TypeName}`]
              },
              ...prev
            ]);
          });
        }
      }

      setMessages(prev => [...prev, { role: 'tool', text: `Invoking tool: ${toolName}`, toolName, args }]);
    } else if (innerEvent.type === 'tool_end') {
      setToolProgressMsg('');
      const toolName = innerEvent.toolResult?.name || innerEvent.toolCall?.name || innerEvent.toolName || 'tool';
      const result = innerEvent.toolResult?.result !== undefined ? innerEvent.toolResult.result : innerEvent.result;
      setMessages(prev => [...prev, { role: 'tool', text: `Tool '${toolName}' completed.`, toolName, result }]);
    } else if (innerEvent.type === 'thought' || innerEvent.type === 'reasoning') {
      setLoading(true);
      const chunk = innerEvent.text || innerEvent.content || '';
      if (chunk) {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'thought') {
            const isCumulative = chunk.startsWith(lastMsg.text) && chunk.length > lastMsg.text.length;
            const newText = isCumulative ? chunk : (lastMsg.text + chunk);
            return [...prev.slice(0, -1), { ...lastMsg, text: newText }];
          }
          return [...prev, { role: 'thought', text: chunk }];
        });
      }
    } else if (innerEvent.type === 'message' || innerEvent.type === 'text') {
      setLoading(true);
      const chunk = innerEvent.text || innerEvent.content || '';
      if (chunk) {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            const isCumulative = chunk.startsWith(lastMsg.text) && chunk.length > lastMsg.text.length;
            const newText = isCumulative ? chunk : (lastMsg.text + chunk);
            return [...prev.slice(0, -1), { ...lastMsg, text: newText }];
          }
          return [...prev, { role: 'assistant', text: chunk }];
        });
      }
    } else if (innerEvent.type === 'error') {
      setLoading(false);
      setToolProgressMsg('');
      setMessages(prev => [...prev, { role: 'system', text: `Agent Error: ${innerEvent.message || 'Unknown error'}` }]);
    }
  } else if (payload.type === 'permission_required') {
    if (isAbortedRef.current) return;
    setPendingPermission({ permissionId: payload.permissionId, toolCall: payload.toolCall, description: payload.description });
  } else if (payload.type === 'question_required') {
    if (isAbortedRef.current) return;
    setPendingQuestion({ questionId: payload.questionId, question: payload.question, options: payload.options, isMultiSelect: payload.isMultiSelect });
    setSelectedQuestionAnswers([]);
    setCustomQuestionInput('');
  } else if (payload.type === 'plan_approval_required') {
    if (isAbortedRef.current) return;
    setPendingPlanApproval(payload.planState === 'PLANNING_PENDING');
    setMessages(prev => [...prev, { role: 'system', text: '⭐ Plan approval required! Please review and authorize execution below.' }]);
  } else if (payload.type === 'tool_progress') {
    if (isAbortedRef.current) return;
    setToolProgressMsg(payload.content || payload.message || '');
  } else {
    // Unknown payload type — log warning to help debug missed events
    console.warn('[SuperAgent] Unhandled payload type:', payload.type, payload);
  }
};

