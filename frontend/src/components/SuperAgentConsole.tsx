import { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Send, RefreshCw, Shield, Square, X, Folder, Sparkles, Paperclip, ChevronUp } from 'lucide-react';
import { getRuntimeSearchParams } from '../utils/runtimeQuery';
import { WorkspaceInfo } from '../hooks/useTerminals';
import { SuperAgentAuditLogs } from './SuperAgentAuditLogs';
import { SuperAgentConsoleHeader } from './SuperAgentConsoleHeader';
import { PermissionCard, QuestionCard, PlanCard, PendingPermission, PendingQuestion } from './SuperAgentInteractiveCards';
import { getSlashCommands, SlashCommand } from './SuperAgentCommands';







interface SuperAgentConsoleProps {
  activeWorkspacePath?: string;
  workspaces?: WorkspaceInfo[];
}

export function SuperAgentConsole({ activeWorkspacePath, workspaces = [] }: SuperAgentConsoleProps) {
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
    text: string;
    toolName?: string;
    args?: any;
    result?: any;
  }>>([
    { role: 'system', text: 'SuperAgent ready. Connected to t-line workspace context.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [activeTab, setActiveTab] = useState<'console' | 'audit'>('console');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Workspace & Config state
  const [workspace, setWorkspace] = useState(() => activeWorkspacePath || localStorage.getItem('currentWorkspace') || '');
  const [agentMode, setAgentMode] = useState<'single' | 'multi'>('single');
  const [customArgs, setCustomArgs] = useState('');
  const [connectTrigger, setConnectTrigger] = useState(0);

  interface ModelPreset {
    id: string;
    name: string;
    description: string;
    models: Record<string, { providerProfileId: string; model: string } | string | any>;
  }

  const [presets, setPresets] = useState<{ single: ModelPreset[]; multi: ModelPreset[] }>({ single: [], multi: [] });
  const [activePresetId, setActivePresetId] = useState<{ single: string; multi: string }>({ single: '', multi: '' });
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);

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
    if (!preset || !preset.models) return 'Unknown';
    const models = preset.models;
    
    if (agentMode === 'multi' && models.master) {
      if (typeof models.master === 'object' && models.master.model) {
        return models.master.model;
      }
      if (typeof models.master === 'string') {
        return models.master;
      }
    }
    
    if (models.superagent) {
      if (typeof models.superagent === 'object' && models.superagent.model) {
        return models.superagent.model;
      }
      if (typeof models.superagent === 'string') {
        return models.superagent;
      }
    }
    
    if (models.MODEL) return typeof models.MODEL === 'object' ? (models.MODEL as any).model : models.MODEL;
    if (models.MODEL_SINGLE) return typeof models.MODEL_SINGLE === 'object' ? (models.MODEL_SINGLE as any).model : models.MODEL_SINGLE;

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

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // Close suggestions and preset menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (consoleContainerRef.current && !consoleContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setShowPresetMenu(false);
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
      setMessages(prev => [...prev, { role: 'system', text: `WebSocket connection established. Workspace: ${workspace || 'Default'}` }]);
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
          setMessages(prev => [...prev, { role: 'system', text: payload.text }]);
        } else if (payload.type === 'agent_event') {
          const innerEvent = payload.event;
          if (innerEvent.type === 'tool_start') {
            setLoading(true);
            const toolName = innerEvent.toolCall?.name || innerEvent.toolCall?.toolName || innerEvent.toolName || innerEvent.name || 'tool';
            const args = innerEvent.toolCall?.args || innerEvent.args;
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
          } else if (innerEvent.type === 'done' || innerEvent.type === 'goal_done') {
            setLoading(false);
            setToolProgressMsg('');
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
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'abort' }));
    setLoading(false);
    setToolProgressMsg('');
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
    <div className="flex flex-col h-full bg-[#1e1e24] text-gray-200">
      <div className="flex items-center justify-between px-4 py-3 bg-[#121214] border-b border-[#2d2d34]">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-sm tracking-wide">SuperAgent Panel</span>
          {workspace && (
            <span className="bg-indigo-950 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-900/60 font-mono truncate max-w-xs flex items-center gap-1">
              <Folder className="w-3 h-3 text-indigo-400" />
              {workspace.split(/[/\\]/).pop()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-3 py-1 text-xs rounded transition ${activeTab === 'console' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Console
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1 text-xs rounded transition flex items-center gap-1.5 ${activeTab === 'audit' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Shield className="w-3.5 h-3.5" />
              Audit Trails
            </button>
          </div>
          {loading && (
            <button
              onClick={handleAbort}
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded transition flex items-center gap-1 animate-pulse"
              title="Stop current agent execution"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop Agent
            </button>
          )}
        </div>
      </div>

      <SuperAgentConsoleHeader
        workspaces={workspaces}
        workspace={workspace}
        setWorkspace={setWorkspace}
        agentMode={agentMode}
        setAgentMode={setAgentMode}
        customArgs={customArgs}
        setCustomArgs={setCustomArgs}
        setConnectTrigger={setConnectTrigger}
      />

      {activeTab === 'console' ? (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm leading-relaxed">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-indigo-950/40 border-indigo-900/60 ml-auto text-indigo-200'
                    : msg.role === 'system'
                    ? 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 text-xs text-center mx-auto w-full'
                    : msg.role === 'tool'
                    ? 'bg-amber-950/20 border-amber-900/40 mr-auto text-amber-200 font-mono text-xs w-[90%]'
                    : msg.role === 'thought'
                    ? 'bg-slate-900/80 border-slate-800/80 mr-auto text-slate-400 text-xs italic border-l-4 border-l-slate-500 pl-4 w-[90%]'
                    : 'bg-zinc-900/80 border-zinc-800/80 mr-auto text-gray-300'
                }`}
              >
                {msg.role !== 'system' && (
                  <span className={`block text-[10px] uppercase tracking-wider mb-1 font-bold opacity-60 ${
                    msg.role === 'tool' ? 'text-amber-400' : msg.role === 'thought' ? 'text-slate-400' : ''
                  }`}>
                    {msg.role} {msg.toolName ? `(${msg.toolName})` : ''}
                  </span>
                )}
                <div className="whitespace-pre-wrap">{msg.text}</div>
                {msg.args && (
                  <pre className="mt-2 p-1.5 bg-black/40 rounded border border-amber-900/20 text-[10px] text-amber-300 overflow-x-auto">
                    {JSON.stringify(msg.args, null, 2)}
                  </pre>
                )}
                {msg.result && (
                  <pre className="mt-2 p-1.5 bg-black/40 rounded border border-amber-900/20 text-[10px] text-zinc-400 overflow-x-auto max-h-40 overflow-y-auto">
                    {typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result, null, 2)}
                  </pre>
                )}
              </div>
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

          <div ref={consoleContainerRef} className="p-4 bg-[#121214] border-t border-[#2d2d34] flex flex-col gap-1.5 relative">
            {/* Hidden Input Elements */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              multiple
            />

            {/* Attachment Previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1 py-1 max-h-32 overflow-y-auto mb-1 scrollbar-thin">
                {attachments.map(att => (
                  <div
                    key={att.id}
                    className="relative group flex items-center gap-2 p-1.5 bg-[#16161a] border border-[#2d2d34] rounded-lg shadow-sm max-w-xs transition hover:border-zinc-700"
                  >
                    {att.type === 'image' && att.previewUrl ? (
                      <img
                        src={att.previewUrl}
                        alt={att.file.name}
                        className="w-8 h-8 rounded object-cover border border-zinc-800"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center text-zinc-400">
                        <Paperclip className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 pr-6">
                      <span className="text-[11px] text-zinc-300 font-medium truncate font-sans w-24">
                        {att.file.name}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {(att.file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="absolute top-0.5 right-0.5 bg-red-950/80 border border-red-900/50 hover:bg-red-900 text-red-200 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

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

            <div className="flex bg-[#161619] border border-[#2b2b33] focus-within:border-[#4f46e5]/50 rounded-xl p-1.5 items-end gap-1.5 transition-all shadow-inner">
              {/* Attachment Actions */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
                className="p-2 text-zinc-400 hover:text-zinc-200 transition rounded-lg hover:bg-zinc-800/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Attach Files"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={ws?.readyState === WebSocket.OPEN ? "Ask SuperAgent to perform tasks or type / to execute commands..." : "Connecting to SuperAgent bridge..."}
                className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm placeholder-zinc-500 font-sans py-1.5 px-1 resize-none overflow-y-auto max-h-[240px] leading-relaxed outline-none"
                rows={1}
                disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
                style={{ height: 'auto', minHeight: '32px' }}
              />

              {loading ? (
                <button
                  onClick={handleAbort}
                  disabled={!ws || ws.readyState !== WebSocket.OPEN}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-850 disabled:text-zinc-600 transition rounded-lg text-white flex items-center justify-center h-8 w-8 cursor-pointer shrink-0"
                  title="Stop Execution"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && attachments.length === 0) || !ws || ws.readyState !== WebSocket.OPEN}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800/60 disabled:text-zinc-600 transition rounded-lg text-white flex items-center justify-center h-8 w-8 cursor-pointer shrink-0"
                  title="Send Message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* Input Helpers Row & Preset Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-zinc-500 select-none font-sans border-t border-[#1a1a22] pt-1.5 mt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-600">Preset:</span>
                {(presets[agentMode] || []).length > 0 ? (
                  <div className="relative inline-block" ref={presetMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowPresetMenu(!showPresetMenu)}
                      disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
                      className="flex items-center gap-1 bg-[#18181f] text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded px-1.5 py-0.5 outline-none text-[10px] font-medium transition cursor-pointer select-none"
                    >
                      <span>
                        {(presets[agentMode] || []).find(p => p.id === activePresetId[agentMode])?.name || activePresetId[agentMode] || 'Select Preset'}
                      </span>
                      <ChevronUp className="w-3 h-3 text-zinc-500" />
                    </button>

                    {showPresetMenu && (
                      <div className="absolute bottom-full left-0 mb-1 w-44 bg-[#141417] border border-[#2d2d34] rounded-lg shadow-xl py-1 z-50 overflow-hidden">
                        <div className="px-2.5 py-1 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/40 mb-1">
                          Select Preset
                        </div>
                        {(presets[agentMode] || []).map(p => {
                          const isActive = p.id === activePresetId[agentMode];
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                handlePresetChange(p.id);
                                setShowPresetMenu(false);
                              }}
                              className={`w-full text-left px-2.5 py-1 text-[11px] transition flex flex-col ${
                                isActive
                                  ? 'bg-indigo-600/15 text-indigo-400 font-semibold'
                                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                              }`}
                            >
                              <span>{p.name}</span>
                              {p.description && p.description !== '/model' && (
                                <span className="text-[9px] text-zinc-600 font-normal truncate mt-0.5">
                                  {p.description}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-zinc-600 font-mono text-[10px]">None</span>
                )}
                {/* Main Model Display */}
                {(() => {
                  const activePreset = (presets[agentMode] || []).find(p => p.id === activePresetId[agentMode]);
                  if (activePreset) {
                    const mainModel = getMainModelLabel(activePreset);
                    const modelName = mainModel.includes('/') ? mainModel.substring(mainModel.lastIndexOf('/') + 1) : mainModel;
                    return (
                      <span className="text-[10px] text-zinc-600 font-mono border border-zinc-850 px-1 py-0.5 rounded bg-zinc-900/40">
                        {modelName}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="flex items-center gap-3">
                <span>⏎ send • Shift+⏎ newline • / commands</span>
                <span className="text-zinc-600">{input.length} chars</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <SuperAgentAuditLogs getAuthHeader={getAuthHeader} />
      )}
    </div>
  );
}
