import React, { useState, useEffect, useRef } from 'react';
import { WorkspaceInfo } from '../hooks/useTerminals';

import { QuestionCard, PlanCard, TokenUsageCard, PendingPermission, PendingQuestion, TokenUsageData } from './SuperAgentInteractiveCards';
import { getSlashCommands, getSubCommands, getCliOnlySuggestions, isCliOnlyCommand, SlashCommand } from './SuperAgentCommands';
import { parseParityCommand, runParityCommand } from './SuperAgentParityActions';
import { SuperAgentSidebar, RecentChangeItem, ProcessItem } from './SuperAgentSidebar';
import { SubAgentTerminalModal, SubAgentItem } from './SubAgentTerminalModal';
import { ActiveTasksBar, ChecklistTaskItem } from './ActiveTasksBar';
import { SuperAgentTaskMonitor } from './SuperAgentTaskMonitor';
import { type AssistantTaskHandoff } from './AssistantTaskDraftPanel';
import { AssistantActivityCenter } from './AssistantActivityCenter';
import { listCoreApprovals } from './CoreApprovalStatusApi';
import { resolveAgentChatModeSwitch } from './agentModeSession';
import { SuperAgentBrainExplorer } from './SuperAgentBrainExplorer';
import { SuperAgentInputContainer } from './SuperAgentInputContainer';
import { SuperAgentSettingsMenu } from './SuperAgentSettingsMenu';
import { SessionIdBadge } from './SessionIdBadge';
import { isFreshBrowserHandoff } from './browserHandoffRouting';

import { SuperAgentSettingsModal } from './SuperAgentSettingsModal';
import { ProviderProfile } from './SuperAgentLoginManager';
import { SuperAgentGroupedMessages } from './SuperAgentGroupedMessages';
import { SuperAgentHistorySidebar } from './SuperAgentHistorySidebar';
import { useSuperAgentSessions, isSystemNoiseMsg } from './useSuperAgentSessions';
import { useSidebarResize } from './useSidebarResize';
import { getAuthHeader, readFileAsText, readFileAsDataURL, getMainModelLabel as getModelLabelUtil, handleAgentEventPayload, fetchCliPromptHistory } from './SuperAgentConsoleUtils';
import { History, Folder, Activity, Sparkles, RefreshCw, ArrowDown, MoreVertical, Brain } from 'lucide-react';
import { getRuntimeSearchParams } from '../utils/runtimeQuery';
import { getAuthToken } from '../utils/tokenStorage';
import { bridgeReconnectDelay, shouldResetBridgeRetryBudget } from '../services/bridgeReconnectPolicy';
import { parseCoreReconnectNotice, type CoreReconnectNotice } from '../services/coreReconnectNotice';
import { CoreReconnectBanner } from './CoreReconnectBanner';
import { addRule, loadRules, matchesRule, patternFromPermission } from '../utils/permissionRules';

interface SuperAgentConsoleProps {
  activeWorkspacePath?: string;
  workspaces?: WorkspaceInfo[];
  onOpenSettings?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onOpenFile?: (filePath: string, fileName?: string) => void;
  onOpenDiffTab?: (commitHash: string, filePath: string, worktreePath?: string) => void;
  onOpenStudio?: () => void;
  browserHandoff?: { id: string; workspacePath: string; instruction: string; createdAt: number } | null;
  onBrowserHandoffConsumed?: (id: string) => void;
}

export function SuperAgentConsole({
  activeWorkspacePath,
  workspaces = [],
  onOpenSettings: _onOpenSettings,
  onLoadingChange,
  onOpenFile,
  onOpenDiffTab,
  onOpenStudio,
  browserHandoff,
  onBrowserHandoffConsumed,
}: SuperAgentConsoleProps) {
  // Workspace & Config state
  const [workspace, setWorkspace] = useState(() => activeWorkspacePath || localStorage.getItem('currentWorkspace') || '');

  // Session & Chat History management
  const [showHistorySidebar, setShowHistorySidebar] = useState<boolean>(true);
  const [showBrainExplorer, setShowBrainExplorer] = useState(false);
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
    handleRenameSession,
    pinnedSessionIds,
    handleTogglePinSession
  } = useSuperAgentSessions(workspace);

  const [input, setInput] = useState('');
  const [delegateHandoff, setDelegateHandoff] = useState<AssistantTaskHandoff | null>(null);
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [browserBridgeReady, setBrowserBridgeReady] = useState(false);
  const [coreReconnectNotice, setCoreReconnectNotice] = useState<CoreReconnectNotice | null>(null);
  const handledBrowserHandoffRef = useRef<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [agentMode, setAgentMode] = useState<'single' | 'multi'>('single');

  // Server sessions are mode-bound. Preserve the previous session and open a
  // fresh one when switching modes, instead of replacing its active agent.
  const selectAgentMode: React.Dispatch<React.SetStateAction<'single' | 'multi'>> = update => {
    const nextMode = typeof update === 'function' ? update(agentMode) : update;
    const selection = resolveAgentChatModeSwitch(agentMode, nextMode);
    if (!selection.createSession) return;
    handleNewChat();
    setAgentMode(selection.mode);
  };
  const [customArgs, setCustomArgs] = useState('');
  const [connectTrigger, setConnectTrigger] = useState(0);
  const isAbortedRef = useRef<boolean>(false);
  const isPrependingRef = useRef<boolean>(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);
  const isSessionSwitchRef = useRef<boolean>(true);
  const prevSessionIdRef = useRef<string>(activeSessionId);
  const isUserScrolledUpRef = useRef<boolean>(false);

  const handleLoadMoreMessagesWithScroll = () => {
    if (!hasMore || loadingMore) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    const prevScrollHeight = el.scrollHeight;
    const prevScrollTop = el.scrollTop;
    isPrependingRef.current = true;
    loadMoreMessages().then(() => {
      requestAnimationFrame(() => {
        if (el) {
          const newScrollHeight = el.scrollHeight;
          el.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
        }
      });
    });
  };

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
  const [settingsModalTab, setSettingsModalTab] = useState<'login' | 'presets' | 'execution' | 'monitor' | 'mcp' | 'skills' | 'memory' | 'chains'>('login');

  // Sidebar Monitor & Subagent Terminal states
  const [subagentList, setSubagentList] = useState<SubAgentItem[]>([]);
  // Session-scoped activity only: the sidebar list also contains workspace-wide instances.
  const [timelineSubagents, setTimelineSubagents] = useState<SubAgentItem[]>([]);
  const [approvalJump, setApprovalJump] = useState(0);
  useEffect(() => { setTimelineSubagents([]); }, [workspace, activeSessionId]);
  const [procList, setProcList] = useState<ProcessItem[]>([]);
  const [recentChangeList, setRecentChangeList] = useState<RecentChangeItem[]>([]);
  const [bgTaskList, setBgTaskList] = useState<any[]>([]);
  const [browserInstanceList, setBrowserInstanceList] = useState<any[]>([]);
  const [checklistTasks, setChecklistTasks] = useState<ChecklistTaskItem[]>([]);
  const [selectedSubagent, setSelectedSubagent] = useState<SubAgentItem | null>(null);
  const [showSidebar, setShowSidebar] = useState<boolean>(() =>
    !(localStorage.getItem('tline-theme') || 'default').startsWith('calm-')
  );
  useEffect(() => {
    const onThemeChanged = (event: Event) => {
      const next = (event as CustomEvent<{ theme: string }>).detail?.theme;
      if (next?.startsWith('calm-')) setShowSidebar(false);
    };
    window.addEventListener('tline-theme-change', onThemeChanged);
    return () => window.removeEventListener('tline-theme-change', onThemeChanged);
  }, []);
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
        const rawAgents = [
          ...(Array.isArray(instData.subagents) ? instData.subagents : []),
          ...(Array.isArray(instData.superagents) ? instData.superagents : [])
        ];

        if (rawAgents.length > 0) {
          setSubagentList(prev => {
            const merged = [...prev];
            rawAgents.forEach((sa: any) => {
              const idx = merged.findIndex(m => m.id === sa.id);
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...sa };
              } else {
                merged.push({
                  id: sa.id || Math.random().toString(36).substring(7),
                  typeName: sa.typeName || 'subagent',
                  role: sa.role || sa.typeName || 'Agent',
                  status: sa.status || 'RUNNING',
                  result: sa.result,
                  completedAt: sa.completedAt
                });
              }
            });
            return merged;
          });
        }

        if (Array.isArray(instData.procs)) {
          setProcList(instData.procs);
        }
        if (Array.isArray(instData.bgTasks)) {
          setBgTaskList(instData.bgTasks);
        }
        if (Array.isArray(instData.browserInstances)) {
          setBrowserInstanceList(instData.browserInstances);
        }
      }

      const tasksRes = await fetch(`/api/superagent/tasks?workspace=${encodeURIComponent(workspace)}`, {
        headers: getAuthHeader()
      });
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        if (Array.isArray(tasksData.tasks)) {
          setChecklistTasks(tasksData.tasks);
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
    if (res.ok) {
      await fetchConfig();
    } else {
      const err = await res.json().catch(() => ({ error: 'Failed to save preset' }));
      throw new Error(err.error || 'Failed to save preset');
    }
  };

  const handleDeleteCustomPreset = async (mode: 'single' | 'multi', presetId: string) => {
    const res = await fetch(`/api/superagent/config/preset/${mode}/${encodeURIComponent(presetId)}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (res.ok) {
      await fetchConfig();
    } else {
      const err = await res.json().catch(() => ({ error: 'Failed to delete preset' }));
      throw new Error(err.error || 'Failed to delete preset');
    }
  };

  const handleOpenSettingsModal = (tab: 'login' | 'presets' | 'execution' | 'mcp' | 'skills' | 'memory' | 'chains' = 'login') => {
    fetchConfig();
    setSettingsModalTab(tab);
    setShowSettingsModal(true);
  };

  const handlePresetChange = async (presetIdOrMode: string, maybePresetId?: string) => {
    const mode = (maybePresetId ? presetIdOrMode : agentMode) as 'single' | 'multi';
    const presetId = maybePresetId || presetIdOrMode;
    try {
      const response = await fetch('/api/superagent/config/active-preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ mode, presetId })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.activePresetId) {
          setActivePresetId(data.activePresetId);
        } else {
          setActivePresetId(prev => ({ ...prev, [mode]: presetId }));
        }
        await fetchConfig();
        const match = (presets[mode] || []).find(p => p.id?.toLowerCase() === presetId.toLowerCase() || p.name?.toLowerCase() === presetId.toLowerCase());
        const name = match ? match.name : presetId;
        setMessages(prev => [...prev, { role: 'system', text: `Model preset changed to "${name}" (${mode.toUpperCase()} mode). Restarting bridge...` }]);
        setConnectTrigger(prev => prev + 1);
      }
    } catch (e) {
      console.error('Failed to change preset:', e);
    }
  };

  const getMainModelLabel = (preset: ModelPreset | undefined) => getModelLabelUtil(preset, agentMode);

  // Interactive agent states
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [approvalDispatch, setApprovalDispatch] = useState<'idle' | 'submitting' | 'unknown' | 'rejected'>('idle');
  const [approvalFeedback, setApprovalFeedback] = useState('');
  const approvalInFlight = useRef<string | null>(null);
  const alwaysRuleForAck = useRef<{ permissionId: string; rule: ReturnType<typeof patternFromPermission> } | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [selectedQuestionAnswers, setSelectedQuestionAnswers] = useState<string[]>([]);
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [pendingPlanApproval, setPendingPlanApproval] = useState<boolean>(false);
  const [toolProgressMsg, setToolProgressMsg] = useState<string>('');
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData>({ promptTokens: 0, completionTokens: 0, totalCostUsd: 0 });

  // Enhanced Input States
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [installedSkills, setInstalledSkills] = useState<Array<{ name: string; description: string }>>([]);
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

  // Fetch installed skills from SuperAgent for slash command autocomplete
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await fetch('/api/superagent/skills', { headers: getAuthHeader() });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.skills)) {
            setInstalledSkills(data.skills);
          }
        }
      } catch {}
    };
    fetchSkills();
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

  const activeSessionIdRef = useRef(activeSessionId);
  const activeWsUrlRef = useRef<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeSessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = activeSessionId;
      isSessionSwitchRef.current = true;
      isUserScrolledUpRef.current = false;
      setShowScrollBottomBtn(false);
    }
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

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

    // Re-read current credentials on every attempt, including sessionStorage.
    const token = getAuthToken() || '';
    const wsUrl = `${protocol}//${host}/api/superagent?workspace=${encodeURIComponent(workspace)}&agentMode=${encodeURIComponent(agentMode)}&customArgs=${encodeURIComponent(customArgs)}&sessionId=${encodeURIComponent(activeSessionId)}`;

    activeWsUrlRef.current = wsUrl;
    console.log('[SuperAgent] Connecting to bridge:', `${protocol}//${host}/api/superagent`, { workspace: workspace || 'Default', agentMode });
    const socket = token
      ? new WebSocket(wsUrl, ['tline-bearer', token])
      : new WebSocket(wsUrl);
    let connectedAt = 0;
    // A stalled handshake should not leave the UI permanently CONNECTING.
    const connectTimeout = window.setTimeout(() => {
      if (wsRef.current === socket && socket.readyState === WebSocket.CONNECTING) {
        console.warn('[SuperAgent WS] Handshake timed out; reconnecting.');
        try { socket.close(); } catch {}
      }
    }, 12000);

    socket.onopen = () => {
      if (wsRef.current !== socket) return;
      window.clearTimeout(connectTimeout);
      connectedAt = Date.now();
      console.log(`[SuperAgent WS] Connection established. Workspace: ${workspace || 'Default'}`);
      setBrowserBridgeReady(true);
      // Read-only status check after WS reconnect: never resubmit chat or tools.
      socket.send(JSON.stringify({ type: 'core_health_probe', sessionId: activeSessionIdRef.current }));
    };

    socket.onmessage = (event) => {
      if (wsRef.current !== socket) return; // Old socket events must not affect its replacement.
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'permission_decision_ack') {
          if (payload.sessionId !== activeSessionIdRef.current ||
              payload.permissionId !== approvalInFlight.current) return;
          approvalInFlight.current = null;
          if (payload.accepted === true) {
            setApprovalDispatch('idle'); setApprovalFeedback('Approval accepted by Core.');
            const approvedRule = alwaysRuleForAck.current;
            if (approvedRule !== null && approvedRule.permissionId === payload.permissionId) {
              addRule(workspace || '', {
                pattern: approvedRule.rule,
                description: 'Confirmed tool approval', createdAt: Date.now(),
              });
            }
            alwaysRuleForAck.current = null;
            setPendingPermission(prev => prev?.permissionId === payload.permissionId ? null : prev);
          } else {
            alwaysRuleForAck.current = null;
            setApprovalDispatch(payload.code === 'OUTCOME_UNKNOWN' ? 'unknown' : 'rejected');
            setApprovalFeedback(payload.code === 'OUTCOME_UNKNOWN'
              ? 'Core response uncertain. Check status before deciding again.'
              : 'Core rejected decision (' + String(payload.code || 'unknown') + ').');
          }
          return;
        }
        if (payload?.type === 'core_reconnect_state') {
          const notice = parseCoreReconnectNotice(payload, activeSessionIdRef.current);
          if (notice) setCoreReconnectNotice(notice.phase === 'connected' ? null : notice);
          return;
        }

        if (payload?.sessionId && payload.sessionId !== activeSessionIdRef.current) return;
        if (payload?.type === 'subagents_update' && Array.isArray(payload.subagents)) {
          setTimelineSubagents(prev => {
            const merged = [...prev];
            for (const sa of payload.subagents) {
              if (!sa || typeof sa.id !== 'string' || !sa.id) continue;
              const record: SubAgentItem = {
                id: sa.id, typeName: sa.typeName, role: sa.role || sa.typeName,
                status: sa.status || 'RUNNING', prompt: sa.prompt, result: sa.result,
                logs: Array.isArray(sa.logs) ? sa.logs : [],
                startedAt: sa.startedAt, completedAt: sa.completedAt, model: sa.model,
              };
              const at = merged.findIndex(agent => agent.id === sa.id);
              if (at < 0) merged.push(record);
              else merged[at] = { ...merged[at], ...record };
            }
            return merged.slice(-40);
          });
        }
        if (payload?.type === 'permission_required') {
          approvalInFlight.current = null;
          alwaysRuleForAck.current = null;
          setApprovalDispatch('idle'); setApprovalFeedback('');
        }
        // Existing explicit workspace rules. Scope auto-approval to this active socket/session.
        if (payload?.type === 'permission_required' && socket.readyState === WebSocket.OPEN &&
            activeWsUrlRef.current === wsUrl && !isAbortedRef.current) {
          const candidate = {
            permissionId: payload.permissionId,
            toolCall: payload.toolCall,
            description: payload.description,
          };
          const rules = loadRules(workspace || '');
          if (matchesRule(candidate, rules)) {
            socket.send(JSON.stringify({
              type: 'approve_permission',
              permissionId: payload.permissionId,
              approval: true,
            }));
            approvalInFlight.current = payload.permissionId;
            setPendingPermission(candidate);
            setApprovalDispatch('submitting');
            setApprovalFeedback('Saved rule matched. Awaiting Core acknowledgement.');
            return;
          }
        }

        handleAgentEventPayload(
          payload, setLoading, setToolProgressMsg, setMessages, setSubagentList,
          setPendingPermission, setPendingQuestion, setSelectedQuestionAnswers,
          setCustomQuestionInput, setPendingPlanApproval, isAbortedRef, activeSessionIdRef.current,
          setTokenUsage
        );
      } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', text: event.data }]);
        setLoading(false);
      }
    };

    socket.onclose = (event) => {
      window.clearTimeout(connectTimeout);
      if (wsRef.current !== socket) return; // Prevent stale close events from reconnecting a replacement.
      console.log('[SuperAgent WS] Connection closed.', { code: event.code, clean: event.wasClean });
      setBrowserBridgeReady(false);
      if (approvalInFlight.current) {
        approvalInFlight.current = null;
        setApprovalDispatch('unknown');
        setApprovalFeedback('Connection interrupted after approval dispatch. Verifying Core status before another action.');
      }
      setLoading(false);
      setCoreReconnectNotice({
        type: 'core_reconnect_state', sessionId: activeSessionIdRef.current,
        phase: 'offline', code: 'BRIDGE_DISCONNECTED',
        message: 'Desktop bridge disconnected. Connection checks will retry; pending prompts and tools are not resent.',
        automaticChatReplayAllowed: false,
      });
      // Reset only after a sustained connection; rapid open/close loops
      // retain their increasing backoff.
      if (shouldResetBridgeRetryBudget(connectedAt, Date.now())) reconnectAttemptsRef.current = 0;
      const attempts = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = attempts;
      // Retry indefinitely at a capped cadence; only read-only probes run.
      // No chat, tool or approval request is replayed.
      const delay = bridgeReconnectDelay(attempts);
      console.log(`[SuperAgent WS] Reconnect attempt ${attempts} in ${delay}ms`);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        setConnectTrigger(prev => prev + 1);
      }, delay);
    };

    wsRef.current = socket;
    setWs(socket);

    return () => {
      activeWsUrlRef.current = '';
      wsRef.current = null;
      window.clearTimeout(connectTimeout);
      // React may create a new socket with the same URL before this one
      // closes. Suppress teardown events so they cannot close the new one.
      socket.onclose = null;
      socket.onmessage = null;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.onopen = () => {
          try { socket.close(); } catch {}
        };
      } else {
        try { socket.close(); } catch {}
      }
    };
  }, [workspace, agentMode, customArgs, activeSessionId, connectTrigger]);

  useEffect(() => {
    if (isPrependingRef.current) {
      isPrependingRef.current = false;
      return;
    }
    // On initial load or switching session: jump instantly without dizzying smooth scroll animation
    if (isSessionSwitchRef.current) {
      isSessionSwitchRef.current = false;
      chatEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      return;
    }
    // If user scrolled up to read history, don't interrupt them unless user sent a message or session loading
    if (isUserScrolledUpRef.current && !loading) {
      return;
    }
    const behavior = loading ? 'auto' : 'smooth';
    chatEndRef.current?.scrollIntoView({ behavior });
  }, [messages, pendingPermission, pendingQuestion, pendingPlanApproval, toolProgressMsg, loading]);

  async function handleSend(customPrompt?: string, options?: { preserveDraft?: boolean; skipHistory?: boolean }) {
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
      if (parseParityCommand(prompt)) {
        setInput('');
        const output = await runParityCommand(prompt, workspace, getAuthHeader);
        setMessages(prev => [...prev, { role: 'system', text: output }]);
        return;
      }
      if ((cmdName.toLowerCase() === '/brain' || cmdName.toLowerCase() === '/scratch') && !cmdArgs) {
        setInput('');
        setShowBrainExplorer(true);
        return;
      }
      if (cmdName.toLowerCase() === '/brain' || cmdName.toLowerCase() === '/scratch') {
        setInput('');
        setMessages(prev => [...prev, {
          role:'system', text:'Brain subcommands are CLI-only in the desktop console. Use the SuperAgent CLI, or open Brain Explorer for native task, storage, and credential controls. No command was executed.'
        }]);
        return;
      }
      if (isCliOnlyCommand(cmdName)) {
        setInput('');
        setMessages(prev => [...prev, {
          role: 'system',
          text: `${cmdName} exists in SuperAgent CLI source, but T-Line does not yet provide a native desktop action for it. Open a SuperAgent CLI terminal to run it. Nothing was dispatched.`
        }]);
        return;
      }
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

    const currentActivePresetId = activePresetId[agentMode] || '';
    const activePresetObj = (presets[agentMode] || []).find(
      p => p.id?.toLowerCase() === currentActivePresetId.toLowerCase() || p.name?.toLowerCase() === currentActivePresetId.toLowerCase()
    );
    if (!currentActivePresetId || !activePresetObj) {
      setMessages(prev => [...prev, {
        role: 'system',
        text: `⚠️ Cannot send prompt: No active model preset selected for ${agentMode.toUpperCase()} mode. Please select a preset first.`
      }]);
      return;
    }

    // An external, explicitly approved browser handoff must not erase a
    // partially written chat draft in the current composer.
    if (!options?.preserveDraft) setInput('');
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
      if (documentParts.length > 0) finalPrompt += '\n\n[Attached Files]:' + documentParts.join('');
      if (imageParts.length > 0) finalPrompt += '\n\n[Attached Images]:' + imageParts.join('');
    }

    // Clean up previews
    attachments.forEach(att => {
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    });
    setAttachments([]);

    let targetSessionId = activeSessionId;
    if (!targetSessionId || !sessions.some(s => s.id === targetSessionId)) {
      targetSessionId = handleNewChat();
    }

    setToolProgressMsg('');
    setMessages(prev => [...prev, { role: 'user', text: prompt || `Sent ${attachments.length} attachment(s)` }]);

    // Save to history
    if (!options?.skipHistory && prompt && !history.includes(prompt)) {
      const newHistory = [prompt, ...history].slice(0, 50);
      setHistory(newHistory);
      localStorage.setItem('superagent_prompt_history', JSON.stringify(newHistory));
    }
    setHistoryIndex(-1);

    ws.send(JSON.stringify({
      type: 'prompt',
      text: finalPrompt,
      sessionId: targetSessionId,
      clientMessageId: crypto.randomUUID()
    }));
  };

  // A verified desktop pairing may request one ordinary chat turn in the
  // existing session; never bypass MCP gateway permissions or mint a CDP claim.
  // The native check and user's confirmation happen in ManagedBrowserPanel.
  useEffect(() => {
    if (browserHandoff && handledBrowserHandoffRef.current === browserHandoff.id) return;
    if (browserHandoff && !isFreshBrowserHandoff(browserHandoff.createdAt)) {
      handledBrowserHandoffRef.current = browserHandoff.id;
      onBrowserHandoffConsumed?.(browserHandoff.id);
      setMessages(prev => [...prev, { role: 'system',
        text: 'Managed browser pairing request expired before the assistant was ready. Return to Browser and pair the tab again.' }]);
      return;
    }
    if (!browserHandoff || browserHandoff.workspacePath !== workspace ||
        !browserBridgeReady || !ws || ws.readyState !== WebSocket.OPEN ||
        !activeSessionId || !sessions.some(s => s.id === activeSessionId) ||
        attachments.length !== 0) return;
    const url = new URL(ws.url);
    if (url.searchParams.get('sessionId') !== activeSessionId ||
        url.searchParams.get('workspace') !== workspace) return;
    const selectedPresetId = activePresetId[agentMode];
    const hasPreset = (presets[agentMode] || []).some(p =>
      p.id?.toLowerCase() === selectedPresetId?.toLowerCase() ||
      p.name?.toLowerCase() === selectedPresetId?.toLowerCase());
    if (!hasPreset || handledBrowserHandoffRef.current === browserHandoff.id) return;
    handledBrowserHandoffRef.current = browserHandoff.id;
    // Clear the App's one-shot delivery before dispatch; this prevents duplicate
    // prompts if the console reconnects or rerenders. The existing session turn
    // channel has its own clientMessageId and queue semantics.
    onBrowserHandoffConsumed?.(browserHandoff.id);
    void handleSend(browserHandoff.instruction, { preserveDraft: true, skipHistory: true });
  }, [browserHandoff?.id, browserBridgeReady, ws, activeSessionId, workspace,
      agentMode, activePresetId, presets, attachments.length, sessions]);
  const slashCommands = [
    ...getSlashCommands({
      ws,
      workspace,
      agentMode,
      customArgs,
      setMessages,
      setAgentMode: selectAgentMode,
      setCustomArgs,
      setWorkspace,
      setConnectTrigger,
      handleSend,
      handleAbort,
      onOpenStudio,
      notifyUnsupported: command => {
        setMessages(prev => [...prev, {
          role: 'system',
          text: `${command} is not available as a native T-Line desktop command. Use SuperAgent CLI; no command has been executed.`
        }]);
      }
    }),
    ...getCliOnlySuggestions(command => {
      setMessages(prev => [...prev, {
        role: 'system',
        text: `${command} is currently CLI-only. Open SuperAgent CLI in a terminal; T-Line has no desktop execution adapter for it yet.`
      }]);
    }),
    {
      command: '/brain',
      argsHelp: '[subcommand]',
      description: 'Open Brain Explorer. Nested /brain actions are CLI-only.',
      action: (args?: string) => {
        if (!args) setShowBrainExplorer(true);
        else setMessages(prev => [...prev, {role:'system',text:'Nested /brain commands require SuperAgent CLI. Open Brain Explorer for native desktop task and artifact controls.'}]);
      },
    },
    {
      command: '/scratch',
      argsHelp: '[subcommand]',
      description: 'Brain Explorer alias. Nested /scratch actions are CLI-only.',
      action: (args?: string) => {
        if (!args) setShowBrainExplorer(true);
        else setMessages(prev => [...prev, {role:'system',text:'Nested /scratch commands require SuperAgent CLI. Open Brain Explorer for native desktop controls.'}]);
      },
    },
    {
      command: '/parity',
      description: 'Inspect live SuperAgent runtime capabilities (read-only)',
      action: () => { void handleSend('/parity'); },
    },
    {
      command: '/daemon',
      argsHelp: '[status]',
      description: 'Read live SuperAgent daemon status',
      action: (args?: string) => { void handleSend('/daemon ' + (args || 'status')); },
    },
    {
      command: '/gateway',
      argsHelp: '[status]',
      description: 'Read live SuperAgent gateway status',
      action: (args?: string) => { void handleSend('/gateway ' + (args || 'status')); },
    },
    ...([
      { command: '/mcp', argsHelp: '[list|status]',
        description: 'Inspect configured MCP server connectivity (read-only)', example: '/mcp list' },
      { command: '/tools', argsHelp: '[list]',
        description: 'List current SuperAgent tool names (read-only)', example: '/tools list' },
      { command: '/selfdev', argsHelp: '[status]',
        description: 'Inspect workspace selfdev metrics (read-only)', example: '/selfdev status' },
      { command: '/muse', argsHelp: '[status]',
        description: 'Inspect workspace Muse task status (read-only)', example: '/muse status' },
    ]).map(item => ({
      command: item.command, argsHelp: item.argsHelp, description: item.description,
      action: () => { void handleSend(item.example); },
    })),
    {
      command: '/tasks', argsHelp: '[status]',
      description: 'Read workspace CLI / daemon / Muse task statuses (read-only)',
      action: (args?: string) => { void handleSend('/tasks ' + (args || 'status')); },
    },
    // Dynamically inject installed skills as /skill-* commands
    ...installedSkills.map(skill => {
      const slug = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return {
        command: `/skill-${slug}`,
        description: skill.description || `Run ${skill.name} skill`,
        action: () => { handleSend(`/skill-${slug}`); }
      };
    })
  ];

  // Monitor input to show/hide suggestions (supports sub-commands & skills)
  useEffect(() => {
    if (input.startsWith('/')) {
      const trimmed = input.slice(1);
      const spaceIndex = trimmed.indexOf(' ');

      if (spaceIndex === -1) {
        // Top-level command matching
        const query = trimmed.toLowerCase();
        const filtered = slashCommands.filter(c => c.command.slice(1).toLowerCase().startsWith(query));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setSuggestionIndex(0);
      } else {
        // Sub-command matching (e.g. /workspace ..., /mode ..., /hallmark ...)
        const parentCmd = '/' + trimmed.slice(0, spaceIndex).toLowerCase();
        const argQuery = trimmed.slice(spaceIndex + 1).toLowerCase();

        const subCmds = getSubCommands(parentCmd, { workspace, agentMode }).filter(sc =>
          sc.command.toLowerCase().includes(argQuery) || (sc.argsHelp && sc.argsHelp.toLowerCase().includes(argQuery))
        );

        setSuggestions(subCmds);
        setShowSuggestions(subCmds.length > 0);
        setSuggestionIndex(0);
      }
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [input, workspace, agentMode]);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      if (!input || input.trim() === '') {
        textarea.style.height = '36px';
        return;
      }
      textarea.style.height = '36px';
      const scrollH = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollH, 220)}px`;
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
    if (s.argsHelp && !s.command.includes(' ')) {
      setInput(s.command + ' ');
    } else {
      setInput(s.command);
      if (s.action) {
        const args = s.command.includes(' ') ? s.command.split(' ').slice(1).join(' ') : '';
        s.action(args);
      } else {
        const immediateCommands = ['/help', '/status', '/abort', '/clear', '/reset', '/explain', '/test', '/goal', '/browser', '/grill-me', '/teamwork-preview', '/learn'];
        if (immediateCommands.includes(s.command)) {
          handleSend(s.command);
        }
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
    setSubagentList(prev => prev.map(sa => sa.status === 'RUNNING' ? { ...sa, status: 'CANCELLED', logs: [...(sa.logs || []), `[${new Date().toLocaleTimeString()}] Subagent cancelled by user abort.`] } : sa));
    setMessages(prev => [...prev, { role: 'system', text: '⏹️ Agent execution stopped by user.' }]);
  };

  const handleSelectSessionWrapped = (id: string) => {
    isAbortedRef.current = true;
    setLoading(false); setToolProgressMsg(''); setPendingPermission(null);
    setPendingQuestion(null); setPendingPlanApproval(false);
    handleSelectSession(id);
  };

  const handleNewChatWrapped = () => {
    isAbortedRef.current = true;
    setLoading(false); setToolProgressMsg(''); setPendingPermission(null);
    setPendingQuestion(null); setPendingPlanApproval(false);
    handleNewChat();
  };

  useEffect(() => {
    if (!pendingPermission || !workspace || !activeSessionId) return;
    const controller = new AbortController();
    const reconcile = async () => {
      try {
        const states = await listCoreApprovals(workspace, activeSessionId, getAuthHeader, controller.signal);
        if (controller.signal.aborted) return;
        const matching = states.find(item => item.permissionId === pendingPermission.permissionId);
        if (matching && matching.state !== 'pending') {
          const approvedRule = alwaysRuleForAck.current;
          if (approvedRule && approvedRule.permissionId === matching.permissionId &&
              (matching.state === 'approved' || matching.state === 'approved_session')) {
            addRule(workspace, { pattern: approvedRule.rule,
              description: 'Confirmed tool approval', createdAt: Date.now() });
          }
          approvalInFlight.current = null;
          alwaysRuleForAck.current = null;
          setPendingPermission(current => current?.permissionId === matching.permissionId ? null : current);
          setApprovalDispatch('idle');
          setApprovalFeedback('Core approval state: ' + matching.state.replace(/_/g, ' '));
        } else if (matching?.state === 'pending' && approvalInFlight.current === null) {
          setApprovalDispatch(current => current === 'unknown' || current === 'rejected' ? 'idle' : current);
          setApprovalFeedback('Core confirms the request is still pending. You may decide explicitly.');
        }
      } catch { /* Offline/older Core: retain unresolved decision; never replay. */ }
    };
    void reconcile();
    const timer = window.setInterval(() => { if (!document.hidden) void reconcile(); }, 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [pendingPermission?.permissionId, workspace, activeSessionId]);

  const handlePermissionDecision = (approval: boolean | 'session' | 'always') => {
    if (!pendingPermission || approvalDispatch !== 'idle' || approvalInFlight.current ||
        !ws || ws.readyState !== WebSocket.OPEN ||
        wsRef.current !== ws || !activeSessionId) return;
    if (approval !== 'always') alwaysRuleForAck.current = null;
    if (approval === 'always') {
      if (!window.confirm('Allow this tool automatically for future actions in this workspace? Review tool scope carefully.')) return;
      alwaysRuleForAck.current = {
        permissionId: pendingPermission.permissionId,
        rule: patternFromPermission(pendingPermission),
      };
    }
    approvalInFlight.current = pendingPermission.permissionId;
    setApprovalDispatch('submitting');
    setApprovalFeedback('Decision sent · waiting for Core acknowledgement.');
    try {
      ws.send(JSON.stringify({
        type: 'approve_permission', permissionId: pendingPermission.permissionId,
        approval: approval === 'always' ? true : approval,
      }));
    } catch {
      approvalInFlight.current = null;
      alwaysRuleForAck.current = null;
      setApprovalDispatch('unknown');
      setApprovalFeedback('Dispatch uncertain. Reconcile with Core before another decision.');
    }
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
    // Guard: only allow if the plan card is actually visible and pending
    if (!pendingPlanApproval || !ws) return;
    ws.send(JSON.stringify({ type: 'approve_plan', action }));
    setPendingPlanApproval(false);
  };

  const handleSelectProc = (proc: any) => {
    const saItem: SubAgentItem = {
      id: proc.id || `proc-${proc.pid}`,
      typeName: 'Process',
      role: `Process #${proc.pid} — ${proc.name || proc.commandLine || 'Command'}`,
      status: proc.hasExited ? 'COMPLETED' : (proc.status === 'running' ? 'RUNNING' : proc.status),
      prompt: proc.commandLine || proc.name,
      logs: proc.logs || [],
    };
    setSelectedSubagent(saItem);
  };

  return (
    <div className="calm-chat-workspace flex flex-col h-full w-full bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden font-sans">
      <div className="calm-chat-toolbar flex flex-wrap items-center justify-between px-4 py-2 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] min-h-[48px] w-full gap-3 select-none">
        {/* Left Column: History Toggle & Active Workspace Pill */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            className={`p-2 rounded-lg border border-transparent transition flex items-center justify-center cursor-pointer ${
              showHistorySidebar 
                ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)]' 
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
            title="Toggle Chat History Sidebar"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          {workspace && (
            <span className="text-[11px] py-1 text-[var(--color-primary)] font-mono flex items-center gap-1.5 max-w-[160px] sm:max-w-[220px] truncate">
              <Folder className="w-3 h-3 text-[var(--color-primary)] flex-shrink-0" />
              <span className="truncate">{workspace.split(/[/\\]/).pop()}</span>
            </span>
          )}
        </div>

        {/* Desktop identity: chat first, task delegation second. */}
        <div className="hidden md:flex flex-col items-center justify-center leading-tight">
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-[var(--text-main)]">
            <Sparkles size={13} className="text-[var(--color-primary)]" aria-hidden="true"/>
            T-Line Assistant
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">Chat · Delegate · Review</span>
        </div>

        {/* Right Column: Monitor & Settings Actions */}
        <div className="flex justify-end gap-2 items-center relative">
          <button
            type="button"
            onClick={() => setShowBrainExplorer(open => !open)}
            title="Toggle Brain Explorer"
            aria-label="Toggle Brain Explorer"
            aria-expanded={showBrainExplorer}
            className={`p-2 rounded-lg border transition flex items-center justify-center cursor-pointer ${showBrainExplorer ? 'bg-[var(--color-primary-glow)] border-[var(--color-primary)] text-[var(--color-primary)]' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
          >
            <Brain size={16} />
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-2 rounded-lg border transition flex items-center justify-center cursor-pointer ${
              showSidebar 
                ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300 ' 
                : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-color)]'
            }`}
            title="Toggle Live Monitor Sidebar"
          >
            <Activity className={`w-4 h-4 ${showSidebar ? 'text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className={`p-2 rounded-lg border transition flex items-center justify-center cursor-pointer ${
              showSettingsMenu 
                ? 'bg-[var(--color-primary-glow)] border-[var(--color-primary)] text-[var(--color-primary)] ' 
                : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-color)]'
            }`}
            title="SuperAgent Menu"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <SuperAgentSettingsMenu
            isOpen={showSettingsMenu}
            onClose={() => setShowSettingsMenu(false)}
            workspaces={workspaces}
            workspace={workspace}
            setWorkspace={setWorkspace}
            agentMode={agentMode}
            setAgentMode={selectAgentMode}
            customArgs={customArgs}
            setCustomArgs={setCustomArgs}
            setConnectTrigger={setConnectTrigger}
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            onClearConsole={() => setMessages([{ role: 'system', text: 'Console output cleared.' }])}
            onOpenSettingsModal={handleOpenSettingsModal}
          />
        </div>
      </div>

      <CoreReconnectBanner
        notice={coreReconnectNotice?.sessionId === activeSessionId ? coreReconnectNotice : null}
        canSend={ws?.readyState === WebSocket.OPEN}
        onCheck={() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'core_health_probe', sessionId: activeSessionId }));
          } else {
            setConnectTrigger(n => n + 1);
          }
        }}
        onResume={() => ws?.send(JSON.stringify({
          type: 'resume_session', sessionId: activeSessionId, approved: true,
        }))}
      />

      <div className="flex-1 flex overflow-hidden relative w-full" ref={mainConsoleRef}>
          {showBrainExplorer && (
            <div className="absolute right-0 inset-y-0 z-40 w-full max-w-[760px]">
              <SuperAgentBrainExplorer activeSessionId={activeSessionId} onClose={() => setShowBrainExplorer(false)} />
            </div>
          )}
          {/* Left Resizable Chat History Sidebar */}
          {showHistorySidebar && (
            <div style={{ width: `${historyWidth}px` }} className="superagent-history-panel h-full shrink-0 relative min-w-[160px] max-w-[500px]">
              <SuperAgentHistorySidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                pinnedSessionIds={pinnedSessionIds}
                onTogglePinSession={handleTogglePinSession}
                onSelectSession={handleSelectSessionWrapped}
                onNewChat={handleNewChatWrapped}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                hasMoreSessions={hasMoreSessions}
                loadingMoreSessions={loadingMoreSessions}
                onLoadMoreSessions={loadMoreSessions}
                isProcessing={loading}
              />
            </div>
          )}

          {/* Left Resizer Drag Handle */}
          {showHistorySidebar && (
            <div
              onMouseDown={startResizingLeft}
              className="w-[2px] hover:w-[4px] bg-[var(--border-color)] hover:bg-[var(--color-primary)] cursor-col-resize select-none transition-all duration-150 h-full shrink-0 z-20 active:bg-[var(--color-primary)]"
              title="Drag to resize History panel"
            />
          )}

          <div className="flex-1 flex flex-col h-full overflow-hidden w-full min-w-0 relative">
            <div
              ref={messagesContainerRef}
              className="sa-chat-thread flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs leading-relaxed w-full"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop < 80 && hasMore && !loadingMore) {
                  handleLoadMoreMessagesWithScroll();
                }
                const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                const scrolledUp = distanceToBottom > 150;
                isUserScrolledUpRef.current = scrolledUp;
                setShowScrollBottomBtn(scrolledUp);
              }}
            >
            {/* Infinite scroll: loading older messages indicator */}
            {hasMore ? (
              <div className="flex items-center justify-center py-2 gap-2 text-[var(--text-muted)] text-xs select-none">
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--color-primary)]" />
                    <span>Loading older messages...</span>
                  </>
                ) : (
                  <button
                    onClick={handleLoadMoreMessagesWithScroll}
                    className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors px-3 py-1 rounded border border-[var(--border-color)] hover:border-[var(--color-primary)] bg-[var(--bg-card)] text-[11px]"
                  >
                    ↑ Load older messages
                  </button>
                )}
              </div>
            ) : messages.length > 0 ? (
              <div className="flex items-center justify-center py-2 gap-2 text-[var(--text-muted)]/70 text-[10px] font-sans select-none">
                <span className="w-1 h-1 rounded-full bg-[var(--border-color)]" />
                <span>Beginning of conversation history</span>
                <span className="w-1 h-1 rounded-full bg-[var(--border-color)]" />
              </div>
            ) : null}
            {/* Session ID Badge with Copy Button */}
            {messages.length > 0 && (
              <SessionIdBadge sessionId={activeSessionId} />
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

            {/* Approval action belongs to the session-scoped Agent Timeline, not an unrelated tool log. */}
            {pendingPermission && (
              <button type="button" onClick={() => setApprovalJump(value => value + 1)}
                className="w-full rounded-xl border border-amber-500/45 bg-amber-500/10 px-4 py-3 text-left text-xs text-amber-400 hover:bg-amber-500/15">
                <span className="font-semibold">Action needs approval</span>
                <span className="ml-2">Review the tool, changes and options in Activity Center → Agent timeline.</span>
              </button>
            )}

            {/* Token Usage & Cost Card (B5) */}
            <TokenUsageCard
              tokenUsage={tokenUsage}
              modelName={
                (presets[agentMode] || []).find(
                  p => p.id?.toLowerCase() === (activePresetId[agentMode] || '').toLowerCase() ||
                       p.name?.toLowerCase() === (activePresetId[agentMode] || '').toLowerCase()
                )?.name
              }
            />

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
              <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-sans pl-1 py-1">
                <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary)] animate-pulse" />
                <span>SuperAgent is thinking...</span>
                <span className="flex gap-0.5 items-center">
                  <span className="w-1 h-1 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Floating Jump-to-Bottom button */}
          {showScrollBottomBtn && (
            <button
              onClick={() => {
                isUserScrolledUpRef.current = false;
                setShowScrollBottomBtn(false);
                chatEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
              }}
              className="absolute bottom-16 right-6 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-primary)] text-white  text-xs font-sans hover:opacity-90 transition-all select-none cursor-pointer"
              title="Jump to latest message"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Ke Bawah</span>
            </button>
          )}

          {/* Workspace-scoped retained CLI / daemon / Muse task monitor. */}
          <SuperAgentTaskMonitor key={workspace + '::' + activeSessionId}
            workspace={workspace} sessionId={activeSessionId} />
          <AssistantActivityCenter key={'activity::' + workspace + '::' + activeSessionId}
            workspace={workspace} sessionId={activeSessionId}
            messages={messages} subagents={timelineSubagents}
            pendingPermission={pendingPermission} onPermissionDecision={handlePermissionDecision}
            approvalSubmitting={approvalDispatch !== 'idle'} approvalFeedback={approvalFeedback}
            connected={Boolean(ws && ws.readyState === WebSocket.OPEN)} approvalJump={approvalJump}
            handoff={delegateHandoff?.workspace === workspace && delegateHandoff?.sessionId === activeSessionId
              ? delegateHandoff : null}
            onDraftCreated={submitted => setInput(previous =>
              previous.trim() === submitted ? '' : previous)} />

          {/* Active Tasks Widget — pinned above input, outside scroll area */}
          <ActiveTasksBar
            subagents={subagentList}
            procs={procList}
            checklistTasks={checklistTasks}
            toolProgressMsg={toolProgressMsg}
            onSelectSubAgent={(sa) => setSelectedSubagent(sa)}
            onSelectProc={handleSelectProc}
          />

            <SuperAgentInputContainer
              input={input}
              setInput={setInput}
              handleKeyDown={handleKeyDown}
              handleSend={handleSend}
              handleAbort={handleAbort}
              canDelegateAsTask={Boolean(workspace && activeSessionId &&
                sessions.some(session => session.id === activeSessionId))}
              onDelegateAsTask={() => {
                if (!input.trim() || attachments.length || !workspace || !activeSessionId ||
                    !sessions.some(session => session.id === activeSessionId)) return;
                setDelegateHandoff(previous => ({
                  id: (previous?.id ?? 0) + 1,
                  text: input, workspace, sessionId: activeSessionId,
                }));
              }}
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
              showSuggestions={showSuggestions}
              suggestions={suggestions}
              suggestionIndex={suggestionIndex}
              setSuggestionIndex={setSuggestionIndex}
              handleSelectSuggestion={handleSelectSuggestion}
            />
          </div>

          {/* Right Resizer Drag Handle */}
          {showSidebar && (
            <div
              onMouseDown={startResizingRight}
              className="w-[2px] hover:w-[4px] bg-[var(--border-color)] hover:bg-[var(--color-primary)] cursor-col-resize select-none transition-all duration-150 h-full shrink-0 z-20 active:bg-[var(--color-primary)]"
              title="Drag to resize Monitor panel"
            />
          )}

          {/* Right Resizable Live Monitor Sidebar */}
          {showSidebar && (
            <div style={{ width: `${monitorWidth}px` }} className="superagent-monitor-panel h-full shrink-0 relative min-w-[180px] max-w-[600px]">
              <SuperAgentSidebar
                workspacePath={workspace}
                getAuthHeader={getAuthHeader}
                subagents={subagentList}
                procs={procList}
                recentChanges={recentChangeList}
                bgTasks={bgTaskList}
                browserInstances={browserInstanceList}
                onSelectSubAgent={(sa) => setSelectedSubagent(sa)}
                onSelectProc={handleSelectProc}
                onKillBgTask={async (taskId) => {
                  try {
                    await fetch(`/api/superagent/background-tasks/${encodeURIComponent(taskId)}`, {
                      method: 'DELETE',
                      headers: getAuthHeader()
                    });
                    fetchMonitorData();
                  } catch (e) {}
                }}
                onRefreshData={fetchMonitorData}
                isLoadingData={isLoadingMonitor}
                onOpenFile={onOpenFile}
                onOpenDiffTab={onOpenDiffTab}
              />
            </div>
          )}

          {/* Drag Overlay to prevent mouse event loss */}
          {(isResizingLeft || isResizingRight) && (
            <div className="fixed inset-0 z-50 cursor-col-resize select-none bg-transparent" />
          )}
        </div>

      {/* Subagent / Process Live Terminal Output Modal */}
      {selectedSubagent && (
        <SubAgentTerminalModal
          subagent={
            subagentList.find(sa => sa.id === selectedSubagent.id) ||
            (() => {
              const foundProc = procList.find(p => (p.id && p.id === selectedSubagent.id) || `proc-${p.pid}` === selectedSubagent.id);
              if (foundProc) {
                return {
                  id: foundProc.id || `proc-${foundProc.pid}`,
                  typeName: 'Process',
                  role: `Process #${foundProc.pid} — ${foundProc.name || foundProc.commandLine || 'Command'}`,
                  status: foundProc.hasExited ? 'COMPLETED' : (foundProc.status === 'running' ? 'RUNNING' : foundProc.status),
                  prompt: foundProc.commandLine || foundProc.name,
                  logs: foundProc.logs || [],
                } as SubAgentItem;
              }
              return selectedSubagent;
            })()
          }
          onClose={() => setSelectedSubagent(null)}
        />
      )}

      {/* SuperAgent Unified Settings Modal */}
      <SuperAgentSettingsModal
        isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)}
        workspaces={workspaces} workspace={workspace} setWorkspace={setWorkspace}
        agentMode={agentMode} setAgentMode={selectAgentMode}
        customArgs={customArgs} setCustomArgs={setCustomArgs}
        setConnectTrigger={setConnectTrigger}
        showSidebar={showSidebar} setShowSidebar={setShowSidebar}
        onRefreshMonitor={fetchMonitorData} isLoadingMonitor={isLoadingMonitor}
        onClearConsole={() => setMessages([{ role: 'system', text: 'Console output cleared.' }])}
        providers={providers} activeProviderId={activeProviderId}
        onSaveProvider={handleSaveProvider} onDeleteProvider={handleDeleteProvider}
        onSetActiveProvider={handleSetActiveProvider}
        presets={presets} activePresetId={activePresetId}
        onSelectPreset={handlePresetChange} onSaveCustomPreset={handleSaveCustomPreset}
        onDeleteCustomPreset={handleDeleteCustomPreset} getAuthHeader={getAuthHeader}
        defaultTab={settingsModalTab}
      />
    </div>
  );
}
