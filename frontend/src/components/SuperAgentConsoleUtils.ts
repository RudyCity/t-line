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

export const extractEventText = (event: any): string => {
  if (!event) return '';
  if (typeof event === 'string') return event;
  if (typeof event.reasoning === 'string' && event.reasoning) return event.reasoning;
  if (typeof event.thought === 'string' && event.thought) return event.thought;
  if (typeof event.thinking === 'string' && event.thinking) return event.thinking;
  if (typeof event.text === 'string' && event.text) return event.text;
  if (typeof event.content === 'string' && event.content) return event.content;
  if (typeof event.delta === 'string' && event.delta) return event.delta;
  if (event.delta && typeof event.delta === 'object') {
    if (typeof event.delta.reasoning === 'string' && event.delta.reasoning) return event.delta.reasoning;
    if (typeof event.delta.thought === 'string' && event.delta.thought) return event.delta.thought;
    if (typeof event.delta.text === 'string' && event.delta.text) return event.delta.text;
    if (typeof event.delta.content === 'string' && event.delta.content) return event.delta.content;
  }
  if (Array.isArray(event.content)) {
    return event.content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.reasoning === 'string') return part.reasoning;
        if (part && typeof part.thought === 'string') return part.thought;
        if (part && typeof part.text === 'string') return part.text;
        if (part && typeof part.content === 'string') return part.content;
        return '';
      })
      .join('');
  }
  if (event.content && typeof event.content === 'object') {
    if (typeof event.content.reasoning === 'string' && event.content.reasoning) return event.content.reasoning;
    if (typeof event.content.thought === 'string' && event.content.thought) return event.content.thought;
    if (typeof event.content.text === 'string' && event.content.text) return event.content.text;
    if (typeof event.content.content === 'string' && event.content.content) return event.content.content;
  }
  if (event.text && typeof event.text === 'object') {
    if (typeof event.text.reasoning === 'string' && event.text.reasoning) return event.text.reasoning;
    if (typeof event.text.thought === 'string' && event.text.thought) return event.text.thought;
    if (typeof event.text.text === 'string' && event.text.text) return event.text.text;
  }
  return '';
};

export const isMatchingSessionId = (a?: string, b?: string): boolean => {
  if (!a || !b) return true;
  if (a === b) return true;
  const cleanA = a.replace(/^(sess_|session_)/, '').split('::').pop() || a;
  const cleanB = b.replace(/^(sess_|session_)/, '').split('::').pop() || b;
  return cleanA === cleanB;
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
  isAbortedRef: React.MutableRefObject<boolean>,
  currentActiveSessionId?: string
) => {
  // Filter out stray background events belonging to a different session using normalized matching
  if (payload.sessionId && currentActiveSessionId && !isMatchingSessionId(payload.sessionId, currentActiveSessionId)) {
    return;
  }
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
      // Connection/lifecycle events (restart, reconnect, auto-start) → show in chat as 'connection' role
      const isConnLifecycle = statusLower.includes('auto-starting superagent') ||
                              statusLower.includes('auto-restart') ||
                              statusLower.includes('restarting superagent') ||
                              statusLower.includes('superagent server') ||
                              statusLower.includes('sse connection') ||
                              statusLower.includes('reconnecting') ||
                              statusLower.includes('unreachable') ||
                              statusLower.includes('respawning') ||
                              statusLower.includes('starting superagent');
      const isQuietNoise = statusLower.includes('websocket') ||
                           statusLower.includes('connected to superagent server') ||
                           statusLower.includes('starting superagent server on port');
      if (isConnLifecycle && !isQuietNoise) {
        setMessages(prev => [...prev, { role: 'connection' as any, text: payload.text }]);
      } else if (!isQuietNoise) {
        setMessages(prev => [...prev, { role: 'system', text: payload.text }]);
      }

    }
  } else if (payload.type === 'agent_event') {
    const innerEvent = payload.event;
    if (!innerEvent) return;

    if (innerEvent.type === 'done' || innerEvent.type === 'goal_done') {
      if (!isAbortedRef.current) {
        setLoading(false);
        setToolProgressMsg('');
      }
      return;
    }

    if (isAbortedRef.current) return;

    const isToolType = innerEvent.type === 'tool_start' || innerEvent.type === 'tool_call' || innerEvent.type === 'tool' || innerEvent.type === 'tool_end' || innerEvent.type === 'tool_result' || innerEvent.type === 'tool_use' || innerEvent.type === 'tool_output';

    if (isToolType) {
      setLoading(true);
      const toolName = 
        innerEvent.toolCall?.name || 
        innerEvent.toolCall?.toolName || 
        innerEvent.toolResult?.name ||
        innerEvent.toolName || 
        innerEvent.name || 
        innerEvent.tool || 
        innerEvent.fn || 
        innerEvent.function?.name || 
        'tool';

      let args = innerEvent.toolCall?.args || innerEvent.toolResult?.args || innerEvent.args || innerEvent.arguments || innerEvent.function?.arguments;
      if (typeof args === 'string') {
        try { args = JSON.parse(args); } catch (e) {}
      }

      let result: any = undefined;
      const rawTR = innerEvent.toolResult || (Array.isArray(innerEvent.toolResults) ? innerEvent.toolResults[0] : (Array.isArray(innerEvent.tool_results) ? innerEvent.tool_results[0] : undefined));
      if (rawTR !== undefined) {
        if (typeof rawTR === 'object' && rawTR !== null) {
          result = rawTR.result !== undefined 
            ? rawTR.result 
            : rawTR.output !== undefined 
            ? rawTR.output 
            : rawTR.content !== undefined 
            ? rawTR.content 
            : rawTR;
        } else {
          result = rawTR;
        }
      }
      if (result === undefined) {
        result = 
          innerEvent.result !== undefined ? innerEvent.result : 
          innerEvent.output !== undefined ? innerEvent.output : 
          innerEvent.toolOutput !== undefined ? innerEvent.toolOutput :
          innerEvent.content !== undefined ? innerEvent.content :
          innerEvent.data;
      }

      const callId = 
        rawTR?.toolCallId || 
        rawTR?.id || 
        innerEvent.toolCall?.id || 
        innerEvent.callId || 
        innerEvent.id || 
        innerEvent.tool_call_id;

      if (innerEvent.type === 'tool_end' || innerEvent.type === 'tool_result' || innerEvent.type === 'tool_output' || result !== undefined) {
        setToolProgressMsg('');
      }

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
      setMessages(prev => {
        let idx = -1;
        // Priority 1: match exact callId if available
        if (callId) {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i] && prev[i].role === 'tool' && prev[i].callId === callId) {
              idx = i;
              break;
            }
          }
        }
        // Priority 2: fallback match last tool item without result if toolName matches or is generic.
        // Skip Priority 2 fallback for start events (tool_start, tool_call, tool_use) so new tool invocations never overwrite prior tools.
        const isStartEvent = innerEvent.type === 'tool_start' || innerEvent.type === 'tool_call' || innerEvent.type === 'tool_use';
        if (idx === -1 && !isStartEvent) {
          for (let i = prev.length - 1; i >= 0; i--) {
            const m = prev[i];
            if (m && m.role === 'tool' && m.result === undefined) {
              const matchesName = toolName !== 'tool' && m.toolName ? (m.toolName === toolName || m.toolName === 'tool') : true;
              if (matchesName) {
                idx = i;
                break;
              }
            }
          }
        }

        const hasNewArgs = args && (typeof args === 'string' ? args.trim().length > 0 : Object.keys(args).length > 0);

        if (idx !== -1) {
          const updated = [...prev];
          const resolvedName = (toolName && toolName !== 'tool') ? toolName : (updated[idx].toolName || toolName);
          const mergedResult = result !== undefined ? result : updated[idx].result;
          updated[idx] = {
            ...updated[idx],
            toolName: resolvedName,
            text: mergedResult !== undefined ? `Tool '${resolvedName}' completed.` : updated[idx].text,
            args: hasNewArgs ? args : updated[idx].args,
            result: mergedResult,
            callId: callId || updated[idx].callId
          };
          return updated;
        }

        const resolvedName = toolName || 'tool';
        const text = result !== undefined ? `Tool '${resolvedName}' completed.` : `Invoking tool: ${resolvedName}`;
        return [...prev, { role: 'tool', text, toolName: resolvedName, args: args || {}, result, callId }];
      });
    } else if (
      innerEvent.type === 'thought' ||
      innerEvent.type === 'reasoning' ||
      innerEvent.type === 'thinking' ||
      innerEvent.type === 'reasoning_content' ||
      innerEvent.type === 'thought_delta' ||
      innerEvent.type === 'reasoning_delta' ||
      innerEvent.target === 'reasoning' ||
      innerEvent.target === 'thought' ||
      Boolean(innerEvent.reasoning) ||
      Boolean(innerEvent.thought) ||
      Boolean(innerEvent.thinking)
    ) {
      setLoading(true);
      const chunk = extractEventText(innerEvent);
      if (chunk) {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'thought') {
            const isCumulative = typeof chunk === 'string' && typeof lastMsg.text === 'string' && chunk.startsWith(lastMsg.text) && chunk.length > lastMsg.text.length;
            const newText = isCumulative ? chunk : (lastMsg.text + chunk);
            return [...prev.slice(0, -1), { ...lastMsg, text: newText }];
          }
          return [...prev, { role: 'thought', text: chunk }];
        });
      }
    } else if (innerEvent.type === 'message' || innerEvent.type === 'text') {
      setLoading(true);
      const chunk = extractEventText(innerEvent);
      if (chunk) {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            const isCumulative = typeof chunk === 'string' && typeof lastMsg.text === 'string' && chunk.startsWith(lastMsg.text) && chunk.length > lastMsg.text.length;
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
  } else if (payload.type === 'subagents_update') {
    if (Array.isArray(payload.subagents)) {
      setSubagentList(prev => {
        const merged = [...prev];
        payload.subagents.forEach((sa: any) => {
          const idx = merged.findIndex(m => m.id === sa.id);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...sa };
          } else {
            merged.push({
              id: sa.id,
              typeName: sa.typeName,
              role: sa.role || sa.typeName,
              status: sa.status || 'RUNNING',
              result: sa.result,
              logs: sa.logs || [],
              prompt: sa.prompt,
              completedAt: sa.completedAt
            });
          }
        });
        return merged;
      });
    }
  } else {
    // Unknown payload type — log warning to help debug missed events
    console.warn('[SuperAgent] Unhandled payload type:', payload.type, payload);
  }
};

export const cleanSessionTitle = (title: string): string => {
  if (!title) return 'New Chat';
  let t = title.trim();

  // Remove XML-like tags
  t = t.replace(/<[^>]+>/g, '');

  // Strip [Last: ...] or [First: ...] headers
  t = t.replace(/^.*?\[Last:\s*/gi, '');
  t = t.replace(/^\[First:.*?\]\s*(→|->)?\s*/gi, '');

  // Remove memory/system bracketed tags
  t = t.replace(/(?:-\s*)?\[(?:memory|sys|system|context|rmemory|tencentdb|emergency)[^\]]*\]/gi, '');

  // Remove CLI prompt headers, role prefixes
  t = t.replace(/^(PS\s+)?[a-zA-Z]:\\[^>\n]+>\s*/gi, '');
  t = t.replace(/^PS\s+[a-zA-Z]:\\[^\s]+\s*(➔|->)?\s*/gi, '');
  t = t.replace(/^(User|Assistant|System):\s*/gi, '');

  // Remove leading slash commands
  t = t.replace(/^(\/[a-zA-Z0-9_-]+\s*)+/gi, '');

  // Clean leading/trailing hyphens, colons, pipes, dots, brackets, and whitespace
  t = t.replace(/^[\[\]\s\-:_|→>]+/, '');
  t = t.replace(/[\[\]\s\-:_|]+$/, '');

  // Convert raw path keys (e.g. D__backup_from_pc_asus...) into clean workspace names
  if (/^[a-zA-Z]:?__/i.test(t) || t.includes('__Documents_Development_')) {
    const parts = t.split('_').filter(p => p && !/^(d|backup|from|pc|asus|documents|development)$/i.test(p) && !/^\d+$/.test(p));
    t = parts.join('-') || 'Workspace Session';
  }

  // Deduplicate trailing fragments separated by ' - '
  if (t.includes(' - ')) {
    const parts = t.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const [first, second] = parts;
      if (second && (first.toLowerCase().includes(second.toLowerCase()) || second.length <= 3 || /^[a-z0-9]$/i.test(second))) {
        t = first;
      } else if (first) {
        t = first;
      }
    }
  }

  t = t.replace(/\s{2,}/g, ' ').trim();
  if (!t || t.toLowerCase() === 'new chat') return 'New Chat';
  return t;
};

