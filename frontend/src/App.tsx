import { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { 
  Folder, 
  Plus, 
  Terminal as TerminalIcon, 
  LogOut, 
  Loader2, 
  Menu as MenuIcon,
  GitCompare,
  GitBranch,
  FolderTree,
  Settings,
  FileCode,
  Keyboard,
  MoreVertical,
  HelpCircle,
  ChevronDown,
  Camera,
  LayoutGrid,
  Zap,
  X,
  Globe,
  ExternalLink,
  Lock
} from 'lucide-react';
import { wsManager } from './services/websocket';
import { FileViewerTab } from './components/FileViewerTab';
import { DiffViewerTab } from './components/DiffViewerTab';
import { TerminalGridTab } from './components/TerminalGridTab';
import BrowserTab from './components/BrowserTab';
import { SetupSecurityForm, LoginForm } from './components/AuthForms';
import { WorkspaceAddModal, WorktreeAddModal, TunnelSetupModal, SettingsModal, ShortcutHelpModal, ConfirmModal, WorkspaceEditModal, SavePromptModal, SelectGridModal } from './components/Modals';

interface SavedPrompt {
  id: string;
  name: string;
  command: string;
  cwd: string;
  shellType: string;
}
import { BranchModal } from './components/BranchModal';
import { useTunnel } from './hooks/useTunnel';
import { useSystemStats } from './hooks/useSystemStats';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useUpdateChecker } from './hooks/useUpdateChecker';
import { useThemeAndFonts } from './hooks/useThemeAndFonts';
import { useTabUiHandlers } from './hooks/useTabUiHandlers';
import { useAuth } from './hooks/useAuth';
import { useTerminals, WorkspaceInfo, TabData, getTerminalIds } from './hooks/useTerminals';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SplitLayoutRenderer } from './components/SplitLayoutRenderer';
import { Footer } from './components/Footer';
import { TabsDropdown } from './components/TabsDropdown';
import { EmptyDashboard } from './components/EmptyDashboard';
import { MobileKeyboard } from './components/MobileKeyboard';
import { useLayoutHelpers } from './hooks/useLayoutHelpers';
import { SidebarContentPanel } from './components/SidebarContentPanel';
import { RightSidebar } from './components/RightSidebar';
import { UpdateNotification } from './components/UpdateNotification';
import { useGitStatus } from './hooks/useGitStatus';
import { useConfirmDialog } from './hooks/useConfirmDialog';
import { useWorkspaceHandlers, getTabWorktreePath } from './hooks/useWorkspaceHandlers';
import { TPlusLogo } from './components/TPlusLogo';
import { TabTooltip, TabContextMenu } from './components/TabUiComponents';
import { getRuntimeSearchParams } from './utils/runtimeQuery';

function normalizeLayout(node: any): any {
  if (!node) return null;
  if (node.type === 'leaf') {
    return {
      type: 'leaf',
      terminalId: node.terminalId || ''
    };
  }
  return {
    type: 'split',
    direction: node.direction || 'horizontal',
    first: normalizeLayout(node.first),
    second: normalizeLayout(node.second),
    firstSize: typeof node.firstSize === 'number' ? Math.round(node.firstSize * 100) / 100 : undefined,
    secondSize: typeof node.secondSize === 'number' ? Math.round(node.secondSize * 100) / 100 : undefined
  };
}

function toCanonicalString(state: any): string {
  if (!state) return '';
  
  // Normalize tabs
  const tabs = (state.tabs || []).map((t: any) => ({
    id: t.id,
    name: t.name || '',
    type: t.type || '',
    filePath: t.filePath || '',
    url: t.url || '',
    commitHash: t.commitHash || '',
    worktreePath: t.worktreePath || '',
    compareWithWorktree: !!t.compareWithWorktree,
    layout: normalizeLayout(t.layout),
    focusedTerminalId: t.focusedTerminalId || '',
    workspaceId: t.workspaceId || '',
    gridTerminalIds: Array.isArray(t.gridTerminalIds) ? [...t.gridTerminalIds].sort() : [],
    gridCardHeight: t.gridCardHeight || 0,
    gridCardWidth: t.gridCardWidth || 0,
    isDetached: !!t.isDetached
  }));

  // Normalize terminalInstances (sort keys to be order-independent)
  const terminalInstances: Record<string, any> = {};
  const instKeys = Object.keys(state.terminalInstances || {}).sort();
  for (const k of instKeys) {
    const inst = state.terminalInstances[k];
    terminalInstances[k] = {
      id: inst.id,
      name: inst.name || '',
      initialName: inst.initialName || '',
      cwd: inst.cwd || '',
      shellType: inst.shellType || ''
      // Note: initialCommand is intentionally excluded from sync state.
      // It is ephemeral and only valid during the initial local terminal creation.
    };
  }

  // Normalize savedPrompts
  const savedPrompts = (state.savedPrompts || []).map((p: any) => ({
    id: p.id,
    name: p.name || '',
    command: p.command || '',
    cwd: p.cwd || '',
    shellType: p.shellType || ''
  }));

  return JSON.stringify({
    tabs,
    terminalInstances,
    savedPrompts
  });
}

export default function App() {
  const detachedTabId = useMemo(() => {
    const urlParams = getRuntimeSearchParams();
    return urlParams.get('detachedTabId');
  }, []);

  const buildDetachedTabQuery = (tabId: string) => {
    const params = new URLSearchParams();
    const token = localStorage.getItem('token') || '';
    if (token) {
      params.set('token', token);
    }
    params.set('detachedTabId', tabId);
    return params.toString();
  };

  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    fontSans,
    setFontSans,
    fontMono,
    setFontMono,
    fontSansWeight,
    setFontSansWeight,
    fontMonoWeight,
    setFontMonoWeight,
    THEMES,
    MONO_FONTS
  } = useThemeAndFonts();

  const {
    setupRequired,
    isAuthenticated,
    authError,
    password,
    setPassword,
    loading,
    handleSetup,
    handleLogin,
    handleLogout
  } = useAuth();
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('tline-sidebar-width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('tline-sidebar-collapsed');
    return saved === 'true';
  });

  // Unified Alert/Confirm Dialog State via hook
  const { confirmDialog, showAlert, showConfirm } = useConfirmDialog();
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [rightMenuOpen, setRightMenuOpen] = useState<boolean>(false);
  const [showShortcutModal, setShowShortcutModal] = useState<boolean>(false);
  const [showBranchModal, setShowBranchModal] = useState<boolean>(false);

  // Sync state refs (Option A)
  const lastSyncState = useRef<string>('');
  const hasFetchedSyncState = useRef<boolean>(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() => {
    try {
      const saved = localStorage.getItem('tline-saved-prompts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showSavePromptModal, setShowSavePromptModal] = useState<boolean>(false);
  const [showSelectGridModal, setShowSelectGridModal] = useState<boolean>(false);
  const [pendingSavedPrompt, setPendingSavedPrompt] = useState<SavedPrompt | null>(null);
  const [showQuickLaunchDropdown, setShowQuickLaunchDropdown] = useState<boolean>(false);
  const [savePromptDefaultCwd, setSavePromptDefaultCwd] = useState<string>('');
  const [savePromptDefaultShell, setSavePromptDefaultShell] = useState<string>('powershell');
  const [savePromptInitialName, setSavePromptInitialName] = useState<string>('');
  // Workspace editing states will be provided by useWorkspaceHandlers hook

  const [showMobileKeyboard, setShowMobileKeyboard] = useState<boolean>(false);
  const {
    appVersion,
    latestVersion,
    updateAvailable,
    fetchLocalVersion
  } = useUpdateChecker();

  // Workspaces Hook
  const {
    workspaces,
    fetchWorkspaces,
    showWorkspaceModal,
    setShowWorkspaceModal,
    newWorkspacePath,
    setNewWorkspacePath,
    newWorkspaceShell,
    setNewWorkspaceShell,
    showFolderExplorer,
    setShowFolderExplorer,
    explorerPath,
    explorerDirs,
    explorerParent,
    fetchDirectoryList,
    handleFolderBrowse,
    handleAddWorkspace,
    handleRemoveWorkspace: rawHandleRemoveWorkspace,
    showWorktreeModal,
    setShowWorktreeModal,
    newWorktreePath,
    setNewWorktreePath,
    newWorktreeBranch,
    setNewWorktreeBranch,
    isNewBranch,
    setIsNewBranch,
    newLocalBranchName,
    setNewLocalBranchName,
    repoBranches,
    gitLoading,
    handleOpenWorktreeModal,
    handleAddWorktree,
    handleRemoveWorktree,
    handleUpdateWorkspace,
    deletingWorkspacePaths,
    deletingWorktreePaths
  } = useWorkspaces(isAuthenticated, localStorage.getItem('token'), showAlert);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Tunnel Hook
  const {
    tunnelStatus,
    showTunnelModal,
    setShowTunnelModal,
    tunnelToken,
    setTunnelToken,
    tunnelLoading,
    fetchTunnelStatus,
    handleStartTunnel,
    handleStartTokenTunnel,
    handleStopTunnel
  } = useTunnel(isAuthenticated, showAlert);

  // System statistics hook
  const systemStats = useSystemStats(isAuthenticated);

  // Lazy-mount tracking: only add a BrowserTab to the DOM the first time it becomes active.
  // This prevents native WebView2 instances from being created for every browser tab upfront.
  const [mountedBrowserTabIds, setMountedBrowserTabIds] = useState<Set<string>>(new Set());

  // Active panel state: 'workspaces' | 'explorer' | 'changes' | 'checkpoints'
  const [activePanel, setActivePanel] = useState<'workspaces' | 'explorer' | 'changes' | 'checkpoints' | 'tabs'>('workspaces');
  const [panelWorkspace, setPanelWorkspace] = useState<WorkspaceInfo | null>(null);

  const activeWorkspacePrompts = useMemo(() => {
    if (!panelWorkspace) return savedPrompts;
    const wsPath = panelWorkspace.path.toLowerCase().replace(/\\/g, '/');
    return savedPrompts.filter(p => {
      const pCwd = p.cwd.toLowerCase().replace(/\\/g, '/');
      return pCwd.startsWith(wsPath);
    });
  }, [savedPrompts, panelWorkspace]);
  const [panelWorktreePath, setPanelWorktreePath] = useState<string | null>(null);
  const [showTabsDropdown, setShowTabsDropdown] = useState<boolean>(false);

  const [quickCreating, setQuickCreating] = useState(false);
  const handleQuickSnapshot = async (force = false) => {
    if (!panelWorkspace) {
      showAlert('Error', 'Please select a workspace first.');
      return;
    }
    if (!panelWorkspace.isGit) {
      showAlert('Error', 'Current workspace is not a Git repository.');
      return;
    }

    setQuickCreating(true);
    try {
      const token = localStorage.getItem('token');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const name = `Quick Snapshot (${timeStr})`;
      const description = 'Automatically generated quick snapshot';

      const res = await fetch(`/api/workspaces/${panelWorkspace.id}/checkpoints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          worktreePath: panelWorktreePath,
          name,
          description,
          force
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert('Success', `Quick snapshot '${name}' created successfully!`);
        fetchGitStatus(true);
        window.dispatchEvent(new CustomEvent('tline-checkpoints-refresh'));
      } else if (data.hasLargeFiles) {
        showConfirm(
          'Large Files Detected',
          data.output,
          () => {
            handleQuickSnapshot(true);
          },
          'danger',
          'Create Snapshot Anyway'
        );
      } else {
        showAlert('Error', data.output || 'Failed to create snapshot.');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Error creating quick snapshot.');
    } finally {
      setQuickCreating(false);
    }
  };

  useEffect(() => {
    if (!showTabsDropdown) return;
    const closeDropdown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.tabs-dropdown-btn') || target.closest('.dropdown-menu')) {
        return;
      }
      setShowTabsDropdown(false);
    };
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, [showTabsDropdown]);

  // Terminal state management hook
  const {
    tabs,
    setTabs,
    terminalInstances,
    setTerminalInstances,
    activeTabId,
    setActiveTabId,
    workspaceActiveTab,
    setWorkspaceActiveTab,
    terminalFontSize,
    setTerminalFontSize,
    defaultShell,
    setDefaultShell,
    handleZoomIn,
    handleZoomOut,
    openTerminal,
    openFileTab,
    openDiffTab,
    openBrowserTab,
    openGridTab,
    closeTerminal,
    closePane,
    splitFocusedTerminal,
    focusTerminal,
    handleTitleChange,
    handleActiveProcessesChange,
    importActiveSessions,
    refreshTerminal,
    refreshTriggers,
    clearInitialCommand,
    updateTabLayout
  } = useTerminals(workspaces, () => setSidebarOpen(false));

  // NOTE: These effects depend on activeTabId and tabs from useTerminals above,
  // so they must appear AFTER that hook call to avoid a temporal dead zone error.
  useEffect(() => {
    if (!activeTabId) return;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab?.type === 'browser' && !activeTab.isDetached) {
      setMountedBrowserTabIds(prev => {
        if (prev.has(activeTabId)) return prev;
        const next = new Set(prev);
        next.add(activeTabId);
        return next;
      });
    }
  }, [activeTabId, tabs]);

  // Prune mountedBrowserTabIds when a browser tab is closed
  useEffect(() => {
    setMountedBrowserTabIds(prev => {
      const browserTabIds = new Set(tabs.filter(t => t.type === 'browser').map(t => t.id));
      const pruned = new Set([...prev].filter(id => browserTabIds.has(id)));
      return pruned.size !== prev.size ? pruned : prev;
    });
  }, [tabs]);

  const tabsRef = useRef(tabs);
  const terminalInstancesRef = useRef(terminalInstances);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    terminalInstancesRef.current = terminalInstances;
  }, [terminalInstances]);

  // Listen for terminal link click event to open inside t-line browser tab
  useEffect(() => {
    const handleOpenBrowserTab = (e: Event) => {
      const customEvent = e as CustomEvent<{ url: string }>;
      const { url } = customEvent.detail;
      if (url) {
        openBrowserTab(url, 'Preview', panelWorkspace?.id);
      }
    };
    window.addEventListener('tline-open-browser-tab', handleOpenBrowserTab);
    return () => {
      window.removeEventListener('tline-open-browser-tab', handleOpenBrowserTab);
    };
  }, [openBrowserTab, panelWorkspace?.id]);

  // Listen for terminal file path click event to open as a file tab
  useEffect(() => {
    const handleOpenFileLink = async (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; terminalId: string; cwd: string }>;
      let { path: filePath, cwd } = customEvent.detail;
      if (!filePath) return;

      // Extract line number if present, e.g. "src/App.tsx:123" or "src/App.tsx:123:45"
      let lineNum: number | undefined;
      const colonIndex = filePath.indexOf(':');
      if (colonIndex !== -1) {
        const parts = filePath.split(':');
        filePath = parts[0];
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          lineNum = num;
        }
      }

      // If the path is relative, resolve it relative to terminal's reported cwd or initial tab cwd
      let absolutePath = filePath;
      const isAbsolute = /^(?:\/|[a-zA-Z]:)/.test(filePath);
      if (!isAbsolute) {
        const inst = terminalInstancesRef.current[customEvent.detail.terminalId];
        const baseCwd = inst?.cwd || cwd || panelWorkspace?.path || '';
        if (baseCwd) {
          const separator = baseCwd.includes('\\') ? '\\' : '/';
          let cleanRel = filePath;
          if (cleanRel.startsWith('./')) {
            cleanRel = cleanRel.substring(2);
          }
          let baseParts = baseCwd.split(/[/\\]/);
          while (cleanRel.startsWith('../')) {
            cleanRel = cleanRel.substring(3);
            baseParts.pop();
          }
          absolutePath = baseParts.join(separator) + separator + cleanRel;
        }
      }

      // Set pending line focus before opening file tab
      if (lineNum !== undefined) {
        (window as any).__PENDING_LINE_FOCUS__ = { filePath: absolutePath, line: lineNum };
        // Also dispatch custom event immediately in case the file is already open
        window.dispatchEvent(new CustomEvent('tline-focus-editor-line', {
          detail: { filePath: absolutePath, line: lineNum }
        }));
      }

      const name = absolutePath.split(/[/\\]/).pop() || absolutePath;
      openFileTab(absolutePath, name);
    };
    window.addEventListener('tline-open-file-path', handleOpenFileLink);
    return () => {
      window.removeEventListener('tline-open-file-path', handleOpenFileLink);
    };
  }, [openFileTab, panelWorkspace]);

  // Listen for terminal selection event from system tray
  useEffect(() => {
    if ((window as any).__TAURI__?.event?.listen) {
      let unlisten: (() => void) | null = null;

      const setupListener = async () => {
        try {
          const unsub = await (window as any).__TAURI__.event.listen(
            'select-terminal',
            async (event: any) => {
              const { pid, terminalId } = event.payload;
              
              let targetTermId = terminalId;
              if (!targetTermId) {
                const inst = Object.values(terminalInstancesRef.current).find((t: any) => t.pid === pid);
                if (inst) {
                  targetTermId = inst.id;
                }
              }

              if (!targetTermId) return;

              const foundTab = tabsRef.current.find((t) => {
                if (t.type === 'terminal' && t.layout) {
                  try {
                    return getTerminalIds(t.layout).includes(targetTermId!);
                  } catch (_) {}
                }
                if (t.type === 'grid' && t.gridTerminalIds) {
                  return t.gridTerminalIds.includes(targetTermId!);
                }
                return false;
              });

              if (foundTab) {
                setActiveTabId(foundTab.id);

                if (foundTab.type === 'terminal') {
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === foundTab.id ? { ...t, focusedTerminalId: targetTermId } : t
                    )
                  );
                }

                if (foundTab.isDetached) {
                  (window as any).__TAURI__.core.invoke('focus_window', {
                    label: `browser-detached-${foundTab.id}`,
                  }).catch(() => {});
                }
              }
            }
          );
          unlisten = unsub;
        } catch (err) {
          console.error('Failed to setup select-terminal listener:', err);
        }
      };

      setupListener();

      return () => {
        if (unlisten) unlisten();
      };
    }
  }, []);

  // --- Detached Tab Effects ---
  useEffect(() => {
    if (detachedTabId) {
      const tabExists = tabs.some(t => t.id === detachedTabId);
      if (tabs.length > 0 && !tabExists) {
        if ((window as any).__TAURI__) {
          const getCurrentWindow = (window as any).__TAURI__?.window?.getCurrentWindow;
          if (getCurrentWindow) {
            getCurrentWindow().close();
          } else {
            import('@tauri-apps/api/window').then(({ getCurrentWindow: getWin }) => {
              getWin().close();
            }).catch(err => console.error(err));
          }
        }
      }
    }
  }, [tabs, detachedTabId]);

  useEffect(() => {
    if (!detachedTabId) return;

    const handleBeforeUnload = () => {
      try {
        const savedTabs = localStorage.getItem('tline-tabs-v2');
        if (savedTabs) {
          const parsed = JSON.parse(savedTabs);
          const updated = parsed.map((t: any) => 
            t.id === detachedTabId ? { ...t, isDetached: false } : t
          );
          localStorage.setItem('tline-tabs-v2', JSON.stringify(updated));
        }
      } catch (err) {
        console.error(err);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [detachedTabId]);

  useEffect(() => {
    if (!detachedTabId) {
      try {
        const savedTabs = localStorage.getItem('tline-tabs-v2');
        if (savedTabs) {
          const parsed = JSON.parse(savedTabs);
          const cleaned = parsed.map((t: any) => ({ ...t, isDetached: false }));
          setTabs(cleaned);
          localStorage.setItem('tline-tabs-v2', JSON.stringify(cleaned));
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, [detachedTabId, setTabs]);

  const filteredTabs = useMemo(() => {
    const getPathWorkspaceId = (path: string) => {
      if (!path) return undefined;
      const normPath = path.toLowerCase().replace(/\\/g, '/');
      const match = workspaces.find(w => {
        const normWs = w.path.toLowerCase().replace(/\\/g, '/');
        return normPath === normWs || normPath.startsWith(normWs + '/');
      });
      return match?.id;
    };

    const isGridMatching = (t: TabData, wsId?: string) => {
      if (t.type !== 'grid') return false;
      if (t.workspaceId) {
        return wsId ? t.workspaceId === wsId : false;
      }
      const termIds = t.gridTerminalIds || [];
      if (termIds.length === 0) {
        return !wsId;
      }
      return termIds.some(tid => {
        const inst = terminalInstances[tid];
        if (!inst || !inst.cwd) return false;
        const termWsId = getPathWorkspaceId(inst.cwd);
        return wsId ? termWsId === wsId : !termWsId;
      });
    };

    if (!panelWorkspace) {
      // When no workspace is selected, show tabs without a workspace or grid tabs matching no-workspace.
      // Also include the currently active tab (even if it has a workspaceId) to
      // prevent it from disappearing right after openTerminal sets activeTabId
      // before the panelWorkspace useEffect has a chance to fire.
      return tabs.filter(t => 
        (!t.workspaceId && t.type !== 'grid') || 
        (t.type === 'grid' && isGridMatching(t)) || 
        t.id === activeTabId
      );
    }
    const wsTabs = tabs.filter(t => 
      t.workspaceId === panelWorkspace.id || 
      (t.type === 'grid' && isGridMatching(t, panelWorkspace.id))
    );

    if (panelWorktreePath) {
      // In worktree mode, filter tabs to show only those belonging to that specific worktree.
      // File tabs (type === 'file') are always shown in the active worktree view because
      // they may have been opened from the Git Changes panel and their path may span the workspace.
      return wsTabs.filter(t => {
        if (t.type === 'file') return true;

        const matchedWtPath = getTabWorktreePath(t, panelWorkspace, terminalInstances);
        const wtObj = panelWorkspace.worktrees?.find(wt => wt.path === matchedWtPath);
        const isMainTab = !matchedWtPath || (wtObj && wtObj.isMain);

        const targetWtObj = panelWorkspace.worktrees?.find(wt => wt.path === panelWorktreePath);
        const isTargetMain = !panelWorktreePath || (targetWtObj && targetWtObj.isMain);

        if (isTargetMain) {
          return isMainTab;
        }
        return matchedWtPath === panelWorktreePath;
      });
    }

    // In workspace mode (panelWorktreePath === null), display all tabs but group them by worktree.
    // The sorting order matches the order of worktrees in panelWorkspace.worktrees.
    const getTabWtIndex = (t: TabData) => {
      const wtPath = getTabWorktreePath(t, panelWorkspace, terminalInstances);
      const wts = panelWorkspace.worktrees || [];
      if (!wtPath) return wts.length; // place tabs without a worktree at the end
      return wts.findIndex(wt => wt.path === wtPath);
    };

    return [...wsTabs].sort((a, b) => getTabWtIndex(a) - getTabWtIndex(b));
  }, [tabs, panelWorkspace, panelWorktreePath, terminalInstances, activeTabId]);

  const visibleTabs = useMemo(() => {
    const MAX_VISIBLE_TABS = 7;
    if (filteredTabs.length <= MAX_VISIBLE_TABS) {
      return filteredTabs;
    }
    
    const activeIndex = filteredTabs.findIndex(t => t.id === activeTabId);
    if (activeIndex === -1 || activeIndex < MAX_VISIBLE_TABS) {
      return filteredTabs.slice(0, MAX_VISIBLE_TABS);
    }
    
    return [
      ...filteredTabs.slice(0, MAX_VISIBLE_TABS - 1),
      filteredTabs[activeIndex]
    ];
  }, [filteredTabs, activeTabId]);

  const {
    activeTooltip,
    tabContextMenu,
    setTabContextMenu,
    getTabGitBranch,
    handleTabMouseEnter,
    handleTabMouseLeave,
    handleTabClick,
    handleTabContextMenu,
    handleTabMouseDown,
    handleCloseOtherTabs,
    handleCloseAllTabs,
    moveTab,
    draggingTabId,
    dragOverTabId,
    dragOverSide
  } = useTabUiHandlers({
    tabs,
    setTabs,
    filteredTabs,
    activeTabId,
    setActiveTabId,
    terminalInstances,
    setTerminalInstances,
    workspaces,
    panelWorkspace
  });

  const { startResizing } = useLayoutHelpers(
    sidebarWidth,
    setSidebarWidth,
    tabs,
    setTabs,
    activeTabId
  );

  // Git status state via hook
  const { changedFiles, gitStatusLoading, fetchGitStatus } = useGitStatus(panelWorkspace, panelWorktreePath);

  // Listen to zoom events dispatched from terminal status bar
  useEffect(() => {
    const handleZoomEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ direction: 'in' | 'out' }>).detail;
      if (detail?.direction === 'in') handleZoomIn();
      else if (detail?.direction === 'out') handleZoomOut();
    };
    window.addEventListener('tline-zoom', handleZoomEvent);
    return () => window.removeEventListener('tline-zoom', handleZoomEvent);
  }, [handleZoomIn, handleZoomOut]);

  // Listen to terminal focus events to show virtual touch keyboard on mobile
  useEffect(() => {
    const handleFocusEvent = () => {
      setShowMobileKeyboard(true);
    };
    window.addEventListener('tline-terminal-focus', handleFocusEvent);
    return () => window.removeEventListener('tline-terminal-focus', handleFocusEvent);
  }, []);

  const [fsChangeTrigger, setFsChangeTrigger] = useState<number>(0);

  // Global WebSocket listener for file system changes
  useEffect(() => {
    wsManager.subscribe('global', (payload) => {
      if (payload.type === 'fs-change') {
        fetchGitStatus(false);
        fetchWorkspaces();
        setFsChangeTrigger(prev => prev + 1);
      }
    });
    return () => {
      wsManager.removeListener('global');
    };
  }, [fetchGitStatus, fetchWorkspaces]);

  // Sync file explorer trigger when git changes change
  useEffect(() => {
    setFsChangeTrigger(prev => prev + 1);
  }, [changedFiles]);


  // Workspace and worktree handlers hook
  const {
    editingWorkspace,
    setEditingWorkspace,
    showEditWorkspaceModal,
    setShowEditWorkspaceModal,
    handleRemoveWorkspace,
    handleRemoveWorktreeWrapped,
    handleOpenEditWorkspaceModal,
    handleUpdateWorkspaceSubmit,
    handleWorkspaceClick,
    handleWorktreeClick,
    handleBranchCheckoutClick
  } = useWorkspaceHandlers({
    rawHandleRemoveWorkspace,
    handleRemoveWorktree,
    handleUpdateWorkspace,
    workspaces,
    tabs,
    setTabs,
    terminalInstances,
    setTerminalInstances,
    activeTabId,
    setActiveTabId,
    workspaceActiveTab,
    setWorkspaceActiveTab,
    openTerminal,
    closeTerminal,
    setPanelWorkspace,
    showConfirm,
    showAlert,
    setSidebarOpen,
    panelWorkspace,
    panelWorktreePath,
    setPanelWorktreePath
  });

  const handleSavePromptSubmit = (name: string, command: string, cwd: string, shellType: string) => {
    const newPrompt: SavedPrompt = {
      id: `prompt-${Date.now()}`,
      name,
      command,
      cwd,
      shellType
    };
    const next = [...savedPrompts, newPrompt];
    setSavedPrompts(next);
    localStorage.setItem('tline-saved-prompts', JSON.stringify(next));
    setShowSavePromptModal(false);
    window.dispatchEvent(new CustomEvent('tline-toast', {
      detail: { message: `Shortcut "${name}" saved!` }
    }));
  };

  const handleDeleteSavedPrompt = (id: string) => {
    const next = savedPrompts.filter(p => p.id !== id);
    setSavedPrompts(next);
    localStorage.setItem('tline-saved-prompts', JSON.stringify(next));
  };

  const activeGridTabs = useMemo(() => {
    return tabs
      .filter(t => t.type === 'grid')
      .map(t => ({
        id: t.id,
        name: t.name,
        activeTerminalCount: t.gridTerminalIds?.length || 0
      }));
  }, [tabs]);

  const handleSelectGridSubmit = (targetGridId: string | 'new') => {
    if (!pendingSavedPrompt) return;
    console.log(`[QuickLaunch] Redirecting shortcut to grid option "${targetGridId}": name="${pendingSavedPrompt.name}", command="${pendingSavedPrompt.command}"`);
    openTerminal(
      pendingSavedPrompt.name, 
      pendingSavedPrompt.cwd, 
      pendingSavedPrompt.shellType, 
      pendingSavedPrompt.command, 
      targetGridId === 'new' ? 'new' : targetGridId
    );
    setShowSelectGridModal(false);
    setPendingSavedPrompt(null);
  };

  const handleRunSavedPrompt = (prompt: SavedPrompt) => {
    console.log(`[QuickLaunch] Clicked shortcut: name="${prompt.name}", command="${prompt.command}", cwd="${prompt.cwd}", shellType="${prompt.shellType}"`);
    const gridTabs = tabs.filter(t => t.type === 'grid');
    if (gridTabs.length > 1) {
      console.log(`[QuickLaunch] Multiple grid tabs found (${gridTabs.length}). Showing grid selection modal.`);
      setPendingSavedPrompt(prompt);
      setShowSelectGridModal(true);
    } else {
      // 0 or 1 grid tabs: auto-insert or auto-create grid tab
      openTerminal(prompt.name, prompt.cwd, prompt.shellType, prompt.command, true);
    }
  };

  useEffect(() => {
    if (!showQuickLaunchDropdown) return;
    const handleClickOutside = () => setShowQuickLaunchDropdown(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showQuickLaunchDropdown]);

  useEffect(() => {
    const isAnyOverlayActive = !!(
      showWorkspaceModal ||
      showWorktreeModal ||
      showTunnelModal ||
      showSettingsModal ||
      showBranchModal ||
      showEditWorkspaceModal ||
      showSavePromptModal ||
      showSelectGridModal ||
      showShortcutModal ||
      showQuickLaunchDropdown ||
      showTabsDropdown ||
      tabContextMenu ||
      rightMenuOpen
    );
    window.dispatchEvent(new CustomEvent('tline-hide-native-webview', { detail: { hide: isAnyOverlayActive } }));
  }, [
    showWorkspaceModal,
    showWorktreeModal,
    showTunnelModal,
    showSettingsModal,
    showBranchModal,
    showEditWorkspaceModal,
    showSavePromptModal,
    showSelectGridModal,
    showShortcutModal,
    showQuickLaunchDropdown,
    showTabsDropdown,
    tabContextMenu,
    rightMenuOpen
  ]);

  // Keyboard Shortcuts
  const hasModals = showWorkspaceModal || showWorktreeModal || showTunnelModal || showSettingsModal || showBranchModal;
  useKeyboardShortcuts({
    enabled: isAuthenticated && !hasModals,
    onNewTerminal: () => openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || ''),
    onQuickSnapshot: () => handleQuickSnapshot(),
    onCloseTab: () => {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab) {
        if (activeTab.type === 'terminal' && activeTab.focusedTerminalId && activeTab.layout && activeTab.layout.type !== 'leaf') {
          closePane(activeTab.focusedTerminalId);
        } else {
          closeTerminal(activeTabId);
        }
      }
    },
    onNextTab: () => {
      const activeWorkspaceTabs = tabs.filter(t => t.workspaceId === panelWorkspace?.id);
      const idx = activeWorkspaceTabs.findIndex(t => t.id === activeTabId);
      if (idx !== -1 && activeWorkspaceTabs.length > 1) {
        setActiveTabId(activeWorkspaceTabs[(idx + 1) % activeWorkspaceTabs.length].id);
      }
    },
    onPrevTab: () => {
      const activeWorkspaceTabs = tabs.filter(t => t.workspaceId === panelWorkspace?.id);
      const idx = activeWorkspaceTabs.findIndex(t => t.id === activeTabId);
      if (idx !== -1 && activeWorkspaceTabs.length > 1) {
        setActiveTabId(activeWorkspaceTabs[(idx - 1 + activeWorkspaceTabs.length) % activeWorkspaceTabs.length].id);
      }
    },
    onJumpToTab: (index) => {
      const activeWorkspaceTabs = tabs.filter(t => t.workspaceId === panelWorkspace?.id);
      if (activeWorkspaceTabs[index]) setActiveTabId(activeWorkspaceTabs[index].id);
    },
    onSplitHorizontal: () => splitFocusedTerminal('horizontal'),
    onSplitVertical: () => splitFocusedTerminal('vertical'),
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
  });  const handleMinimize = async () => {
    if ((window as any).electron) {
      (window as any).electron.minimize();
    } else if ((window as any).__TAURI__) {
      try {
        const getCurrentWindow = (window as any).__TAURI__?.window?.getCurrentWindow;
        if (getCurrentWindow) {
          await getCurrentWindow().minimize();
        } else {
          const { getCurrentWindow: getWin } = await import('@tauri-apps/api/window');
          await getWin().minimize();
        }
      } catch (err) {
        console.error("Failed to minimize window:", err);
      }
    }
  };

  const handleToggleMaximize = async () => {
    if ((window as any).electron) {
      (window as any).electron.maximize();
    } else if ((window as any).__TAURI__) {
      try {
        const getCurrentWindow = (window as any).__TAURI__?.window?.getCurrentWindow;
        if (getCurrentWindow) {
          await getCurrentWindow().toggleMaximize();
        } else {
          const { getCurrentWindow: getWin } = await import('@tauri-apps/api/window');
          await getWin().toggleMaximize();
        }
      } catch (err) {
        console.error("Failed to toggle maximize window:", err);
      }
    }
  };

  const handleClose = async () => {
    if ((window as any).electron) {
      (window as any).electron.close();
    } else if ((window as any).__TAURI__) {
      try {
        const getCurrentWindow = (window as any).__TAURI__?.window?.getCurrentWindow;
        if (getCurrentWindow) {
          await getCurrentWindow().close();
        } else {
          const { getCurrentWindow: getWin } = await import('@tauri-apps/api/window');
          await getWin().close();
        }
      } catch (err) {
        console.error("Failed to close window:", err);
      }
    }
  };

  // Lifecycle
  useEffect(() => {
    fetchLocalVersion();

    if ((window as any).electron) {
      (window as any).electron.isMaximized().then(setIsMaximized);
      const unsubscribe = (window as any).electron.onMaximizedChange((maximized: boolean) => {
        setIsMaximized(maximized);
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    } else if ((window as any).__TAURI__) {
      let active = true;
      let unlisten: (() => void) | undefined;

      const initTauriWindow = async () => {
        try {
          const getCurrentWindow = (window as any).__TAURI__?.window?.getCurrentWindow;
          let appWindow;
          if (getCurrentWindow) {
            appWindow = getCurrentWindow();
          } else {
            const { getCurrentWindow: getWin } = await import('@tauri-apps/api/window');
            appWindow = getWin();
          }
          
          if (!active) return;
          const maximized = await appWindow.isMaximized();
          if (!active) return;
          setIsMaximized(maximized);

          const unsub = await appWindow.onResized(async () => {
            const currentMax = await appWindow.isMaximized();
            if (active) setIsMaximized(currentMax);
          });

          if (!active) {
            unsub();
          } else {
            unlisten = unsub;
          }
        } catch (err) {
          console.error("Failed to initialize Tauri window:", err);
        }
      };

      initTauriWindow();

      return () => {
        active = false;
        if (unlisten) unlisten();
      };
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      wsManager.connect();
      wsManager.setOnConnectionChange(setWsConnected);

      // Subscribe to real-time tab & quick launch sync updates
      wsManager.subscribe('sync_state', (payload) => {
        if (payload.type === 'sync_update') {
          const { state } = payload;
          const canonicalIncoming = toCanonicalString(state);

          // If the received state is identical to our last sync state, do nothing (avoid loops)
          if (canonicalIncoming === lastSyncState.current) {
            return;
          }

          // Update React states
          if (state.tabs && Array.isArray(state.tabs)) {
            setTabs(prev => {
              return state.tabs.map((newTab: any) => {
                const existing = prev.find(t => t.id === newTab.id);
                return {
                  ...newTab,
                  isDetached: existing ? !!existing.isDetached : false
                };
              });
            });
          }
          if (state.terminalInstances && typeof state.terminalInstances === 'object') {
            // Strip initialCommand from all instances coming from remote sync.
            // initialCommand is ephemeral (one-shot) and must never be re-applied
            // to a terminal that is being reattached/synced — doing so would cause
            // the shell command to re-execute every time the session reconnects.
            const sanitizedInstances = Object.fromEntries(
              Object.entries(state.terminalInstances).map(([id, inst]: [string, any]) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { initialCommand: _dropped, ...rest } = inst;
                return [id, rest];
              })
            );
            setTerminalInstances(sanitizedInstances);
          }
          if (state.savedPrompts && Array.isArray(state.savedPrompts)) {
            setSavedPrompts(state.savedPrompts);
            localStorage.setItem('tline-saved-prompts', JSON.stringify(state.savedPrompts));
          }

          // Save the last synced state using canonical format
          lastSyncState.current = canonicalIncoming;
          console.log('[Sync] Received real-time state update from server.');
        }
      });

      const handleGlobalMessage = (payload: any) => {
        if (payload.type === 'activeProcesses') {
          handleActiveProcessesChange(payload.id, payload.processes);
        } else if (payload.type === 'title') {
          handleTitleChange(payload.id, payload.title);
        }
      };

      wsManager.addGlobalMessageListener(handleGlobalMessage);

      fetchDashboardData();
      fetchLocalVersion();

      return () => {
        wsManager.unsubscribe('sync_state');
        wsManager.removeGlobalMessageListener(handleGlobalMessage);
      };
    }
  }, [isAuthenticated, fetchLocalVersion]);

  const prevActiveTabIdRef = useRef<string>('');
  const prevActiveTabPathRef = useRef<string>('');

  // Synchronize active workspace, worktree path, and tab name with the active tab's context
  useEffect(() => {
    if (!activeTabId || workspaces.length === 0) return;

    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    const ws = workspaces.find(w => w.id === activeTab.workspaceId);
    if (!ws) return;

    // Calculate current active tab path
    let activeTabPath = '';
    if (activeTab.type === 'file' && activeTab.filePath) {
      activeTabPath = activeTab.filePath;
    } else if (activeTab.type === 'terminal' && activeTab.layout) {
      const focusedId = activeTab.focusedTerminalId;
      const inst = focusedId ? terminalInstances[focusedId] : null;
      if (inst && inst.cwd) {
        activeTabPath = inst.cwd;
      }
    }

    const hasTabIdChanged = activeTabId !== prevActiveTabIdRef.current;
    const hasTabPathChanged = activeTabPath && activeTabPath !== prevActiveTabPathRef.current;

    if (hasTabIdChanged || hasTabPathChanged) {
      prevActiveTabIdRef.current = activeTabId;
      if (activeTabPath) {
        prevActiveTabPathRef.current = activeTabPath;
      }

      // Sync workspace selection
      if (!panelWorkspace || panelWorkspace.id !== ws.id) {
        setPanelWorkspace(ws);
      }

      // Sync worktree path selection.
      // For non-git workspaces (no worktrees), always use null.
      // For git workspaces, use the matched worktree path or the main worktree's path.
      let targetWtPath: string | null = null;
      if (ws.isGit && ws.worktrees && ws.worktrees.length > 0) {
        const matchedWtPath = getTabWorktreePath(activeTab, ws, terminalInstances);
        const wtObj = ws.worktrees.find(wt => wt.path === matchedWtPath);
        if (wtObj && !wtObj.isMain) {
          targetWtPath = matchedWtPath;
        } else {
          const mainWt = ws.worktrees.find(wt => wt.isMain);
          targetWtPath = mainWt ? mainWt.path : null;
        }
      }

      if (panelWorktreePath !== targetWtPath) {
        setPanelWorktreePath(targetWtPath);
      }

      // Dynamically sync terminal tab title with the workspace name
      if (activeTab.type === 'terminal') {
        const expectedName = ws.name;
        if (activeTab.name !== expectedName) {
          setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name: expectedName } : t));
        }
      }
    }
  }, [activeTabId, tabs, workspaces, terminalInstances, panelWorkspace, panelWorktreePath, setTabs]);


  useEffect(() => {
    if (!isAuthenticated) return;

    if (workspaces.length === 0) {
      setPanelWorkspace(null);
      return;
    }

    // Default to the first workspace if none is active or if the active one no longer exists
    if (!panelWorkspace || !workspaces.some(w => w.id === panelWorkspace.id)) {
      setPanelWorkspace(workspaces[0] || null);
    }
  }, [workspaces, panelWorkspace, isAuthenticated]);

  // Safety check: if active workspace is not Git, panelWorktreePath must be null
  useEffect(() => {
    if (panelWorkspace && !panelWorkspace.isGit && panelWorktreePath !== null) {
      setPanelWorktreePath(null);
    }
  }, [panelWorkspace, panelWorktreePath]);



  const triggerLogout = () => {
    handleLogout(setTabs, setTerminalInstances, setActiveTabId);
  };

  const checkActiveSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/terminals/active', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const sessions: Array<{ id: string; shellType: string; cwd: string }> = await res.json();
        const notImported = sessions.filter(s => !terminalInstances[s.id]);
        if (notImported.length > 0) {
          importActiveSessions(notImported);
        }
      }
    } catch (e) {
      console.error('Failed to check active sessions:', e);
    }
  };

  const fetchSyncState = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/sync/state', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Update states only if they are not empty or exist
        if (data.tabs && Array.isArray(data.tabs)) {
          setTabs(prev => {
            return data.tabs.map((newTab: any) => {
              const existing = prev.find(t => t.id === newTab.id);
              return {
                ...newTab,
                isDetached: existing ? !!existing.isDetached : false
              };
            });
          });
        }
        if (data.terminalInstances && typeof data.terminalInstances === 'object') {
          // Strip initialCommand from all instances restored from the server.
          // initialCommand is ephemeral (one-shot, used only at terminal creation time).
          // Re-applying it after a session restore/reconnect would cause the shell
          // command to fire again in every terminal that was opened via Quick Launch.
          const sanitizedInstances = Object.fromEntries(
            Object.entries(data.terminalInstances).map(([id, inst]: [string, any]) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { initialCommand: _dropped, ...rest } = inst;
              return [id, rest];
            })
          );
          setTerminalInstances(sanitizedInstances);
        }
        if (data.savedPrompts && Array.isArray(data.savedPrompts)) {
          setSavedPrompts(data.savedPrompts);
          localStorage.setItem('tline-saved-prompts', JSON.stringify(data.savedPrompts));
        }
        
        // Also update the last sync state reference using canonical representation to prevent re-upload loop
        const stateObj = {
          tabs: data.tabs || [],
          terminalInstances: data.terminalInstances || {},
          savedPrompts: data.savedPrompts || []
        };
        lastSyncState.current = toCanonicalString(stateObj);
      }
    } catch (e) {
      console.error('Failed to fetch sync state:', e);
    } finally {
      hasFetchedSyncState.current = true;
    }
  };
 
  // Synchronize state changes to backend (Option A)
  useEffect(() => {
    if (detachedTabId) return; // Detached windows are read-only and do not sync back to server
    if (!isAuthenticated || !hasFetchedSyncState.current) return;
    const token = localStorage.getItem('token');
    if (!token) return;
 
    const currentState = {
      tabs,
      terminalInstances,
      savedPrompts
    };
    const canonicalCurrent = toCanonicalString(currentState);
 
    // If the state hasn't changed from the last fetched/saved one, don't re-upload
    if (canonicalCurrent === lastSyncState.current) {
      return;
    }
 
    // Debounce the save request by 1.5 seconds
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/sync/state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(currentState)
        });
        if (res.ok) {
          lastSyncState.current = canonicalCurrent;
          console.log('[Sync] State synchronized to server successfully.');
        }
      } catch (err) {
        console.error('[Sync] Failed to upload state to server:', err);
      }
    }, 1500);
 
    return () => clearTimeout(timer);
  }, [tabs, terminalInstances, savedPrompts, isAuthenticated]);

  const fetchDashboardData = () => {
    fetchWorkspaces();
    fetchTunnelStatus();
    checkActiveSessions();
    fetchSyncState();
  };

  const handleMobileKeyInput = (data: string) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.type === 'terminal' && activeTab.focusedTerminalId) {
      wsManager.send(JSON.stringify({
        type: 'data',
        id: activeTab.focusedTerminalId,
        data
      }));
    }
  };
  const renderPreAuthWithControls = (content: React.ReactNode) => {
    return (
      <div className="relative w-full h-full">
        {((window as any).electron || (window as any).__TAURI__) && (
          <div 
            className="absolute top-0 left-0 right-0 h-8 flex justify-end items-center px-4 z-50 select-none"
            data-tauri-drag-region
          >
            <div className="window-controls flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
              <button 
                type="button" 
                className="window-control-btn" 
                onClick={handleMinimize} 
                title="Minimize"
              >
                <span style={{ fontSize: '10px' }}>—</span>
              </button>
              <button 
                type="button" 
                className="window-control-btn" 
                onClick={handleToggleMaximize} 
                title={isMaximized ? "Restore" : "Maximize"}
              >
                <span style={{ fontSize: '10px' }}>{isMaximized ? "❐" : "▢"}</span>
              </button>
              <button 
                type="button" 
                className="window-control-btn window-control-btn-close" 
                onClick={handleClose} 
                title="Close"
              >
                <span style={{ fontSize: '10px' }}>✕</span>
              </button>
            </div>
          </div>
        )}
        {content}
      </div>
    );
  };

  if (loading) {
    return renderPreAuthWithControls(
      <div className="auth-wrapper">
        <div className="welcome-panel">
          <Loader2 className="animate-spin text-purple-500" size={40} />
          <p className="welcome-desc">Initializing t-line workspace system...</p>
        </div>
      </div>
    );
  }

  // Setup / Password Initialization Screen
  if (setupRequired) {
    return renderPreAuthWithControls(
      <SetupSecurityForm
        onSubmit={handleSetup}
        password={password}
        setPassword={setPassword}
        error={authError}
      />
    );
  }

  // Login Screen
  if (!isAuthenticated) {
    return renderPreAuthWithControls(
      <LoginForm
        onSubmit={handleLogin}
        password={password}
        setPassword={setPassword}
        error={authError}
      />
    );
  }

  // --- Detached Tab Rendering for Dual Screen ---
  if (detachedTabId) {
    const detachedTab = tabs.find(t => t.id === detachedTabId);

    if (!detachedTab) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-900 text-slate-300">
          <p className="text-lg font-semibold">Tab not found or closed.</p>
          <button 
            className="mt-4 px-4 py-2 bg-purple-600 rounded text-sm text-white hover:bg-purple-500"
            onClick={() => {
              if ((window as any).__TAURI__) {
                const getCurrentWindow = (window as any).__TAURI__?.window?.getCurrentWindow;
                if (getCurrentWindow) {
                  getCurrentWindow().close();
                } else {
                  import('@tauri-apps/api/window').then(({ getCurrentWindow: getWin }) => {
                    getWin().close();
                  });
                }
              }
            }}
          >
            Close Window
          </button>
        </div>
      );
    }

    return (
      <div className={`app-container theme-${theme} h-screen w-screen flex flex-col overflow-hidden`}>
        {/* Custom Header for Detached Window */}
        <div 
          className="top-bar flex items-center justify-between shrink-0 select-none" 
          data-tauri-drag-region 
          style={{ height: '36px', minHeight: '36px', borderBottom: '1px solid var(--border-color)', padding: '0 12px', background: 'var(--bg-sidebar)' }}
        >
          <div className="flex items-center gap-2">
            {detachedTab.type === 'file' ? (
              <FileCode size={14} className="text-purple-400" />
            ) : detachedTab.type === 'diff' ? (
              <GitCompare size={14} className="text-indigo-400" />
            ) : detachedTab.type === 'grid' ? (
              <LayoutGrid size={14} className="text-emerald-400" />
            ) : detachedTab.type === 'browser' ? (
              <Globe size={14} className="text-blue-400" />
            ) : (
              <TerminalIcon size={14} className="text-purple-400" />
            )}
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
              {detachedTab.type === 'terminal' && detachedTab.focusedTerminalId ? (terminalInstances[detachedTab.focusedTerminalId]?.name || detachedTab.name) : detachedTab.name}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">Detached</span>
          </div>
          
          <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button 
              type="button" 
              className="action-btn text-slate-400 hover:text-purple-400"
              title="Re-attach tab to main window"
              onClick={() => {
                const updated = tabs.map(t => t.id === detachedTabId ? { ...t, isDetached: false } : t);
                setTabs(updated);
                localStorage.setItem('tline-tabs-v2', JSON.stringify(updated));
                if ((window as any).__TAURI__) {
                  const getCurrentWindow = (window as any).__TAURI__?.window?.getCurrentWindow;
                  if (getCurrentWindow) {
                    getCurrentWindow().close();
                  } else {
                    import('@tauri-apps/api/window').then(({ getCurrentWindow: getWin }) => {
                      getWin().close();
                    });
                  }
                }
              }}
              style={{ padding: '4px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              <Zap size={13} className="mr-1" />
              <span className="text-[11px] font-medium mr-1">Re-attach</span>
            </button>

            {((window as any).electron || (window as any).__TAURI__) && (
              <div className="window-controls flex items-center gap-0.5" style={{ marginLeft: '8px' }}>
                <button type="button" className="window-control-btn" onClick={handleMinimize} title="Minimize">
                  <span style={{ fontSize: '10px' }}>—</span>
                </button>
                <button type="button" className="window-control-btn" onClick={handleToggleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
                  <span style={{ fontSize: '10px' }}>{isMaximized ? "❐" : "▢"}</span>
                </button>
                <button type="button" className="window-control-btn window-control-btn-close" onClick={handleClose} title="Close">
                  <span style={{ fontSize: '10px' }}>✕</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative" style={{ background: 'var(--bg-main)' }}>
          {detachedTab.type === 'browser' && (
            <BrowserTab
              tab={detachedTab}
              isActive={true}
              onUpdateTabName={(newName) => {
                setTabs(prev => prev.map(t => t.id === detachedTab.id ? { ...t, name: newName } : t));
              }}
              onUpdateTabUrl={(newUrl) => {
                setTabs(prev => prev.map(t => t.id === detachedTab.id ? { ...t, url: newUrl } : t));
              }}
            />
          )}
          {detachedTab.type === 'file' && (
            <FileViewerTab
              filePath={detachedTab.filePath || ''}
              token={localStorage.getItem('token') || ''}
              onSave={() => {
                fetchGitStatus(false);
                fetchWorkspaces();
                setFsChangeTrigger(prev => prev + 1);
              }}
              theme={theme}
              themeBackground={THEMES[theme]?.bgMain}
            />
          )}
          {detachedTab.type === 'diff' && (
            <DiffViewerTab
              commitHash={detachedTab.commitHash || ''}
              filePath={detachedTab.filePath || ''}
              token={localStorage.getItem('token') || ''}
              workspaceId={detachedTab.workspaceId || ''}
              worktreePath={detachedTab.worktreePath}
              compareWithWorktree={detachedTab.compareWithWorktree}
            />
          )}
          {detachedTab.type === 'grid' && (
            <TerminalGridTab
              tab={detachedTab}
              tabs={tabs}
              setTabs={setTabs}
              workspaces={workspaces}
              terminalInstances={terminalInstances}
              wsConnected={wsConnected}
              terminalFontSize={terminalFontSize}
              handleTitleChange={handleTitleChange}
              handleActiveProcessesChange={handleActiveProcessesChange}
              focusTerminal={focusTerminal}
              closePane={closePane}
              setActiveTabId={setActiveTabId}
              themeBackground={THEMES[theme]?.bgMain}
              themeForeground={THEMES[theme]?.textMain}
              accentColor={accentColor}
              fontFamily={MONO_FONTS[fontMono as keyof typeof MONO_FONTS]}
              fontWeight={fontMonoWeight}
              refreshTriggers={refreshTriggers}
              clearInitialCommand={clearInitialCommand}
              defaultShell={defaultShell}
              setDefaultShell={setDefaultShell}
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              onRefreshTerminal={refreshTerminal}
            />
          )}
          {detachedTab.type === 'terminal' && detachedTab.layout && (
            <SplitLayoutRenderer
              node={detachedTab.layout}
              activeTabId={detachedTabId}
              focusedTerminalId={detachedTab.focusedTerminalId}
              wsConnected={wsConnected}
              terminalFontSize={terminalFontSize}
              terminalInstances={terminalInstances}
              handleTitleChange={handleTitleChange}
              handleActiveProcessesChange={handleActiveProcessesChange}
              focusTerminal={focusTerminal}
              closePane={closePane}
              splitFocusedTerminal={splitFocusedTerminal}
              hasMultiplePanes={detachedTab.layout.type === 'split'}
              refreshTriggers={refreshTriggers}
              fontFamily={MONO_FONTS[fontMono as keyof typeof MONO_FONTS]}
              fontWeight={fontMonoWeight}
              accentColor={accentColor}
              themeBackground={THEMES[theme]?.bgMain}
              themeForeground={THEMES[theme]?.textMain}
              clearInitialCommand={clearInitialCommand}
              defaultShell={defaultShell}
              setDefaultShell={setDefaultShell}
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              onRefreshTerminal={refreshTerminal}
              onLayoutChange={(newLayout) => updateTabLayout(detachedTab.id, newLayout)}
            />
          )}
        </div>
      </div>
    );
  }

  const getActiveTabPath = (): string => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return '';
    if (activeTab.type === 'file' && activeTab.filePath) {
      return activeTab.filePath;
    }
    if (activeTab.type === 'terminal' && activeTab.focusedTerminalId) {
      const inst = terminalInstances[activeTab.focusedTerminalId];
      return inst?.cwd || '';
    }
    return '';
  };

  const showTabText = !sidebarCollapsed && sidebarWidth >= 280;

  return (
    <div className="app-container">
      <UpdateNotification />
      
      <div className="app-content-wrapper">
        
        {/* Sidebar Panel */}
        <div 
          className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
          style={{
            width: sidebarCollapsed ? '48px' : `${sidebarWidth}px`,
            minWidth: sidebarCollapsed ? '48px' : `${sidebarWidth}px`
          }}
        >
        
        <div className="sidebar-header" data-tauri-drag-region style={{ padding: sidebarCollapsed ? '12px 0' : '12px 16px', gap: '8px', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TPlusLogo size={28} />
            {!sidebarCollapsed && (
              <span className="logo-text" style={{ fontSize: '1.05rem', fontWeight: 600 }}>t-line</span>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              type="button"
              className="action-btn mobile-only"
              onClick={() => setSidebarOpen(false)}
              title="Close Sidebar"
              style={{ padding: '4px', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Sidebar Panel Tabs */}
        <div className="sidebar-panel-tabs" style={{ flexDirection: sidebarCollapsed ? 'column' : 'row' }}>
          <button
            className={`sidebar-panel-tab ${activePanel === 'workspaces' ? 'active' : ''}`}
            onClick={() => {
              setActivePanel('workspaces');
              if (sidebarCollapsed) {
                setSidebarCollapsed(false);
                localStorage.setItem('tline-sidebar-collapsed', 'false');
              }
            }}
            title="Workspaces"
          >
            <Folder size={15} />
            {showTabText && <span>Workspaces</span>}
          </button>
          <button
            className={`sidebar-panel-tab ${activePanel === 'explorer' ? 'active' : ''}`}
            onClick={() => {
              setActivePanel('explorer');
              if (sidebarCollapsed) {
                setSidebarCollapsed(false);
                localStorage.setItem('tline-sidebar-collapsed', 'false');
              }
            }}
            title="File Explorer"
          >
            <FolderTree size={15} />
            {showTabText && <span>Explorer</span>}
          </button>
          <button
            className={`sidebar-panel-tab ${activePanel === 'changes' ? 'active' : ''}`}
            onClick={() => {
              setActivePanel('changes');
              if (sidebarCollapsed) {
                setSidebarCollapsed(false);
                localStorage.setItem('tline-sidebar-collapsed', 'false');
              }
            }}
            title="Git Changes"
          >
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <GitCompare size={15} />
              {!showTabText && changedFiles.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-8px',
                    background: 'var(--color-primary)',
                    color: 'white',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    borderRadius: '999px',
                    padding: '0 4px',
                    minWidth: '12px',
                    height: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    border: '1.5px solid #1e1e24'
                  }}
                >
                  {changedFiles.length}
                </span>
              )}
            </div>
            {showTabText && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Changes
                {changedFiles.length > 0 && (
                  <span className="changes-badge">{changedFiles.length}</span>
                )}
              </span>
            )}
          </button>
          <button
            className={`sidebar-panel-tab ${activePanel === 'checkpoints' ? 'active' : ''}`}
            onClick={() => {
              setActivePanel('checkpoints');
              if (sidebarCollapsed) {
                setSidebarCollapsed(false);
                localStorage.setItem('tline-sidebar-collapsed', 'false');
              }
            }}
            title="Checkpoints & Snapshots"
          >
            <Camera size={15} />
            {showTabText && <span>Snapshots</span>}
          </button>
        </div>


        {!sidebarCollapsed && (
          <SidebarContentPanel
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            workspaces={workspaces}
            panelWorkspace={panelWorkspace}
            setPanelWorkspace={setPanelWorkspace}
            tabs={filteredTabs}
            setActiveTabId={setActiveTabId}
            activeTabId={activeTabId}
            terminalInstances={terminalInstances}
            setShowWorkspaceModal={setShowWorkspaceModal}
            setSidebarOpen={setSidebarOpen}
            handleOpenWorktreeModal={handleOpenWorktreeModal}
            openTerminal={openTerminal}
            handleRemoveWorkspace={handleRemoveWorkspace}
            handleRemoveWorktree={handleRemoveWorktreeWrapped}
            openFileTab={openFileTab}
            closeTerminal={closeTerminal}
            workspaceActiveTab={workspaceActiveTab}
            onWorkspaceClick={handleWorkspaceClick}
            onWorktreeClick={handleWorktreeClick}
            onBranchCheckoutClick={handleBranchCheckoutClick}
            changedFiles={changedFiles}
            gitStatusLoading={gitStatusLoading}
            refreshGitStatus={() => fetchGitStatus(true)}
            onEditWorkspace={handleOpenEditWorkspaceModal}
            deletingWorkspacePaths={deletingWorkspacePaths}
            deletingWorktreePaths={deletingWorktreePaths}
            panelWorktreePath={panelWorktreePath}
            fsChangeTrigger={fsChangeTrigger}
            onOpenBranchModal={() => setShowBranchModal(true)}
            openDiffTab={openDiffTab}
            onCheckpointChange={() => {
              fetchGitStatus(true);
              fetchWorkspaces();
            }}
          />
        )}
      </div>

      {/* Resize Handle */}
      {!sidebarCollapsed && (
        <div 
          className="sidebar-resizer" 
          onMouseDown={startResizing} 
        />
      )}

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {rightMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setRightMenuOpen(false)} />
      )}

      <RightSidebar
        isOpen={rightMenuOpen}
        onClose={() => setRightMenuOpen(false)}
        tabs={filteredTabs}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        openTerminal={openTerminal}
        closeTerminal={closeTerminal}
        workspaces={workspaces}
        panelWorkspace={panelWorkspace}
        terminalInstances={terminalInstances}
        setShowSettingsModal={setShowSettingsModal}
        handleLogout={triggerLogout}
        terminalFontSize={terminalFontSize}
        defaultShell={defaultShell}
        setDefaultShell={setDefaultShell}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        activeTabType={tabs.find(t => t.id === activeTabId)?.type || null}
        onRefreshTerminal={() => refreshTerminal(tabs.find(t => t.id === activeTabId)?.focusedTerminalId || '')}
        tunnelStatus={tunnelStatus}
        tunnelLoading={tunnelLoading}
        handleStartTunnel={handleStartTunnel}
        handleStopTunnel={handleStopTunnel}
        savedPrompts={activeWorkspacePrompts}
        onRunSavedPrompt={handleRunSavedPrompt}
        onDeleteSavedPrompt={handleDeleteSavedPrompt}
        onAddSavedPrompt={() => {
          setSavePromptDefaultCwd(panelWorkspace?.path || workspaces[0]?.path || '');
          setSavePromptDefaultShell(defaultShell);
          setSavePromptInitialName('');
          setShowSavePromptModal(true);
        }}
        onShowShortcutHelp={() => setShowShortcutModal(true)}
      />

      {/* Main Panel */}
      <div className="main-panel">
        
        {/* Topbar */}
        <div className="top-bar flex items-center justify-between" data-tauri-drag-region>
          <div className="top-bar-info flex items-center gap-4 shrink-0">
            <button 
              className="action-btn" 
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  const newVal = !sidebarCollapsed;
                  setSidebarCollapsed(newVal);
                  localStorage.setItem('tline-sidebar-collapsed', newVal.toString());
                }
              }}
              title="Toggle Sidebar"
            >
              <MenuIcon size={18} />
            </button>
            <span className="status-indicator" style={{ display: 'flex', alignItems: 'center' }} title={wsConnected ? 'Backend Connected' : 'Connecting to Backend...'}>
              <span className={`dot ${wsConnected ? 'dot-active' : 'dot-inactive'}`} />
            </span>
          </div>

          {/* Mobile Tab Bar — scrollable tabs + fixed '+' button in header on mobile/tablet */}
          {filteredTabs.length > 0 && (
            <div className="mobile-tab-wrapper mobile-only">
              <div className="mobile-tab-bar">
                {filteredTabs.map(t => {
                  const isActive = activeTabId === t.id;
                  const focusedInst = t.type === 'terminal' && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
                  const displayName = (t.type === 'file' || t.type === 'diff' || t.type === 'grid') ? t.name : (focusedInst?.name || t.name);
                  return (
                    <button
                      key={t.id}
                      className={`mobile-tab-item ${isActive ? 'mobile-tab-active' : ''}`}
                      onClick={() => handleTabClick(t)}
                    >
                      {t.type === 'file' ? (
                        <FileCode size={11} className="shrink-0" />
                      ) : t.type === 'diff' ? (
                        <GitCompare size={11} className="shrink-0" />
                      ) : t.type === 'grid' ? (
                        <LayoutGrid size={11} className="shrink-0" />
                      ) : (
                        <TerminalIcon size={11} className="shrink-0" />
                      )}
                      <span className="mobile-tab-name">{displayName}</span>
                      <span
                        className="mobile-tab-close"
                        onClick={(e) => { e.stopPropagation(); closeTerminal(t.id, e as any); }}
                      >
                        ×
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                className="mobile-tab-new"
                onClick={() => openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '')}
                title="New Terminal"
              >
                <Plus size={13} />
              </button>
            </div>
          )}

          <div className="top-bar-actions flex items-center gap-2 shrink-0">
            <button 
              className={`action-btn mobile-only ${showMobileKeyboard ? 'text-purple-400 bg-purple-500/10' : ''}`}
              onClick={() => setShowMobileKeyboard(v => !v)}
              title="Toggle virtual touch keyboard"
            >
              <Keyboard size={18} />
            </button>
            <button 
              className="action-btn mobile-only" 
              onClick={() => setRightMenuOpen(!rightMenuOpen)} 
              title="Toggle Menu"
            >
              <MoreVertical size={18} />
            </button>

            {/* App Actions (Shortcuts, Settings, Logout) */}
            <div className="flex items-center gap-1.5 mr-2 desktop-only" style={{ WebkitAppRegion: 'no-drag' } as any}>
              {panelWorkspace?.isGit && (
                <button
                  type="button"
                  className="action-btn text-purple-400 hover:text-purple-300"
                  onClick={() => handleQuickSnapshot()}
                  disabled={quickCreating}
                  title="Quick Snapshot (Alt+S)"
                >
                  {quickCreating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                </button>
              )}
              <button type="button" className="action-btn" onClick={() => setShowShortcutModal(true)} title="Keyboard Shortcuts">
                <HelpCircle size={14} />
              </button>
              <button type="button" className="action-btn" onClick={() => setShowSettingsModal(true)} title="Settings">
                <Settings size={14} />
              </button>
              <button type="button" className="action-btn text-slate-400 hover:text-rose-400" onClick={triggerLogout} title="Log out">
                <LogOut size={14} />
              </button>
            </div>

            {/* Window Controls (Electron or Tauri style) */}
            {((window as any).electron || (window as any).__TAURI__) && (
              <div className="window-controls flex items-center gap-0.5 desktop-only" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button 
                  type="button" 
                  className="window-control-btn" 
                  onClick={handleMinimize} 
                  title="Minimize"
                >
                  <span style={{ fontSize: '10px' }}>—</span>
                </button>
                <button 
                  type="button" 
                  className="window-control-btn" 
                  onClick={handleToggleMaximize} 
                  title={isMaximized ? "Restore" : "Maximize"}
                >
                  <span style={{ fontSize: '10px' }}>{isMaximized ? "❐" : "▢"}</span>
                </button>
                <button 
                  type="button" 
                  className="window-control-btn window-control-btn-close" 
                  onClick={handleClose} 
                  title="Close"
                >
                  <span style={{ fontSize: '10px' }}>✕</span>
                </button>
              </div>
            )}
          </div>
        </div>



        {/* Dynamic Panels */}
        <div className={`content-area ${filteredTabs.length > 0 ? 'content-area-tabs' : 'content-area-empty'}`}>
          {filteredTabs.length > 0 && (
            <>
              <div className="content-tabs-bar flex items-center justify-between desktop-only">
                <div className="chrome-tabs-container mx-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
                  {panelWorktreePath !== null && (() => {
                    const activeWt = panelWorkspace?.worktrees?.find(wt => wt.path === panelWorktreePath);
                    const branchName = activeWt?.branch || 'worktree';
                    return (
                      <div className="tab-group-badge" title={`Branch: ${branchName}`}>
                        <GitBranch size={10} />
                        <span>{branchName}</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    let prevBranch: string | null = null;
                    return visibleTabs.map(t => {
                      const isFile = t.type === 'file';
                      const isDiff = t.type === 'diff';
                      const isGrid = t.type === 'grid';
                      const isTerminal = t.type === 'terminal';
                      const focusedInst = isTerminal && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
                      const shellType = focusedInst?.shellType || '';
                      const displayName = (isFile || isDiff || isGrid) ? t.name : (focusedInst?.name || t.name);
                      const branch = getTabGitBranch(t);

                      const showGroupHeader = panelWorktreePath === null && branch && branch !== prevBranch;
                      prevBranch = branch || null;

                      return (
                        <Fragment key={t.id}>
                          {showGroupHeader && (
                            <div className="tab-group-badge" title={`Branch: ${branch}`}>
                              <GitBranch size={10} />
                              <span>{branch}</span>
                            </div>
                          )}
                          <div 
                            data-tab-id={t.id}
                            className={`tab ${activeTabId === t.id ? 'tab-active' : ''} ${draggingTabId === t.id ? 'dragging' : ''} ${t.isDetached ? 'tab-detached' : ''} ${dragOverTabId === t.id && dragOverSide ? `drag-over-${dragOverSide}` : ''}`}
                            onMouseDown={(e) => handleTabMouseDown(e, t.id)}
                             onClick={() => {
                               handleTabClick(t);
                               if (t.isDetached) {
                                 if ((window as any).__TAURI__?.core?.invoke) {
                                   const query = buildDetachedTabQuery(t.id);
                                   (window as any).__TAURI__.core.invoke('create_detached_window', { 
                                     label: `browser-detached-${t.id}`, 
                                     query 
                                   }).catch((err: any) => console.error(err));
                                 }
                               }
                             }}
                            onMouseEnter={(e) => handleTabMouseEnter(e, t)}
                            onMouseLeave={handleTabMouseLeave}
                            onContextMenu={(e) => handleTabContextMenu(e, t.id)}
                          >
                            {t.type === 'file' ? (
                              <FileCode size={13} className="tab-icon shrink-0" style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                            ) : t.type === 'diff' ? (
                              <GitCompare size={13} className="tab-icon shrink-0" style={{ color: activeTabId === t.id ? '#4ade80' : 'var(--text-muted)' }} />
                            ) : t.type === 'grid' ? (
                              <LayoutGrid size={13} className="tab-icon shrink-0" style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                            ) : t.type === 'browser' ? (
                              <Globe size={13} className="tab-icon shrink-0" style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                            ) : (
                              <TerminalIcon size={13} className="tab-icon shrink-0" style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                            )}
                            <span className="tab-title-container">
                              <span className="tab-title">{displayName}</span>
                              {shellType && (
                                <span className="tab-shell-type">({shellType === 'powershell' ? 'ps' : shellType})</span>
                              )}
                              {t.isDetached && (
                                <ExternalLink size={10} className="tab-detached-icon ml-1 inline text-purple-400 opacity-80" />
                              )}
                            </span>
                            <span className="tab-close" onClick={(e) => closeTerminal(t.id, e)}>×</span>
                          </div>
                        </Fragment>
                      );
                    });
                  })()}
                  {/* New Terminal button */}
                  <button
                    className="action-btn shrink-0"
                    onClick={() => openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '')}
                    title="New terminal (Alt+T)"
                    style={{ marginLeft: '6px' }}
                  >
                    <Plus size={14} />
                  </button>
                  {/* New Browser Preview button */}
                  <button
                    className="action-btn shrink-0"
                    onClick={() => openBrowserTab('', 'Preview', panelWorkspace?.id)}
                    title="New Web Preview"
                    style={{ marginLeft: '6px' }}
                  >
                    <Globe size={14} />
                  </button>

                </div>

                {/* Right-side actions: Quick Launch + Grid + Tabs Dropdown */}
                <div className="flex items-center gap-1 mr-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                  {/* Quick Launch icon + dropdown */}
                  <div className="tabs-dropdown-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
                    <button
                      className={`action-btn shrink-0 ${showQuickLaunchDropdown ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQuickLaunchDropdown(v => !v);
                        setShowTabsDropdown(false);
                      }}
                      title="Quick Launch Shortcuts"
                    >
                      <Zap size={14} />
                    </button>
                    {showQuickLaunchDropdown && (
                      <div
                        className="tabs-dropdown-menu"
                        style={{ right: 0, left: 'auto', minWidth: '220px', maxHeight: '320px', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Zap size={12} /> Quick Launch {panelWorkspace && `(${panelWorkspace.name})`}
                          </span>
                          <button
                            onClick={() => {
                              setSavePromptDefaultCwd(panelWorkspace?.path || workspaces[0]?.path || '');
                              setSavePromptDefaultShell(defaultShell);
                              setSavePromptInitialName('');
                              setShowSavePromptModal(true);
                              setShowQuickLaunchDropdown(false);
                            }}
                            style={{ background: 'var(--bg-card)', border: '1px border-[var(--border-color)]', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}
                            title="Add Shortcut"
                          >
                            <Plus size={11} /> Add
                          </button>
                        </div>
                        {activeWorkspacePrompts.length === 0 ? (
                          <div style={{ padding: '14px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No shortcuts for this workspace</div>
                        ) : (
                          activeWorkspacePrompts.map(prompt => (
                            <div
                              key={prompt.id}
                              className="tabs-dropdown-item"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', cursor: 'pointer' }}
                              title={`Run: ${prompt.command}\nPath: ${prompt.cwd}\nShell: ${prompt.shellType}`}
                              onClick={() => { handleRunSavedPrompt(prompt); setShowQuickLaunchDropdown(false); }}
                            >
                              <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{prompt.name}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteSavedPrompt(prompt.id); }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1, padding: '0 4px', marginLeft: '8px', flexShrink: 0 }}
                                title="Delete Shortcut"
                              >×</button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Terminal Grid button */}
                  <button
                    className="action-btn shrink-0"
                    onClick={openGridTab}
                    title="New Terminal Grid"
                  >
                    <LayoutGrid size={14} />
                  </button>

                  {/* Tabs list dropdown switcher */}
                  {filteredTabs.length > 1 && (
                    <div className="tabs-dropdown-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
                      <button
                        className={`action-btn shrink-0 tabs-dropdown-btn ${showTabsDropdown ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTabsDropdown(!showTabsDropdown);
                          setShowQuickLaunchDropdown(false);
                        }}
                        title="View Open Tabs"
                      >
                        <ChevronDown size={14} />
                      </button>
                      {showTabsDropdown && (
                        <TabsDropdown
                          filteredTabs={filteredTabs}
                          activeTabId={activeTabId}
                          setActiveTabId={setActiveTabId}
                          closeTerminal={closeTerminal}
                          terminalInstances={terminalInstances}
                          onClose={() => setShowTabsDropdown(false)}
                          getTabGitBranch={getTabGitBranch}
                          handleCloseOtherTabs={handleCloseOtherTabs}
                          handleCloseAllTabs={handleCloseAllTabs}
                          moveTab={moveTab}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {filteredTabs.length === 0 ? (
            
            // Empty Dashboard Welcome View
            <EmptyDashboard
              setShowWorkspaceModal={setShowWorkspaceModal}
              openTerminal={openTerminal}
              setPanelWorkspace={setPanelWorkspace}
              panelWorkspace={panelWorkspace}
              workspaces={workspaces}
              panelWorktreePath={panelWorktreePath}
            />
            
          ) : (
            
            // Terminals View — supports split pane and drag-and-drop splitting
            <div className="terminal-container">


              {/* Persistent Browser Tabs — lazy-mounted on first activation to avoid
                  creating multiple live native WebView2 instances simultaneously.
                  Once mounted, the tab stays in the DOM but BrowserTab internally
                  destroys/recreates the WebView2 overlay on isActive transitions. */}
              {tabs.filter(t => t.type === 'browser' && !t.isDetached && mountedBrowserTabIds.has(t.id)).map(tab => (
                <BrowserTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onUpdateTabName={(newName) => {
                    setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: newName } : t));
                  }}
                  onUpdateTabUrl={(newUrl) => {
                    setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, url: newUrl } : t));
                  }}
                />
              ))}

              {(() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (!activeTab) return null;
                let tabElement = null;
                if (activeTab.type === 'browser') {
                  tabElement = activeTab.isDetached ? (
                    <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 p-8 text-center" style={{ background: 'var(--bg-main)' }}>
                      <Globe size={40} className="text-slate-500 mb-3 opacity-40" />
                      <p className="font-semibold text-sm">Browser Tab</p>
                    </div>
                  ) : null;
                } else if (activeTab.type === 'file') {
                  tabElement = (
                    <FileViewerTab
                      filePath={activeTab.filePath || ''}
                      token={localStorage.getItem('token') || ''}
                      onSave={() => {
                        fetchGitStatus(false);
                        fetchWorkspaces();
                        setFsChangeTrigger(prev => prev + 1);
                      }}
                      theme={theme}
                      themeBackground={THEMES[theme]?.bgMain}
                    />
                  );
                } else if (activeTab.type === 'diff') {
                  tabElement = (
                    <DiffViewerTab
                      commitHash={activeTab.commitHash || ''}
                      filePath={activeTab.filePath || ''}
                      token={localStorage.getItem('token') || ''}
                      workspaceId={activeTab.workspaceId || ''}
                      worktreePath={activeTab.worktreePath}
                      compareWithWorktree={activeTab.compareWithWorktree}
                    />
                  );
                } else if (activeTab.type === 'grid') {
                  tabElement = (
                    <TerminalGridTab
                      tab={activeTab}
                      tabs={tabs}
                      setTabs={setTabs}
                      workspaces={workspaces}
                      terminalInstances={terminalInstances}
                      wsConnected={wsConnected}
                      terminalFontSize={terminalFontSize}
                      handleTitleChange={handleTitleChange}
                      handleActiveProcessesChange={handleActiveProcessesChange}
                      focusTerminal={focusTerminal}
                      closePane={closePane}
                      setActiveTabId={setActiveTabId}
                      themeBackground={THEMES[theme]?.bgMain}
                      themeForeground={THEMES[theme]?.textMain}
                      accentColor={accentColor}
                      fontFamily={MONO_FONTS[fontMono as keyof typeof MONO_FONTS]}
                      fontWeight={fontMonoWeight}
                      refreshTriggers={refreshTriggers}
                      clearInitialCommand={clearInitialCommand}
                      defaultShell={defaultShell}
                      setDefaultShell={setDefaultShell}
                      handleZoomIn={handleZoomIn}
                      handleZoomOut={handleZoomOut}
                      onRefreshTerminal={refreshTerminal}
                    />
                  );
                } else if (activeTab.type === 'terminal' && activeTab.layout) {
                  tabElement = (
                    <SplitLayoutRenderer
                      node={activeTab.layout}
                      activeTabId={activeTabId}
                      focusedTerminalId={activeTab.focusedTerminalId}
                      wsConnected={wsConnected}
                      terminalFontSize={terminalFontSize}
                      terminalInstances={terminalInstances}
                      handleTitleChange={handleTitleChange}
                      handleActiveProcessesChange={handleActiveProcessesChange}
                      focusTerminal={focusTerminal}
                      closePane={closePane}
                      splitFocusedTerminal={splitFocusedTerminal}
                      hasMultiplePanes={activeTab.layout.type === 'split'}
                      refreshTriggers={refreshTriggers}
                      fontFamily={MONO_FONTS[fontMono as keyof typeof MONO_FONTS]}
                      fontWeight={fontMonoWeight}
                      accentColor={accentColor}
                      themeBackground={THEMES[theme]?.bgMain}
                      themeForeground={THEMES[theme]?.textMain}
                      clearInitialCommand={clearInitialCommand}
                      defaultShell={defaultShell}
                      setDefaultShell={setDefaultShell}
                      handleZoomIn={handleZoomIn}
                      handleZoomOut={handleZoomOut}
                      onRefreshTerminal={refreshTerminal}
                      onLayoutChange={(newLayout) => updateTabLayout(activeTab.id, newLayout)}
                    />
                  );
                }

                if (!tabElement) return null;

                if (activeTab.isDetached) {
                  return (
                    <div className="relative w-full h-full overflow-hidden select-none pointer-events-none">
                      {/* Blurred terminal/editor beneath the overlay */}
                      <div className="w-full h-full filter blur-[1.5px] opacity-30">
                        {tabElement}
                      </div>

                      {/* Frosted Glass Locked Overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-8 text-center bg-black/40 backdrop-blur-[3px] pointer-events-auto z-[90]">
                        <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/25 mb-4 animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                          <Lock size={28} className="text-purple-400" />
                        </div>
                        <p className="font-bold text-base text-purple-200 tracking-wide uppercase">Workspace Locked</p>
                        <p className="text-xs text-slate-400 mt-2 max-w-[280px]">
                          This workspace is currently open in a detached window.
                        </p>
                        <button 
                          onClick={() => {
                            const updated = tabs.map(t => t.id === activeTab.id ? { ...t, isDetached: false } : t);
                            setTabs(updated);
                            localStorage.setItem('tline-tabs-v2', JSON.stringify(updated));
                            if ((window as any).__TAURI__?.core?.invoke) {
                              (window as any).__TAURI__.core.invoke('close_detached_window', { 
                                label: `browser-detached-${activeTab.id}` 
                              }).catch((e: any) => console.error(e));
                            }
                          }}
                          className="mt-5 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-purple-200 text-xs font-semibold rounded-full border border-purple-500/30 hover:border-purple-500/50 shadow-md transition-all duration-200 cursor-pointer flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <Zap size={12} className="animate-bounce" />
                          <span>Re-attach Workspace</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return tabElement;
              })()}
            </div>

          )}

          {showMobileKeyboard && tabs.length > 0 && tabs.find(t => t.id === activeTabId)?.type === 'terminal' && (
            <MobileKeyboard onKeyInput={handleMobileKeyInput} onClose={() => setShowMobileKeyboard(false)} />
          )}
        </div>
      </div>
    </div>

      {/* Workspace Add Dialog Modal */}
      <WorkspaceAddModal
        show={showWorkspaceModal}
        onClose={() => {
          setShowWorkspaceModal(false);
          setShowFolderExplorer(false);
        }}
        onSubmit={handleAddWorkspace}
        newWorkspacePath={newWorkspacePath}
        setNewWorkspacePath={setNewWorkspacePath}
        newWorkspaceShell={newWorkspaceShell}
        setNewWorkspaceShell={setNewWorkspaceShell}
        handleFolderBrowse={handleFolderBrowse}
        showFolderExplorer={showFolderExplorer}
        setShowFolderExplorer={setShowFolderExplorer}
        explorerPath={explorerPath}
        explorerParent={explorerParent}
        explorerDirs={explorerDirs}
        fetchDirectoryList={fetchDirectoryList}
      />

      {/* Git Worktree Add Dialog Modal */}
      <WorktreeAddModal
        show={showWorktreeModal}
        onClose={() => setShowWorktreeModal(false)}
        onSubmit={handleAddWorktree}
        newWorktreePath={newWorktreePath}
        setNewWorktreePath={setNewWorktreePath}
        isNewBranch={isNewBranch}
        setIsNewBranch={setIsNewBranch}
        newWorktreeBranch={newWorktreeBranch}
        setNewWorktreeBranch={setNewWorktreeBranch}
        repoBranches={repoBranches}
        gitLoading={gitLoading}
        newLocalBranchName={newLocalBranchName}
        setNewLocalBranchName={setNewLocalBranchName}
      />

      <TunnelSetupModal
        show={showTunnelModal}
        onClose={() => setShowTunnelModal(false)}
        onSubmit={handleStartTokenTunnel}
        tunnelToken={tunnelToken}
        setTunnelToken={setTunnelToken}
        loading={tunnelLoading}
      />

      <SettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        token={localStorage.getItem('token') || ''}
        workspacesCount={workspaces.length}
        showAlert={showAlert}
        appVersion={appVersion}
        updateAvailable={updateAvailable}
        latestVersion={latestVersion}
        theme={theme}
        setTheme={setTheme}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        fontSans={fontSans}
        setFontSans={setFontSans}
        fontMono={fontMono}
        setFontMono={setFontMono}
        fontSansWeight={fontSansWeight}
        setFontSansWeight={setFontSansWeight}
        fontMonoWeight={fontMonoWeight}
        setFontMonoWeight={setFontMonoWeight}
        terminalFontSize={terminalFontSize}
        setTerminalFontSize={setTerminalFontSize}
      />

      <ShortcutHelpModal
        show={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
      />

      <WorkspaceEditModal
        show={showEditWorkspaceModal}
        onClose={() => {
          setShowEditWorkspaceModal(false);
          setEditingWorkspace(null);
        }}
        onSubmit={handleUpdateWorkspaceSubmit}
        workspace={editingWorkspace}
      />

      {confirmDialog && (
        <ConfirmModal
          show={confirmDialog.show}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          variant={confirmDialog.variant}
          isAlert={confirmDialog.isAlert}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}

      <BranchModal
        show={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        workspace={panelWorkspace}
        worktreePath={panelWorktreePath}
        token={localStorage.getItem('token') || ''}
        onBranchChanged={() => {
          fetchGitStatus(true);
          fetchWorkspaces();
        }}
      />

      <SavePromptModal
        show={showSavePromptModal}
        onClose={() => setShowSavePromptModal(false)}
        onSubmit={handleSavePromptSubmit}
        workspaces={workspaces}
        defaultCwd={savePromptDefaultCwd}
        defaultShellType={savePromptDefaultShell}
        initialName={savePromptInitialName}
      />

      <SelectGridModal
        show={showSelectGridModal}
        onClose={() => {
          setShowSelectGridModal(false);
          setPendingSavedPrompt(null);
        }}
        gridTabs={activeGridTabs}
        onSelect={handleSelectGridSubmit}
      />

      <Footer
        panelWorkspace={panelWorkspace}
        panelWorktreePath={panelWorktreePath}
        tunnelStatus={tunnelStatus}
        tunnelLoading={tunnelLoading}
        handleStartTunnel={handleStartTunnel}
        handleStopTunnel={handleStopTunnel}
        activeTabType={tabs.find(t => t.id === activeTabId)?.type || null}
        activeTabPath={getActiveTabPath()}
        appVersion={appVersion}
        updateAvailable={updateAvailable}
        latestVersion={latestVersion}
        systemStats={systemStats}
        onBranchClick={() => setShowBranchModal(true)}
      />

      <TabTooltip activeTooltip={activeTooltip} tabContextMenu={tabContextMenu} />

      <TabContextMenu
        tabContextMenu={tabContextMenu}
        tabs={tabs}
        filteredTabs={filteredTabs}
        moveTab={moveTab}
        closeTerminal={closeTerminal}
        handleCloseOtherTabs={handleCloseOtherTabs}
        handleCloseAllTabs={handleCloseAllTabs}
        setActiveTabId={setActiveTabId}
        splitFocusedTerminal={splitFocusedTerminal}
        onSavePromptShortcut={(tabId) => {
          setTabContextMenu(null);
          const tab = tabs.find(t => t.id === tabId);
          if (tab && tab.type === 'terminal' && tab.focusedTerminalId) {
            const inst = terminalInstances[tab.focusedTerminalId];
            if (inst) {
              setSavePromptDefaultCwd(inst.cwd);
              setSavePromptDefaultShell(inst.shellType);
              setSavePromptInitialName(inst.name);
              setShowSavePromptModal(true);
            }
          }
        }}
        onDetachTab={(tabId) => {
          setTabContextMenu(null);
          const updated = tabs.map(t => t.id === tabId ? { ...t, isDetached: true } : t);
          setTabs(updated);
          localStorage.setItem('tline-tabs-v2', JSON.stringify(updated));

          if ((window as any).__TAURI__?.core?.invoke) {
            const query = buildDetachedTabQuery(tabId);
            (window as any).__TAURI__.core.invoke('create_detached_window', { 
              label: `browser-detached-${tabId}`, 
              query 
            }).catch((err: any) => console.error(err));
          }
          

        }}
        onReattachTab={(tabId) => {
          setTabContextMenu(null);
          const updated = tabs.map(t => t.id === tabId ? { ...t, isDetached: false } : t);
          setTabs(updated);
          localStorage.setItem('tline-tabs-v2', JSON.stringify(updated));

          if ((window as any).__TAURI__?.core?.invoke) {
            (window as any).__TAURI__.core.invoke('close_detached_window', { 
              label: `browser-detached-${tabId}`
            }).catch((err: any) => console.error(err));
          }
          setActiveTabId(tabId);
        }}
      />
    </div>
  );
}
