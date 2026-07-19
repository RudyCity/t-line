import { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Send, RefreshCw, Shield, Trash2, Square, Check, X, AlertTriangle, HelpCircle, Folder, Sparkles } from 'lucide-react';
import { getRuntimeSearchParams } from '../utils/runtimeQuery';
import { WorkspaceInfo } from '../hooks/useTerminals';

interface AuditLog {
  timestamp: string;
  type: string;
  data: any;
}

interface PendingPermission {
  permissionId: string;
  toolCall?: any;
  description?: string;
}

interface PendingQuestion {
  questionId: string;
  question: any;
  options?: string[];
  isMultiSelect?: boolean;
}

interface SlashCommand {
  command: string;
  description: string;
  argsHelp?: string;
  action?: (args?: string) => void;
}

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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Workspace & Config state
  const [workspace, setWorkspace] = useState(() => activeWorkspacePath || localStorage.getItem('currentWorkspace') || '');
  const [agentMode, setAgentMode] = useState<'single' | 'multi'>('single');
  const [customArgs, setCustomArgs] = useState('');
  const [connectTrigger, setConnectTrigger] = useState(0);

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

  const handleSend = (customPrompt?: string) => {
    const prompt = (customPrompt !== undefined ? customPrompt : input).trim();
    if (!prompt) return;

    // Check if it's a slash command first!
    if (prompt.startsWith('/')) {
      const parts = prompt.split(/\s+/);
      const cmdName = parts[0];
      const cmdArgs = prompt.slice(cmdName.length).trim();
      const match = slashCommands.find(c => c.command.toLowerCase() === cmdName.toLowerCase());
      if (match) {
        setInput('');
        if (match.action) {
          match.action(cmdArgs);
        }
        return;
      }
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setInput('');
    setLoading(true);
    setToolProgressMsg('');
    setMessages(prev => [...prev, { role: 'user', text: prompt }]);

    // Save to history
    if (!history.includes(prompt)) {
      const newHistory = [prompt, ...history].slice(0, 50);
      setHistory(newHistory);
      localStorage.setItem('superagent_prompt_history', JSON.stringify(newHistory));
    }
    setHistoryIndex(-1);

    ws.send(JSON.stringify({
      type: 'prompt',
      text: prompt
    }));
  };

  const slashCommands: SlashCommand[] = [
    {
      command: '/help',
      description: 'Show available commands & system instructions',
      action: () => {
        setMessages(prev => [
          ...prev,
          { role: 'system', text: 'Available commands:\n' +
            '/help - Show this help message\n' +
            '/status - Show agent connection & server status\n' +
            '/abort - Abort active agent execution immediately\n' +
            '/clear - Clear all console messages\n' +
            '/mode [single|multi] - Switch agent execution mode\n' +
            '/single - Switch agent mode to Single Agent and restart\n' +
            '/multi - Switch agent mode to Multi-Agent Master (--multi) and restart\n' +
            '/resume - Restart the agent process with the --resume flag\n' +
            '/workspace [path] - Switch active workspace\n' +
            '/explain - Ask SuperAgent to explain the codebase structure\n' +
            '/test - Ask SuperAgent to check and run tests\n' +
            '/reset - Reset and restart WebSocket connection'
          }
        ]);
      }
    },
    {
      command: '/status',
      description: 'Check agent server and connection status',
      action: () => {
        const statusText = `WebSocket Connection: ${ws?.readyState === WebSocket.OPEN ? 'Connected (OPEN)' : 'Disconnected'}\n` +
          `Active Workspace: ${workspace || 'None'}\n` +
          `CLI Mode: ${agentMode === 'multi' ? 'Multi-Agent Master (--multi)' : 'Single Agent Mode'}\n` +
          `Custom CLI Flags: ${customArgs || 'None'}`;
        setMessages(prev => [...prev, { role: 'system', text: statusText }]);
      }
    },
    {
      command: '/abort',
      description: 'Abort the active running agent task',
      action: () => {
        handleAbort();
      }
    },
    {
      command: '/clear',
      description: 'Clear the local console chat messages',
      action: () => {
        setMessages([{ role: 'system', text: 'Console cleared. Connected to t-line workspace context.' }]);
      }
    },
    {
      command: '/mode',
      description: 'Switch CLI mode',
      argsHelp: '[single|multi]',
      action: (args?: string) => {
        const cleanMode = args?.trim().toLowerCase();
        if (cleanMode === 'single' || cleanMode === 'multi') {
          setAgentMode(cleanMode as 'single' | 'multi');
          setMessages(prev => [...prev, { role: 'system', text: `Mode switched to: ${cleanMode}. Restarting bridge...` }]);
          setConnectTrigger(prev => prev + 1);
        } else {
          setMessages(prev => [...prev, { role: 'system', text: 'Usage: /mode [single|multi]' }]);
        }
      }
    },
    {
      command: '/single',
      description: 'Switch agent mode to Single Agent and restart',
      action: () => {
        setAgentMode('single');
        setMessages(prev => [...prev, { role: 'system', text: 'CLI Mode switched to Single Agent. Restarting bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/multi',
      description: 'Switch agent mode to Multi-Agent Master (--multi) and restart',
      action: () => {
        setAgentMode('multi');
        setMessages(prev => [...prev, { role: 'system', text: 'CLI Mode switched to Multi-Agent. Restarting bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/resume',
      description: 'Restart the agent process with the --resume flag',
      action: () => {
        setCustomArgs('--resume');
        setMessages(prev => [...prev, { role: 'system', text: 'Flags set to --resume. Restarting bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/workspace',
      description: 'Switch active workspace path',
      argsHelp: '[path]',
      action: (args?: string) => {
        const targetPath = args?.trim();
        if (targetPath) {
          setWorkspace(targetPath);
          localStorage.setItem('currentWorkspace', targetPath);
          setMessages(prev => [...prev, { role: 'system', text: `Workspace switched to: ${targetPath}. Restarting bridge...` }]);
          setConnectTrigger(prev => prev + 1);
        } else {
          setMessages(prev => [...prev, { role: 'system', text: 'Usage: /workspace [directory-path]' }]);
        }
      }
    },
    {
      command: '/explain',
      description: 'Ask SuperAgent to analyze and explain the codebase structure',
      action: () => {
        handleSend('Please analyze and explain the codebase structure of this workspace.');
      }
    },
    {
      command: '/test',
      description: 'Ask SuperAgent to check and run tests',
      action: () => {
        handleSend('Please check the test suite and run tests to verify codebase health.');
      }
    },
    {
      command: '/reset',
      description: 'Reset and restart the WebSocket bridge',
      action: () => {
        setMessages(prev => [...prev, { role: 'system', text: 'Resetting and reconnecting WebSocket bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    }
  ];

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

  const handleAbort = () => {
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

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const response = await fetch('/api/superagent/audit-logs', {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  const clearAuditLogs = async () => {
    if (!confirm('Are you sure you want to clear the audit logs?')) return;
    try {
      const response = await fetch('/api/superagent/audit-logs', {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (response.ok) {
        setAuditLogs([]);
      }
    } catch (e) {
      console.error('Failed to clear audit logs:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

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

      <div className="bg-[#16161a] border-b border-[#2d2d34] px-4 py-2 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex flex-col gap-1">
          <label className="text-zinc-400 font-medium flex items-center gap-1">
            <Folder className="w-3 h-3 text-zinc-500" /> Active Workspace
          </label>
          <div className="flex gap-1">
            {workspaces.length > 0 ? (
              <select
                value={workspace}
                onChange={(e) => {
                  setWorkspace(e.target.value);
                  localStorage.setItem('currentWorkspace', e.target.value);
                }}
                className="bg-[#212127] border border-[#2d2d34] rounded px-2 py-1 text-zinc-200 outline-none focus:border-indigo-500 w-64 text-xs font-mono"
              >
                {workspaces.map(w => (
                  <option key={w.id} value={w.path}>{w.name} ({w.path})</option>
                ))}
                {!workspaces.some(w => w.path === workspace) && workspace && (
                  <option value={workspace}>Custom ({workspace})</option>
                )}
              </select>
            ) : (
              <input
                type="text"
                value={workspace}
                onChange={(e) => {
                  setWorkspace(e.target.value);
                  localStorage.setItem('currentWorkspace', e.target.value);
                }}
                className="bg-[#212127] border border-[#2d2d34] rounded px-2 py-1 text-zinc-200 outline-none focus:border-indigo-500 w-64 text-xs font-mono"
                placeholder="Workspace directory path"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-zinc-400 font-medium">CLI Mode</label>
          <select
            value={agentMode}
            onChange={(e) => setAgentMode(e.target.value as 'single' | 'multi')}
            className="bg-[#212127] border border-[#2d2d34] rounded px-2 py-1 text-zinc-200 outline-none focus:border-indigo-500 text-xs"
          >
            <option value="single">Single Agent Mode</option>
            <option value="multi">Multi-Agent Master (--multi)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-zinc-400 font-medium">Custom CLI Flags</label>
          <input
            type="text"
            value={customArgs}
            onChange={(e) => setCustomArgs(e.target.value)}
            className="bg-[#212127] border border-[#2d2d34] rounded px-2 py-1 text-zinc-200 outline-none focus:border-indigo-500 w-36 text-xs font-mono"
            placeholder="e.g. --resume"
          />
        </div>

        <div className="flex items-end h-full pt-4">
          <button
            onClick={() => setConnectTrigger(prev => prev + 1)}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium px-3 py-1 text-xs rounded transition flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Apply & Restart Bridge
          </button>
        </div>
      </div>

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
              <div className="p-4 rounded-lg bg-amber-950/40 border-2 border-amber-500/80 text-amber-100 space-y-3">
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
                    className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs px-3 py-1.5 rounded flex items-center gap-1 transition"
                  >
                    <Check className="w-3.5 h-3.5" /> Allow Once
                  </button>
                  <button
                    onClick={() => handlePermissionDecision('session')}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3 py-1.5 rounded transition"
                  >
                    Allow for Session
                  </button>
                  <button
                    onClick={() => handlePermissionDecision(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs px-3 py-1.5 rounded flex items-center gap-1 transition"
                  >
                    <X className="w-3.5 h-3.5" /> Deny
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Question Card */}
            {pendingQuestion && (
              <div className="p-4 rounded-lg bg-indigo-950/50 border-2 border-indigo-500/80 text-indigo-100 space-y-3">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                  <HelpCircle className="w-5 h-5 text-indigo-400" />
                  <span>Agent Question</span>
                </div>
                <p className="text-xs text-zinc-200 font-medium">
                  {typeof pendingQuestion.question === 'string' ? pendingQuestion.question : JSON.stringify(pendingQuestion.question)}
                </p>

                {pendingQuestion.options && pendingQuestion.options.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {pendingQuestion.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (pendingQuestion.isMultiSelect) {
                            setSelectedQuestionAnswers(prev => 
                              prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
                            );
                          } else {
                            setSelectedQuestionAnswers([opt]);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded border transition flex items-center gap-2 ${
                          selectedQuestionAnswers.includes(opt)
                            ? 'bg-indigo-600 border-indigo-400 text-white font-medium'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[10px] ${
                          selectedQuestionAnswers.includes(opt) ? 'border-white bg-indigo-400' : 'border-zinc-500'
                        }`}>
                          {selectedQuestionAnswers.includes(opt) && '✓'}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={customQuestionInput}
                    onChange={(e) => setCustomQuestionInput(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full bg-[#121214] border border-indigo-500/50 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                )}

                <button
                  onClick={handleQuestionSubmit}
                  disabled={selectedQuestionAnswers.length === 0 && !customQuestionInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold text-xs px-4 py-1.5 rounded transition"
                >
                  Submit Answer
                </button>
              </div>
            )}

            {/* Interactive Plan Approval Card */}
            {pendingPlanApproval && (
              <div className="p-4 rounded-lg bg-emerald-950/40 border-2 border-emerald-500/80 text-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Shield className="w-5 h-5" />
                  <span>Plan Review Required</span>
                </div>
                <p className="text-xs text-emerald-200">
                  SuperAgent has constructed an implementation plan. Authorize execution or cancel.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handlePlanApproval('approve')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-1.5 rounded transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve & Execute Plan
                  </button>
                  <button
                    onClick={() => handlePlanApproval('reject')}
                    className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-200 font-semibold text-xs px-4 py-1.5 rounded transition flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Reject Plan
                  </button>
                </div>
              </div>
            )}

            {/* Prominent Thinking & Tool Execution Loading Bar */}
            {loading && (
              <div className="p-3.5 rounded-lg border border-indigo-500/60 bg-indigo-950/50 text-indigo-100 text-xs shadow-lg max-w-[90%] mr-auto flex items-center justify-between gap-3 font-sans">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                  <div>
                    <div className="font-semibold text-indigo-200 flex items-center gap-2">
                      <span>SuperAgent is thinking & executing tools</span>
                      <span className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">Analyzing codebase, performing context operations</span>
                  </div>
                </div>
                <button
                  onClick={handleAbort}
                  className="px-2.5 py-1 bg-red-900/80 hover:bg-red-800 border border-red-700 text-red-100 rounded font-semibold text-[11px] flex items-center gap-1 transition shrink-0"
                >
                  <Square className="w-3 h-3 fill-current" /> Stop
                </button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div ref={consoleContainerRef} className="p-4 bg-[#121214] border-t border-[#2d2d34] flex flex-col gap-1.5 relative">
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

            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={ws?.readyState === WebSocket.OPEN ? "Ask SuperAgent to perform tasks or type / to execute commands..." : "Connecting to SuperAgent bridge..."}
                className="flex-1 bg-[#1e1e24] border border-[#2d2d34] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder-zinc-500 font-mono resize-none overflow-y-auto max-h-[240px] leading-relaxed"
                rows={1}
                disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
                style={{ height: 'auto', minHeight: '38px' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim() || !ws || ws.readyState !== WebSocket.OPEN}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 transition px-4 py-2 rounded-lg text-white font-semibold flex items-center justify-center h-[38px] cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {/* Input Helpers Row */}
            <div className="flex justify-between items-center px-1 text-[10px] text-zinc-500 select-none font-sans">
              <span>⏎ to send • Shift+⏎ for newline • type / for commands</span>
              <span>{input.length} chars</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1a1a20]">
          <div className="p-3 bg-[#121214] border-b border-[#2d2d34] flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Interaction & Decision Logs</span>
            <div className="flex gap-2">
              <button
                onClick={fetchAuditLogs}
                disabled={loadingAudit}
                className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded text-zinc-200 transition font-medium"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={clearAuditLogs}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 text-xs rounded text-red-200 transition font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Logs
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
            {auditLogs.length === 0 ? (
              <div className="text-center text-zinc-500 py-10">
                No logs recorded yet. Start interacting with SuperAgent to generate audit logs.
              </div>
            ) : (
              auditLogs.map((log, index) => (
                <div key={index} className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-zinc-500">{new Date(log.timestamp).toLocaleString()}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.type === 'prompt' ? 'bg-indigo-950 text-indigo-300 border border-indigo-900/60' :
                      log.type === 'agent_event' ? 'bg-amber-950 text-amber-300 border border-amber-900/60' :
                      log.type === 'system' ? 'bg-zinc-950 text-zinc-400 border border-zinc-900/60' :
                      'bg-emerald-950 text-emerald-300 border border-emerald-900/60'
                    }`}>
                      {log.type.toUpperCase()}
                    </span>
                  </div>
                  <pre className="text-zinc-300 overflow-x-auto max-h-60 overflow-y-auto p-1 bg-black/20 rounded">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
