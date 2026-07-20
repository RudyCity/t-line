import { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, RefreshCw, Shield, Square, Folder, Sparkles, Activity, Settings } from 'lucide-react';
import { getRuntimeSearchParams } from '../utils/runtimeQuery';
import { WorkspaceInfo } from '../hooks/useTerminals';
import { SuperAgentAuditLogs } from './SuperAgentAuditLogs';
import { PermissionCard, QuestionCard, PlanCard, PendingPermission, PendingQuestion } from './SuperAgentInteractiveCards';
import { getSlashCommands, SlashCommand } from './SuperAgentCommands';
import { SuperAgentSidebar, RecentChangeItem, ProcessItem } from './SuperAgentSidebar';
import { SubAgentTerminalModal, SubAgentItem } from './SubAgentTerminalModal';
import { SuperAgentInputContainer } from './SuperAgentInputContainer';
import { SuperAgentSettingsMenu } from './SuperAgentSettingsMenu';
import { SuperAgentMessageItem } from './SuperAgentMessageItem';

interface SuperAgentConsoleProps {
  activeWorkspacePath?: string;
  workspaces?: WorkspaceInfo[];
  onOpenSettings?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export function SuperAgentConsole({ activeWorkspacePath, workspaces = [], onOpenSettings, onLoadingChange }: SuperAgentConsoleProps) {
  // Workspace & Config state
  const [workspace, setWorkspace] = useState(() => activeWorkspacePath || localStorage.getItem('currentWorkspace') || '');
  const prevWorkspaceRef = useRef(workspace);

  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
    text: string;
    toolName?: string;
    args?: any;
    result?: any;
  }>>(() => {
    try {
      const initWs = activeWorkspacePath || localStorage.getItem('currentWorkspace') || '';
      const key = `superagent_messages_${initWs || 'default'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load persisted superagent messages:', e);
    }
    return [
      { role: 'system', text: 'SuperAgent ready. Connected to t-line workspace context.' }
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [activeTab, setActiveTab] = useState<'console' | 'audit'>('console');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [agentMode, setAgentMode] = useState<'single' | 'multi'>('single');
  const [customArgs, setCustomArgs] = useState('');
  const [connectTrigger, setConnectTrigger] = useState(0);
  const isAbortedRef = useRef<boolean>(false);

  // Persist messages whenever they change
  useEffect(() => {
    if (messages && messages.length > 0) {
      try {
        const key = `superagent_messages_${workspace || 'default'}`;
        localStorage.setItem(key, JSON.stringify(messages.slice(-300)));
      } catch (e) {
        console.error('Failed to persist superagent messages:', e);
      }
    }
  }, [messages, workspace]);

  // Notify parent of AI agent loading state
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Sync workspace prop and load messages when workspace changes
  useEffect(() => {
    if (activeWorkspacePath && activeWorkspacePath !== workspace) {
      setWorkspace(activeWorkspacePath);
    }
  }, [activeWorkspacePath]);

  useEffect(() => {
    if (prevWorkspaceRef.current !== workspace) {
      prevWorkspaceRef.current = workspace;
      try {
        const key = `superagent_messages_${workspace || 'default'}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            return;
          }
        }
      } catch (e) {}
      setMessages([
        { role: 'system', text: `SuperAgent ready. Workspace: ${workspace || 'Default'}` }
      ]);
    }
  }, [workspace]);

  interface ModelPreset {
    id: string;
    name: string;
    description: string;
    models: Record<string, { providerProfileId: string; model: string } | string | any>;
  }

  const [presets, setPresets] = useState<{ single: ModelPreset[]; multi: ModelPreset[] }>({ single: [], multi: [] });
  const [activePresetId, setActivePresetId] = useState<{ single: string; multi: string }>({ single: '', multi: '' });

  // Sidebar Monitor & Subagent Terminal states
  const [subagentList, setSubagentList] = useState<SubAgentItem[]>([]);
  const [procList] = useState<ProcessItem[]>([]);
  const [recentChangeList, setRecentChangeList] = useState<RecentChangeItem[]>([]);
  const [selectedSubagent, setSelectedSubagent] = useState<SubAgentItem | null>(null);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [isLoadingMonitor, setIsLoadingMonitor] = useState<boolean>(false);

  const fetchMonitorData = async () => {
    if (!workspace) return;
    setIsLoadingMonitor(true);
    try {
      const workspaceId = btoa(workspace);
      const gitRes = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/git/status`, {
        headers: getAuthHeader()
      });
      if (gitRes.ok) {
        const changes = await gitRes.json();
        if (Array.isArray(changes)) {
          setRecentChangeList(changes.map((c: any) => ({
            path: typeof c === 'string' ? c : (c.path || c.file || ''),
            type: typeof c === 'string' ? 'modified' : (c.type || c.status || 'modified'),
            staged: c.staged
          })));
        }
      }

      const instRes = await fetch('/api/superagent/instances', {
        headers: getAuthHeader()
      });
      if (instRes.ok) {
        const instData = await instRes.json();
        if (Array.isArray(instData.subagents)) {
          setSubagentList(prev => {
            const merged = [...prev];
            instData.subagents.forEach((sa: any) => {
              const idx = merged.findIndex(m => m.id === sa.id);
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...sa };
              } else {
                merged.push({
                  id: sa.id || Math.random().toString(36).substring(7),
                  typeName: sa.typeName,
                  role: sa.role || sa.typeName,
                  status: sa.status || 'RUNNING',
                  result: sa.result,
                  completedAt: sa.completedAt
                });
              }
            });
            return merged;
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch monitor data:', e);
    } finally {
      setIsLoadingMonitor(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
    const interval = setInterval(fetchMonitorData, 6000);
    return () => clearInterval(interval);
  }, [workspace, connectTrigger]);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/superagent/config', {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setPresets(data.presets || { single: [], multi: [] });
        setActivePresetId(data.activePresetId || { single: '', multi: '' });
      }
    } catch (e) {
      console.error('Failed to fetch SuperAgent model config:', e);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [connectTrigger]);

  const handlePresetChange = async (presetId: string) => {
    try {
      const response = await fetch('/api/superagent/config/active-preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ mode: agentMode, presetId })
      });
      if (response.ok) {
        const data = await response.json();
        setActivePresetId(data.activePresetId);
        const match = (presets[agentMode] || []).find(p => p.id === presetId);
        const name = match ? match.name : presetId;
        setMessages(prev => [...prev, { role: 'system', text: `Model preset changed to "${name}". Restarting bridge...` }]);
        setConnectTrigger(prev => prev + 1);
      }
    } catch (e) {
      console.error('Failed to change preset:', e);
    }
  };

  const getMainModelLabel = (preset: ModelPreset | undefined) => {
    if (!preset?.models) return 'Unknown';
    const m = preset.models;
    if (agentMode === 'multi' && m.master) return typeof m.master === 'object' ? m.master.model : m.master;
    if (m.superagent) return typeof m.superagent === 'object' ? m.superagent.model : m.superagent;
    if (m.MODEL) return typeof m.MODEL === 'object' ? (m.MODEL as any).model : m.MODEL;
    if (m.MODEL_SINGLE) return typeof m.MODEL_SINGLE === 'object' ? (m.MODEL_SINGLE as any).model : m.MODEL_SINGLE;
    return 'Default';
  };

  // Interactive agent states
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [selectedQuestionAnswers, setSelectedQuestionAnswers] = useState<string[]>([]);
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [pendingPlanApproval, setPendingPlanApproval] = useState<boolean>(false);
  const [toolProgressMsg, setToolProgressMsg] = useState<string>('');

  // Enhanced Input States
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('superagent_prompt_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const consoleContainerRef = useRef<HTMLDivElement>(null);

  // Attachment States & Helpers
  const [attachments, setAttachments] = useState<Array<{
    id: string;
    file: File;
    type: 'image' | 'document';
    previewUrl?: string;
  }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => {
      const isImage = file.type.startsWith('image/');
      return {
        id: Math.random().toString(36).substring(7),
        file,
        type: isImage ? ('image' as const) : ('document' as const),
        previewUrl: isImage ? URL.createObjectURL(file) : undefined
      };
    });
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const target = prev.find(att => att.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(att => att.id !== id);
    });
  };

  const readFileAsText = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsText(file);
  });

  const readFileAsDataURL = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(file);
  });

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (consoleContainerRef.current && !consoleContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Automatically update workspace when activeWorkspacePath prop changes
  useEffect(() => {
    if (activeWorkspacePath && activeWorkspacePath !== workspace) {
      setWorkspace(activeWorkspacePath);
      localStorage.setItem('currentWorkspace', activeWorkspacePath);
      setConnectTrigger(prev => prev + 1);
    }
  }, [activeWorkspacePath]);

  const getAuthHeader = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const params = getRuntimeSearchParams();
    const isWinPort = params.get('port') || window.location.port || '8080';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    let host = window.location.host;
    if (host.endsWith(':5773')) {
      host = host.slice(0, -5) + ':5779';
    } else if (isWinPort && isWinPort !== window.location.port) {
      host = `${window.location.hostname}:${isWinPort}`;
    }

    const token = localStorage.getItem('token') || '';
    const wsUrl = `${protocol}//${host}/api/superagent?workspace=${encodeURIComponent(workspace)}&agentMode=${agentMode}&customArgs=${encodeURIComponent(customArgs)}&token=${encodeURIComponent(token)}`;

    console.log('[SuperAgent] Connecting to bridge:', wsUrl);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setMessages(prev => {
        const connText = `WebSocket connection established. Workspace: ${workspace || 'Default'}`;
        const last = prev[prev.length - 1];
        if (last && last.text === connText) return prev;
        return [...prev, { role: 'system', text: connText }];
      });
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        if (payload.type === 'chat_response') {
          if (payload.result && payload.result.error) {
            setLoading(false);
            setToolProgressMsg('');
            setMessages(prev => [...prev, { role: 'system', text: `Error: ${payload.result.error}` }]);
          }
        } else if (payload.type === 'status') {
          if (typeof payload.text === 'string' && payload.text.toLowerCase().includes('aborted')) {
            isAbortedRef.current = false;
            setLoading(false);
            setToolProgressMsg('');
          }
          setMessages(prev => [...prev, { role: 'system', text: payload.text }]);
        } else if (payload.type === 'agent_event') {
          const innerEvent = payload.event;
          if (innerEvent.type === 'done' || innerEvent.type === 'goal_done') {
            isAbortedRef.current = false;
            setLoading(false);
            setToolProgressMsg('');
            return;
          }

          if (isAbortedRef.current) {
            return;
          }

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

            setMessages(prev => [...prev, { 
              role: 'tool', 
              text: `Invoking tool: ${toolName}`,
              toolName,
              args
            }]);
          } else if (innerEvent.type === 'tool_end') {
            setToolProgressMsg('');
            const toolName = innerEvent.toolResult?.name || innerEvent.toolCall?.name || innerEvent.toolName || 'tool';
            const result = innerEvent.toolResult?.result !== undefined ? innerEvent.toolResult.result : innerEvent.result;
            setMessages(prev => [...prev, { 
              role: 'tool', 
              text: `Tool '${toolName}' completed.`,
              toolName,
              result
            }]);
          } else if (innerEvent.type === 'thought' || innerEvent.type === 'reasoning') {
            setLoading(true);
            const chunk = innerEvent.text || innerEvent.content || '';
            if (chunk) {
              setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'thought') {
                  const newText = chunk.startsWith(lastMsg.text) ? chunk : (lastMsg.text + chunk);
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
                  const newText = chunk.startsWith(lastMsg.text) ? chunk : (lastMsg.text + chunk);
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
          setPendingPermission({
            permissionId: payload.permissionId,
            toolCall: payload.toolCall,
            description: payload.description
          });
        } else if (payload.type === 'question_required') {
          setPendingQuestion({
            questionId: payload.questionId,
            question: payload.question,
            options: payload.options,
            isMultiSelect: payload.isMultiSelect
          });
          setSelectedQuestionAnswers([]);
          setCustomQuestionInput('');
        } else if (payload.type === 'plan_approval_required') {
          setPendingPlanApproval(payload.planState === 'PLANNING_PENDING');
          setMessages(prev => [...prev, { role: 'system', text: '⭐ Plan approval required! Please review and authorize execution below.' }]);
        } else if (payload.type === 'tool_progress') {
          setToolProgressMsg(payload.content || payload.message || '');
        }
      } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', text: event.data }]);
        setLoading(false);
      }
    };

    socket.onclose = () => {
      setMessages(prev => [...prev, { role: 'system', text: 'SuperAgent WebSocket connection closed.' }]);
      setLoading(false);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [connectTrigger]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingPermission, pendingQuestion, pendingPlanApproval, toolProgressMsg, loading]);

  async function handleSend(customPrompt?: string) {
    const prompt = (customPrompt !== undefined ? customPrompt : input).trim();
    if (!prompt && attachments.length === 0) return;

    if (prompt === '/abort') {
      setInput('');
      handleAbort();
      return;
    }

    isAbortedRef.current = false;

    // Check if it's a slash command first!
    if (prompt.startsWith('/')) {
      const parts = prompt.split(/\s+/);
      const cmdName = parts[0];
      const cmdArgs = prompt.slice(cmdName.length).trim();
      const match = slashCommands.find(c => c.command.toLowerCase() === cmdName.toLowerCase());
      if (match) {
        setInput('');
        setAttachments([]);
        if (match.action) {
          match.action(cmdArgs);
        }
        return;
      }
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setInput('');
    setLoading(true);
    setToolProgressMsg('Reading attachments...');

    let finalPrompt = prompt;

    // Process attachments
    if (attachments.length > 0) {
      const documentParts: string[] = [];
      const imageParts: string[] = [];

      for (const att of attachments) {
        try {
          if (att.type === 'document') {
            const content = await readFileAsText(att.file);
            documentParts.push(`\n--- ATTACHED FILE: ${att.file.name} ---\n${content}\n---------------------------------\n`);
          } else if (att.type === 'image') {
            const base64 = await readFileAsDataURL(att.file);
            imageParts.push(`\n--- ATTACHED IMAGE: ${att.file.name} ---\nData URL: ${base64}\n----------------------------------\n`);
          }
        } catch (err) {
          console.error('Failed to read file:', att.file.name, err);
        }
      }

      if (documentParts.length > 0) {
        finalPrompt += '\n\n[Attached Files]:' + documentParts.join('');
      }
      if (imageParts.length > 0) {
        finalPrompt += '\n\n[Attached Images]:' + imageParts.join('');
      }
    }

    // Clean up previews
    attachments.forEach(att => {
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    });
    setAttachments([]);

    setToolProgressMsg('');
    setMessages(prev => [...prev, { role: 'user', text: prompt || `Sent ${attachments.length} attachment(s)` }]);

    // Save to history
    if (prompt && !history.includes(prompt)) {
      const newHistory = [prompt, ...history].slice(0, 50);
      setHistory(newHistory);
      localStorage.setItem('superagent_prompt_history', JSON.stringify(newHistory));
    }
    setHistoryIndex(-1);

    ws.send(JSON.stringify({
      type: 'prompt',
      text: finalPrompt
    }));
  };

  const slashCommands = getSlashCommands({
    ws,
    workspace,
    agentMode,
    customArgs,
    setMessages,
    setAgentMode,
    setCustomArgs,
    setWorkspace,
    setConnectTrigger,
    handleSend,
    handleAbort
  });

  // Monitor input to show/hide suggestions
  useEffect(() => {
    if (input.startsWith('/') && !input.includes(' ')) {
      const query = input.slice(1).toLowerCase();
      const filtered = slashCommands.filter(c => c.command.slice(1).toLowerCase().startsWith(query));
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [input]);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev + 1) % suggestions.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSuggestion(suggestions[suggestionIndex]);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    } else if (e.key === 'ArrowUp') {
      const selectionStart = e.currentTarget.selectionStart;
      if (selectionStart === 0 && history.length > 0) {
        e.preventDefault();
        const nextIndex = historyIndex + 1;
        if (nextIndex < history.length) {
          setHistoryIndex(nextIndex);
          setInput(history[nextIndex]);
        }
      }
    } else if (e.key === 'ArrowDown') {
      const selectionEnd = e.currentTarget.selectionEnd;
      if (selectionEnd === e.currentTarget.value.length) {
        e.preventDefault();
        const nextIndex = historyIndex - 1;
        if (nextIndex >= 0) {
          setHistoryIndex(nextIndex);
          setInput(history[nextIndex]);
        } else {
          setHistoryIndex(-1);
          setInput('');
        }
      }
    } else if (e.key === 'Escape') {
      setInput('');
      setHistoryIndex(-1);
    }
  };

  const handleSelectSuggestion = (s: SlashCommand) => {
    if (s.argsHelp) {
      setInput(s.command + ' ');
    } else {
      setInput(s.command);
      const immediateCommands = ['/help', '/status', '/abort', '/clear', '/reset', '/explain', '/test'];
      if (immediateCommands.includes(s.command)) {
        handleSend(s.command);
      }
    }
    setShowSuggestions(false);
  };

  function handleAbort() {
    isAbortedRef.current = true;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'abort' }));
    }
    setLoading(false);
    setToolProgressMsg('');
    setPendingPermission(null);
    setPendingQuestion(null);
    setPendingPlanApproval(false);
    setMessages(prev => [...prev, { role: 'system', text: '⏹️ Agent execution stopped by user.' }]);
  };

  const handlePermissionDecision = (approval: boolean | 'session') => {
    if (!pendingPermission || !ws) return;
    ws.send(JSON.stringify({
      type: 'approve_permission',
      permissionId: pendingPermission.permissionId,
      approval
    }));
    setPendingPermission(null);
  };

  const handleQuestionSubmit = () => {
    if (!pendingQuestion || !ws) return;
    const answer = pendingQuestion.options && pendingQuestion.options.length > 0
      ? (pendingQuestion.isMultiSelect ? selectedQuestionAnswers : (selectedQuestionAnswers[0] || customQuestionInput))
      : customQuestionInput;

    ws.send(JSON.stringify({
      type: 'answer_question',
      questionId: pendingQuestion.questionId,
      answer
    }));
    setPendingQuestion(null);
    setSelectedQuestionAnswers([]);
    setCustomQuestionInput('');
  };

  const handlePlanApproval = (action: 'approve' | 'reject') => {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: 'approve_plan',
      action
    }));
    setPendingPlanApproval(false);
  };





  return (
    <div className="flex flex-col h-full w-full bg-[#05070c] text-gray-200 overflow-hidden font-sans">
      <div className="grid grid-cols-3 items-center px-4 py-2.5 bg-[#090c14] border-b border-zinc-800/80 min-h-[48px] w-full shadow-sm">
        {/* Left Column */}
        <div className="flex items-center gap-2 min-w-0">
          <TerminalIcon className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-semibold text-xs tracking-wide shrink-0">SuperAgent Panel</span>
          {workspace && (
            <span className="bg-indigo-950/70 text-indigo-300 text-[10px] px-2 py-0.5 rounded-md border border-indigo-800/60 font-mono truncate hidden sm:flex items-center gap-1">
              <Folder className="w-2.5 h-2.5 text-indigo-400" />
              {workspace.split(/[/\\]/).pop()}
            </span>
          )}
        </div>

        {/* Center Column - Centered Tab Selectors */}
        <div className="flex justify-center">
          <div className="flex bg-[#121622] rounded-lg p-0.5 border border-zinc-800/80">
            <button
              onClick={() => setActiveTab('console')}
              className={`sa-tab-pill ${activeTab === 'console' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Console
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`sa-tab-pill flex items-center gap-1.5 ${activeTab === 'audit' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Shield className="w-3.5 h-3.5" />
              Audit Trails
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex justify-end gap-2 items-center relative">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`px-2.5 py-1 text-[11px] rounded-md border transition flex items-center gap-1.5 cursor-pointer font-medium ${
              showSidebar ? 'bg-indigo-950/80 border-indigo-700/80 text-indigo-300 shadow-sm' : 'bg-[#121622] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle Live Monitor Sidebar"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Monitor</span>
          </button>

          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className={`px-2.5 py-1 text-[11px] rounded-md border transition flex items-center gap-1.5 cursor-pointer font-medium ${
              showSettingsMenu ? 'bg-indigo-950/80 border-indigo-700/80 text-indigo-300 shadow-sm' : 'bg-[#121622] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="SuperAgent & App Settings"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Setting</span>
          </button>

          {loading && (
            <button
              onClick={handleAbort}
              className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-medium px-2.5 py-1 rounded-md transition flex items-center gap-1 animate-pulse focus:outline-none focus:ring-2 focus:ring-rose-400"
              title="Stop current agent execution"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              Stop Agent
            </button>
          )}

          <SuperAgentSettingsMenu
            isOpen={showSettingsMenu}
            onClose={() => setShowSettingsMenu(false)}
            workspaces={workspaces}
            workspace={workspace}
            setWorkspace={setWorkspace}
            agentMode={agentMode}
            setAgentMode={setAgentMode}
            customArgs={customArgs}
            setCustomArgs={setCustomArgs}
            setConnectTrigger={setConnectTrigger}
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            onRefreshMonitor={fetchMonitorData}
            isLoadingMonitor={isLoadingMonitor}
            onClearConsole={() => setMessages([{ role: 'system', text: 'Console output cleared.' }])}
            onOpenGlobalSettings={onOpenSettings}
          />
        </div>
      </div>

      {activeTab === 'console' ? (
        <div className="flex-1 flex overflow-hidden relative w-full">
          <div className="flex-1 flex flex-col h-full overflow-hidden w-full min-w-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs leading-relaxed w-full">
            {messages.map((msg, index) => (
              <SuperAgentMessageItem key={index} msg={msg} index={index} />
            ))}

            {/* Live Progress Tool Message */}
            {toolProgressMsg && (
              <div className="p-2 rounded bg-amber-950/30 border border-amber-900/50 text-amber-300 font-mono text-xs animate-pulse flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>{toolProgressMsg}</span>
              </div>
            )}

            {/* Interactive Permission Request Card */}
            {pendingPermission && (
              <PermissionCard
                pendingPermission={pendingPermission}
                handlePermissionDecision={handlePermissionDecision}
              />
            )}

            {/* Interactive Question Card */}
            {pendingQuestion && (
              <QuestionCard
                pendingQuestion={pendingQuestion}
                selectedQuestionAnswers={selectedQuestionAnswers}
                setSelectedQuestionAnswers={setSelectedQuestionAnswers}
                customQuestionInput={customQuestionInput}
                setCustomQuestionInput={setCustomQuestionInput}
                handleQuestionSubmit={handleQuestionSubmit}
              />
            )}

            {/* Interactive Plan Approval Card */}
            {pendingPlanApproval && (
              <PlanCard
                pendingPlanApproval={pendingPlanApproval}
                handlePlanApproval={handlePlanApproval}
              />
            )}

            {/* Simple Thinking Indicator */}
            {loading && (
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-sans pl-1 py-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>SuperAgent is thinking...</span>
                <span className="flex gap-0.5 items-center">
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

            {/* Slash Command Autocomplete Popover */}
            {showSuggestions && (
              <div className="absolute bottom-[calc(100%-8px)] left-4 right-4 bg-[#16161a] border-2 border-indigo-500/80 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto font-mono text-xs divide-y divide-zinc-800">
                <div className="px-3 py-2 bg-[#121214] border-b border-zinc-800 text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center justify-between select-none">
                  <span>SuperAgent Commands</span>
                  <span className="text-zinc-500 font-normal normal-case font-sans">↑↓ Navigate • Tab/Enter Select • Esc Close</span>
                </div>
                {suggestions.map((s, idx) => (
                  <div
                    key={s.command}
                    onClick={() => handleSelectSuggestion(s)}
                    onMouseEnter={() => setSuggestionIndex(idx)}
                    className={`px-4 py-2 cursor-pointer transition flex items-center justify-between ${
                      idx === suggestionIndex ? 'bg-indigo-600/30 text-white border-l-4 border-indigo-500 pl-3' : 'text-zinc-300 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-indigo-300">{s.command}</span>
                      {s.argsHelp && <span className="text-zinc-500 text-[10px]">{s.argsHelp}</span>}
                    </div>
                    <span className="text-zinc-400 text-[11px] truncate max-w-xs">{s.description}</span>
                  </div>
                ))}
              </div>
            )}

            <SuperAgentInputContainer
              input={input}
              setInput={setInput}
              handleKeyDown={handleKeyDown}
              handleSend={handleSend}
              handleAbort={handleAbort}
              loading={loading}
              ws={ws}
              attachments={attachments}
              removeAttachment={removeAttachment}
              fileInputRef={fileInputRef}
              handleFileChange={handleFileChange}
              textareaRef={textareaRef}
              consoleContainerRef={consoleContainerRef}
              presets={presets}
              activePresetId={activePresetId}
              agentMode={agentMode}
              handlePresetChange={handlePresetChange}
              getMainModelLabel={getMainModelLabel}
            />
          </div>

          {/* Live Right Sidebar */}
          {showSidebar && (
            <SuperAgentSidebar
              workspacePath={workspace}
              getAuthHeader={getAuthHeader}
              subagents={subagentList}
              procs={procList}
              recentChanges={recentChangeList}
              onSelectSubAgent={(sa) => setSelectedSubagent(sa)}
              onRefreshData={fetchMonitorData}
              isLoadingData={isLoadingMonitor}
            />
          )}
        </div>
      ) : (
        <SuperAgentAuditLogs getAuthHeader={getAuthHeader} />
      )}

      {/* Subagent Live Terminal Output Modal */}
      {selectedSubagent && (
        <SubAgentTerminalModal
          subagent={selectedSubagent}
          onClose={() => setSelectedSubagent(null)}
        />
      )}
    </div>
  );
}
