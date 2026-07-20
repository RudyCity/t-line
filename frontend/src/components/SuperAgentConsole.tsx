import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Shield, Square, Folder, Sparkles, Activity, Settings, History } from 'lucide-react';
import { getRuntimeSearchParams } from '../utils/runtimeQuery';
import { WorkspaceInfo } from '../hooks/useTerminals';
import { SuperAgentAuditLogs } from './SuperAgentAuditLogs';
import { PermissionCard, QuestionCard, PlanCard, PendingPermission, PendingQuestion } from './SuperAgentInteractiveCards';
import { getSlashCommands, SlashCommand } from './SuperAgentCommands';
import { SuperAgentSidebar, RecentChangeItem, ProcessItem } from './SuperAgentSidebar';
import { SubAgentTerminalModal, SubAgentItem } from './SubAgentTerminalModal';
import { SuperAgentInputContainer } from './SuperAgentInputContainer';
import { SuperAgentSettingsMenu } from './SuperAgentSettingsMenu';
import { SuperAgentSettingsModal } from './SuperAgentSettingsModal';
import { ProviderProfile } from './SuperAgentLoginManager';
import { SuperAgentGroupedMessages } from './SuperAgentGroupedMessages';
import { SuperAgentHistorySidebar } from './SuperAgentHistorySidebar';
import { useSuperAgentSessions, isSystemNoiseMsg } from './useSuperAgentSessions';
import { useSidebarResize } from './useSidebarResize';
import { getAuthHeader, readFileAsText, readFileAsDataURL, getMainModelLabel as getModelLabelUtil, handleAgentEventPayload, fetchCliPromptHistory } from './SuperAgentConsoleUtils';

interface SuperAgentConsoleProps {
  activeWorkspacePath?: string;
  workspaces?: WorkspaceInfo[];
  onOpenSettings?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export function SuperAgentConsole({ activeWorkspacePath, workspaces = [], onOpenSettings, onLoadingChange }: SuperAgentConsoleProps) {
  // Workspace & Config state
  const [workspace, setWorkspace] = useState(() => activeWorkspacePath || localStorage.getItem('currentWorkspace') || '');

  // Session & Chat History management
  const [showHistorySidebar, setShowHistorySidebar] = useState<boolean>(true);
  const {
    sessions,
    activeSessionId,
    messages,
    setMessages,
    hasMore,
    loadingMore,
    loadMoreMessages,
    hasMoreSessions,
    loadingMoreSessions,
    loadMoreSessions,
    handleSelectSession,
    handleNewChat,
    handleDeleteSession,
    handleRenameSession
  } = useSuperAgentSessions(workspace);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [activeTab, setActiveTab] = useState<'console' | 'audit'>('console');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [agentMode, setAgentMode] = useState<'single' | 'multi'>('single');
  const [customArgs, setCustomArgs] = useState('');
  const [connectTrigger, setConnectTrigger] = useState(0);
  const isAbortedRef = useRef<boolean>(false);

  // Notify parent of AI agent loading state
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Sync workspace prop when activeWorkspacePath changes
  useEffect(() => {
    if (activeWorkspacePath && activeWorkspacePath !== workspace) {
      setWorkspace(activeWorkspacePath);
    }
  }, [activeWorkspacePath]);

  interface ModelPreset {
    id: string;
    name: string;
    description: string;
    models: Record<string, { providerProfileId: string; model: string } | string | any>;
  }

  const [presets, setPresets] = useState<{ single: ModelPreset[]; multi: ModelPreset[] }>({ single: [], multi: [] });
  const [activePresetId, setActivePresetId] = useState<{ single: string; multi: string }>({ single: '', multi: '' });
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string>('');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsModalTab, setSettingsModalTab] = useState<'login' | 'presets' | 'execution' | 'monitor'>('login');

  // Sidebar Monitor & Subagent Terminal states
  const [subagentList, setSubagentList] = useState<SubAgentItem[]>([]);
  const [procList] = useState<ProcessItem[]>([]);
  const [recentChangeList, setRecentChangeList] = useState<RecentChangeItem[]>([]);
  const [selectedSubagent, setSelectedSubagent] = useState<SubAgentItem | null>(null);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [isLoadingMonitor, setIsLoadingMonitor] = useState<boolean>(false);

  // Resizable Sidebars state & drag handlers
  const mainConsoleRef = useRef<HTMLDivElement>(null);
  const { historyWidth, monitorWidth, isResizingLeft, isResizingRight, startResizingLeft, startResizingRight } = useSidebarResize(mainConsoleRef);

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
        setProviders(data.providers || []);
        setActiveProviderId(data.activeProviderProfileId || '');
      }
    } catch (e) {
      console.error('Failed to fetch SuperAgent model config:', e);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [connectTrigger]);

  const handleSaveProvider = async (provider: ProviderProfile) => {
    const res = await fetch('/api/superagent/config/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ provider })
    });
    if (res.ok) fetchConfig();
  };

  const handleDeleteProvider = async (id: string) => {
    const res = await fetch(`/api/superagent/config/provider/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (res.ok) fetchConfig();
  };

  const handleSetActiveProvider = async (providerId: string) => {
    const res = await fetch('/api/superagent/config/active-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ providerId })
    });
    if (res.ok) {
      setActiveProviderId(providerId);
      setMessages(prev => [...prev, { role: 'system', text: 'Active provider changed. Restarting bridge...' }]);
      setConnectTrigger(prev => prev + 1);
    }
  };

  const handleSaveCustomPreset = async (mode: 'single' | 'multi', preset: any) => {
    const res = await fetch('/api/superagent/config/preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ mode, preset })
    });
    if (res.ok) fetchConfig();
  };

  const handleDeleteCustomPreset = async (mode: 'single' | 'multi', presetId: string) => {
    const res = await fetch(`/api/superagent/config/preset/${mode}/${encodeURIComponent(presetId)}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (res.ok) fetchConfig();
  };

  const handleOpenSettingsModal = (tab: 'login' | 'presets' | 'execution' | 'monitor' = 'login') => {
    fetchConfig();
    setSettingsModalTab(tab);
    setShowSettingsModal(true);
  };

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

  const getMainModelLabel = (preset: ModelPreset | undefined) => getModelLabelUtil(preset, agentMode);

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

  // Sync prompt history with CLI history file
  useEffect(() => {
    fetchCliPromptHistory().then(cliHistory => {
      if (cliHistory && cliHistory.length > 0) {
        setHistory(prev => {
          const merged = Array.from(new Set([...cliHistory.slice().reverse(), ...prev])).slice(0, 100);
          try {
            localStorage.setItem('superagent_prompt_history', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      }
    });
  }, [connectTrigger]);

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
      console.log(`[SuperAgent WS] Connection established. Workspace: ${workspace || 'Default'}`);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        handleAgentEventPayload(
          payload,
          setLoading,
          setToolProgressMsg,
          setMessages,
          setSubagentList,
          setPendingPermission,
          setPendingQuestion,
          setSelectedQuestionAnswers,
          setCustomQuestionInput,
          setPendingPlanApproval,
          isAbortedRef
        );
      } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', text: event.data }]);
        setLoading(false);
      }
    };

    socket.onclose = () => {
      console.log('[SuperAgent WS] Connection closed.');
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
      text: finalPrompt,
      sessionId: activeSessionId
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
    ws.send(JSON.stringify({ type: 'approve_plan', action }));
    setPendingPlanApproval(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#05070c] text-gray-200 overflow-hidden font-sans">
      <div className="grid grid-cols-3 items-center px-4 py-2.5 bg-[#090c14] border-b border-zinc-800/80 min-h-[48px] w-full shadow-sm">
        {/* Left Column */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            className={`px-2.5 py-1 text-[11px] rounded-md border transition flex items-center gap-1.5 cursor-pointer font-medium ${
              showHistorySidebar ? 'bg-indigo-950/80 border-indigo-700/80 text-indigo-300 shadow-sm' : 'bg-[#121622] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle Chat History Sidebar"
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
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
            onOpenSettingsModal={handleOpenSettingsModal}
          />
        </div>
      </div>

      {activeTab === 'console' ? (
        <div ref={mainConsoleRef} className="flex-1 flex overflow-hidden relative w-full">
          {/* Left Resizable Chat History Sidebar */}
          {showHistorySidebar && (
            <div style={{ width: `${historyWidth}px` }} className="h-full shrink-0 relative min-w-[160px] max-w-[500px]">
              <SuperAgentHistorySidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                hasMoreSessions={hasMoreSessions}
                loadingMoreSessions={loadingMoreSessions}
                onLoadMoreSessions={loadMoreSessions}
              />
            </div>
          )}

          {/* Left Resizer Drag Handle */}
          {showHistorySidebar && (
            <div
              onMouseDown={startResizingLeft}
              className="w-[2px] hover:w-[4px] bg-zinc-800/80 hover:bg-indigo-500/90 cursor-col-resize select-none transition-all duration-150 h-full shrink-0 z-20 active:bg-indigo-600"
              title="Drag to resize History panel"
            />
          )}

          <div className="flex-1 flex flex-col h-full overflow-hidden w-full min-w-0">
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs leading-relaxed w-full"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop < 80 && hasMore && !loadingMore) {
                  const prevHeight = el.scrollHeight;
                  loadMoreMessages().then(() => {
                    // Preserve scroll position after prepending older messages
                    requestAnimationFrame(() => {
                      const newHeight = el.scrollHeight;
                      el.scrollTop = newHeight - prevHeight;
                    });
                  });
                }
              }}
            >
            {/* Infinite scroll: loading older messages indicator */}
            {hasMore && (
              <div className="flex items-center justify-center py-2 gap-2 text-zinc-500 text-xs">
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span>Loading older messages...</span>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      const el = messagesContainerRef.current;
                      if (!el) return;
                      const prevHeight = el.scrollHeight;
                      loadMoreMessages().then(() => {
                        requestAnimationFrame(() => {
                          const newHeight = el.scrollHeight;
                          el.scrollTop = newHeight - prevHeight;
                        });
                      });
                    }}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors px-3 py-1 rounded border border-zinc-700/50 hover:border-indigo-500/50 bg-zinc-800/40"
                  >
                    ↑ Load older messages
                  </button>
                )}
              </div>
            )}
            <SuperAgentGroupedMessages
              messages={messages}
              isSystemNoiseMsg={isSystemNoiseMsg}
              isStreaming={loading}
            />

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

          {/* Right Resizer Drag Handle */}
          {showSidebar && (
            <div
              onMouseDown={startResizingRight}
              className="w-[2px] hover:w-[4px] bg-zinc-800/80 hover:bg-indigo-500/90 cursor-col-resize select-none transition-all duration-150 h-full shrink-0 z-20 active:bg-indigo-600"
              title="Drag to resize Monitor panel"
            />
          )}

          {/* Right Resizable Live Monitor Sidebar */}
          {showSidebar && (
            <div style={{ width: `${monitorWidth}px` }} className="h-full shrink-0 relative min-w-[180px] max-w-[600px]">
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
            </div>
          )}

          {/* Drag Overlay to prevent mouse event loss */}
          {(isResizingLeft || isResizingRight) && (
            <div className="fixed inset-0 z-50 cursor-col-resize select-none bg-transparent" />
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

      {/* SuperAgent Unified Settings Modal */}
      <SuperAgentSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
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
        providers={providers}
        activeProviderId={activeProviderId}
        onSaveProvider={handleSaveProvider}
        onDeleteProvider={handleDeleteProvider}
        onSetActiveProvider={handleSetActiveProvider}
        presets={presets}
        activePresetId={activePresetId}
        onSelectPreset={handlePresetChange}
        onSaveCustomPreset={handleSaveCustomPreset}
        onDeleteCustomPreset={handleDeleteCustomPreset}
        getAuthHeader={getAuthHeader}
        defaultTab={settingsModalTab}
      />
    </div>
  );
}
