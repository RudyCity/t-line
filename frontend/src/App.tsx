import React, { useState, useEffect, useCallback } from 'react';
import { GitFileStatus } from './components/FilePanel';
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
  HelpCircle
} from 'lucide-react';
import { wsManager } from './services/websocket';
import { FileViewerTab } from './components/FileViewerTab';
import { SetupSecurityForm, LoginForm } from './components/AuthForms';
import { WorkspaceAddModal, WorktreeAddModal, TunnelSetupModal, SettingsModal, ShortcutHelpModal, ConfirmModal, WorkspaceEditModal } from './components/Modals';
import { useTunnel } from './hooks/useTunnel';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useTerminals, WorkspaceInfo, getTerminalIds } from './hooks/useTerminals';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SplitLayoutRenderer } from './components/SplitLayoutRenderer';
import { Footer } from './components/Footer';
import { EmptyDashboard } from './components/EmptyDashboard';
import { MobileKeyboard } from './components/MobileKeyboard';
import { useLayoutHelpers } from './hooks/useLayoutHelpers';
import { SidebarContentPanel } from './components/SidebarContentPanel';
import { RightSidebar } from './components/RightSidebar';

export default function App() {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
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

  // Unified Alert/Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'primary' | 'secondary' | 'danger';
    isAlert?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

  const showAlert = useCallback((title: string, message: string) => {
    setConfirmDialog({
      show: true,
      title,
      message,
      isAlert: true,
      onConfirm: () => setConfirmDialog(null)
    });
  }, []);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    variant: 'primary' | 'secondary' | 'danger' = 'primary',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel'
  ) => {
    setConfirmDialog({
      show: true,
      title,
      message,
      confirmLabel,
      cancelLabel,
      variant,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  }, []);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [rightMenuOpen, setRightMenuOpen] = useState<boolean>(false);
  const [showShortcutModal, setShowShortcutModal] = useState<boolean>(false);
  const [showEditWorkspaceModal, setShowEditWorkspaceModal] = useState<boolean>(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceInfo | null>(null);

  const [showMobileKeyboard, setShowMobileKeyboard] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<{ id: string; x: number; y: number; title: string; branch?: string; path: string } | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

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
    repoBranches,
    gitLoading,
    handleOpenWorktreeModal,
    handleAddWorktree,
    handleRemoveWorktree,
    handleUpdateWorkspace
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

  // Active panel state: 'workspaces' | 'explorer' | 'changes'
  const [activePanel, setActivePanel] = useState<'workspaces' | 'explorer' | 'changes' | 'tabs'>('workspaces');
  const [panelWorkspace, setPanelWorkspace] = useState<WorkspaceInfo | null>(null);

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
    defaultShell,
    setDefaultShell,
    handleZoomIn,
    handleZoomOut,
    openTerminal,
    openFileTab,
    closeTerminal,
    closePane,
    splitFocusedTerminal,
    focusTerminal,
    handleTitleChange,
    importActiveSessions,
    refreshTerminal,
    refreshTriggers
  } = useTerminals(workspaces, () => setSidebarOpen(false));

  const { startResizing } = useLayoutHelpers(
    sidebarWidth,
    setSidebarWidth,
    tabs,
    setTabs,
    activeTabId
  );

  const [changedFiles, setChangedFiles] = useState<GitFileStatus[]>([]);
  const [gitStatusLoading, setGitStatusLoading] = useState<boolean>(false);

  const fetchGitStatus = useCallback(async (showLoading = false) => {
    if (!panelWorkspace || !panelWorkspace.isGit) {
      setChangedFiles([]);
      return;
    }
    if (showLoading) setGitStatusLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workspaces/${panelWorkspace.id}/git/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChangedFiles(data);
      }
    } catch (e) {
      console.error('Error fetching git status:', e);
    } finally {
      if (showLoading) setGitStatusLoading(false);
    }
  }, [panelWorkspace]);

  useEffect(() => {
    fetchGitStatus(true);
  }, [panelWorkspace, fetchGitStatus]);

  useEffect(() => {
    if (!panelWorkspace || !panelWorkspace.isGit) return;
    const interval = setInterval(() => {
      fetchGitStatus(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [panelWorkspace, fetchGitStatus]);

  // Handle workspace removal and close all associated terminal and file tabs
  const handleRemoveWorkspace = (workspacePath: string) => {
    showConfirm(
      'Remove Workspace',
      'Are you sure you want to remove this workspace from tracking? (Files will not be deleted)',
      async () => {
        const success = await rawHandleRemoveWorkspace(workspacePath);
        if (success) {
          const isPathInWorkspace = (filePath: string, wsPath: string) => {
            const normFile = filePath.toLowerCase().replace(/\\/g, '/');
            const normWS = wsPath.toLowerCase().replace(/\\/g, '/');
            return normFile === normWS || normFile.startsWith(normWS + '/');
          };

          setTabs(prevTabs => {
            const tabsToClose = prevTabs.filter(tab => {
              if (tab.type === 'file' && tab.filePath) {
                return isPathInWorkspace(tab.filePath, workspacePath);
              }
              if (tab.type === 'terminal' && tab.layout) {
                const termIds = getTerminalIds(tab.layout);
                return termIds.some(id => {
                  const inst = terminalInstances[id];
                  return inst && isPathInWorkspace(inst.cwd, workspacePath);
                });
              }
              return false;
            });

            if (tabsToClose.length === 0) return prevTabs;

            const closedTermIds: string[] = [];
            tabsToClose.forEach(tab => {
              if (tab.type === 'terminal' && tab.layout) {
                const termIds = getTerminalIds(tab.layout);
                termIds.forEach(id => {
                  wsManager.unsubscribe(id);
                  closedTermIds.push(id);
                });
              }
            });

            if (closedTermIds.length > 0) {
              setTerminalInstances(prevInstances => {
                const next = { ...prevInstances };
                closedTermIds.forEach(id => delete next[id]);
                return next;
              });
            }

            const remainingTabs = prevTabs.filter(t => !tabsToClose.some(c => c.id === t.id));

            if (tabsToClose.some(c => c.id === activeTabId)) {
              if (remainingTabs.length > 0) {
                setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
              } else {
                setActiveTabId('');
              }
            }

            return remainingTabs;
          });
        }
      },
      'danger',
      'Remove',
      'Cancel'
    );
  };

  const handleRemoveWorktreeWrapped = (wsId: string, wtPath: string) => {
    showConfirm(
      'Remove Worktree',
      `Are you sure you want to remove the worktree at ${wtPath}? This will delete the checked-out files but keep the branch.`,
      () => {
        handleRemoveWorktree(wsId, wtPath);
      },
      'danger',
      'Remove',
      'Cancel'
    );
  };

  const handleOpenEditWorkspaceModal = (workspace: WorkspaceInfo) => {
    setEditingWorkspace(workspace);
    setShowEditWorkspaceModal(true);
  };

  const handleUpdateWorkspaceSubmit = async (updates: { defaultShell: string; name: string }) => {
    if (!editingWorkspace) return;
    const success = await handleUpdateWorkspace(editingWorkspace.path, updates);
    if (success) {
      setShowEditWorkspaceModal(false);
      setEditingWorkspace(null);
    }
  };

  const getWorkspaceForTab = (tabId: string): WorkspaceInfo | null => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return null;

    if (tab.workspaceId) {
      const matched = workspaces.find(w => w.id === tab.workspaceId);
      if (matched) return matched;
    }
    
    const isPathInWorkspace = (filePath: string, wsPath: string) => {
      const normFile = filePath.toLowerCase().replace(/\\/g, '/');
      const normWS = wsPath.toLowerCase().replace(/\\/g, '/');
      return normFile === normWS || normFile.startsWith(normWS + '/');
    };

    if (tab.type === 'file' && tab.filePath) {
      const matched = workspaces.find(w => isPathInWorkspace(tab.filePath!, w.path));
      if (matched) return matched;
    } else if (tab.type === 'terminal' && tab.layout) {
      const termIds = getTerminalIds(tab.layout);
      if (tab.focusedTerminalId) {
        const inst = terminalInstances[tab.focusedTerminalId];
        if (inst && inst.cwd) {
          const matched = workspaces.find(w => isPathInWorkspace(inst.cwd, w.path));
          if (matched) return matched;
        }
      }
      for (const id of termIds) {
        const inst = terminalInstances[id];
        if (inst && inst.cwd) {
          const matched = workspaces.find(w => isPathInWorkspace(inst.cwd, w.path));
          if (matched) return matched;
        }
      }
    }
    return null;
  };

  // Update workspace's last active tab when activeTabId changes
  useEffect(() => {
    if (!activeTabId) return;
    const ws = getWorkspaceForTab(activeTabId);
    if (ws) {
      setWorkspaceActiveTab(ws.id, activeTabId);
    }
  }, [activeTabId, tabs, terminalInstances, workspaces]);

  const handleWorkspaceClick = (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;

    setPanelWorkspace(ws);

    // 1. Try to restore last active tab from memory
    const savedTabId = workspaceActiveTab[workspaceId];
    if (savedTabId && tabs.some(t => t.id === savedTabId)) {
      setActiveTabId(savedTabId);
      setSidebarOpen(false);
      return;
    }

    // 2. Try to find any open tab that matches this workspace
    const isPathInWorkspace = (filePath: string, wsPath: string) => {
      const normFile = filePath.toLowerCase().replace(/\\/g, '/');
      const normWS = wsPath.toLowerCase().replace(/\\/g, '/');
      return normFile === normWS || normFile.startsWith(normWS + '/');
    };

    const matchedTab = tabs.find(tab => {
      if (tab.type === 'file' && tab.filePath) {
        return isPathInWorkspace(tab.filePath, ws.path);
      }
      if (tab.type === 'terminal' && tab.layout) {
        const termIds = getTerminalIds(tab.layout);
        return termIds.some(id => {
          const inst = terminalInstances[id];
          return inst && isPathInWorkspace(inst.cwd, ws.path);
        });
      }
      return false;
    });

    if (matchedTab) {
      setActiveTabId(matchedTab.id);
    } else {
      // 3. Fallback: open a new terminal tab in this workspace
      openTerminal('Shell', ws.path);
    }
    setSidebarOpen(false);
  };

  const handleWorktreeClick = (workspaceId: string, wtPath: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;

    setPanelWorkspace(ws);

    const isPathInWorktree = (filePath: string, path: string) => {
      const normFile = filePath.toLowerCase().replace(/\\/g, '/');
      const normPath = path.toLowerCase().replace(/\\/g, '/');
      return normFile === normPath || normFile.startsWith(normPath + '/');
    };

    const matchedTab = tabs.find(tab => {
      if (tab.type === 'file' && tab.filePath) {
        return isPathInWorktree(tab.filePath, wtPath);
      }
      if (tab.type === 'terminal' && tab.layout) {
        const termIds = getTerminalIds(tab.layout);
        return termIds.some(id => {
          const inst = terminalInstances[id];
          return inst && isPathInWorktree(inst.cwd, wtPath);
        });
      }
      return false;
    });

    if (matchedTab) {
      setActiveTabId(matchedTab.id);
    } else {
      const wt = ws.worktrees.find(w => w.path === wtPath);
      const name = `${ws.name} (${wt?.branch || 'worktree'})`;
      openTerminal(name, wtPath, ws.defaultShell);
    }
    setSidebarOpen(false);
  };



  // Keyboard Shortcuts
  const hasModals = showWorkspaceModal || showWorktreeModal || showTunnelModal || showSettingsModal;
  useKeyboardShortcuts({
    enabled: isAuthenticated && !hasModals,
    onNewTerminal: () => openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || ''),
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
  });


  // Lifecycle
  useEffect(() => {
    checkAuth();

    if ((window as any).electron) {
      (window as any).electron.isMaximized().then(setIsMaximized);
      const unsubscribe = (window as any).electron.onMaximizedChange((maximized: boolean) => {
        setIsMaximized(maximized);
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      wsManager.connect();
      wsManager.setOnConnectionChange(setWsConnected);
      fetchDashboardData();
    }
  }, [isAuthenticated]);


  useEffect(() => {
    if (!isAuthenticated) return;

    if (workspaces.length === 0) {
      setPanelWorkspace(null);
      return;
    }

    if (workspaces.length === 1) {
      if (!panelWorkspace || panelWorkspace.id !== workspaces[0].id) {
        setPanelWorkspace(workspaces[0]);
      }
      return;
    }

    if (activePanel === 'explorer') {
      if (!panelWorkspace || !workspaces.some(w => w.id === panelWorkspace.id)) {
        setPanelWorkspace(workspaces[0]);
      }
    } else if (activePanel === 'changes') {
      const isCurrentGit = panelWorkspace && workspaces.find(w => w.id === panelWorkspace.id)?.isGit;
      if (!panelWorkspace || !isCurrentGit || !workspaces.some(w => w.id === panelWorkspace.id)) {
        const firstGit = workspaces.find(w => w.isGit);
        if (firstGit) {
          setPanelWorkspace(firstGit);
        } else {
          setPanelWorkspace(workspaces[0]);
        }
      }
    }
  }, [workspaces, activePanel, panelWorkspace, isAuthenticated]);

  const checkAuth = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        localStorage.setItem('token', urlToken);
        wsManager.setToken(urlToken);
      }

      const token = localStorage.getItem('token');
      
      // 1. Check setup status
      const setupRes = await fetch('/api/auth/setup-status');
      const setupData = await setupRes.json();
      setSetupRequired(setupData.setupRequired);

      if (setupData.setupRequired) {
        setLoading(false);
        return;
      }

      // 2. Verify token if exists
      if (token) {
        const verifyRes = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const verifyData = await verifyRes.json();
        if (verifyData.valid) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('token');
        }
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        wsManager.setToken(data.token);
        setIsAuthenticated(true);
        setSetupRequired(false);
      } else {
        setAuthError(data.error);
      }
    } catch (e) {
      setAuthError('Failed to execute setup.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        wsManager.setToken(data.token);
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error);
      }
    } catch (e) {
      setAuthError('Failed to execute login.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tline-tabs-v2');
    localStorage.removeItem('tline-terminal-instances-v2');
    localStorage.removeItem('tline-active-tab-id');
    setTabs([]);
    setTerminalInstances({});
    setActiveTabId('');
    setIsAuthenticated(false);
    setPassword('');
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

  const fetchDashboardData = () => {
    fetchWorkspaces();
    fetchTunnelStatus();
    checkActiveSessions();
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

  const getTabGitBranch = (t: any): string | null => {
    const isFile = t.type === 'file';
    const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
    const path = isFile ? (t.filePath || '') : (focusedInst?.cwd || t.cwd || '');
    if (!path) return null;

    const normPath = path.toLowerCase().replace(/\\/g, '/');

    const isUnder = (parent: string, child: string) => {
      const normParent = parent.toLowerCase().replace(/\\/g, '/');
      return child === normParent || child.startsWith(normParent + '/');
    };

    for (const w of workspaces) {
      if (w.isGit) {
        for (const wt of w.worktrees) {
          if (isUnder(wt.path, normPath)) {
            return wt.branch || 'detached';
          }
        }
      }
    }
    return null;
  };

  const handleTabMouseEnter = (e: React.MouseEvent<HTMLDivElement>, t: any) => {
    if (tabContextMenu) return;
    const isFile = t.type === 'file';
    const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
    const shellType = focusedInst?.shellType || '';
    const displayName = isFile ? t.name : (focusedInst?.name || t.name);
    const path = isFile ? (t.filePath || '') : (focusedInst?.cwd || t.cwd || '');
    const branch = getTabGitBranch(t);
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      id: t.id,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
      title: isFile ? `File: ${displayName}` : `Terminal: ${displayName}${shellType ? ` (${shellType})` : ''}`,
      branch: branch || undefined,
      path
    });
  };

  const handleTabMouseLeave = () => {
    setActiveTooltip(null);
  };

  const handleTabClick = (t: any) => {
    setActiveTabId(t.id);
    setActiveTooltip(null);
  };

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveTooltip(null);
    setTabContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId
    });
  };

  useEffect(() => {
    if (!tabContextMenu) return;
    const closeMenu = () => setTabContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
    };
  }, [tabContextMenu]);

  useEffect(() => {
    if (activeTooltip && !tabs.some(t => t.id === activeTooltip.id)) {
      setActiveTooltip(null);
    }
  }, [tabs, activeTooltip]);

  const handleCloseOtherTabs = (tabId: string) => {
    setTabs(prevTabs => {
      const remainingTabs = prevTabs.filter(t => t.id === tabId || t.workspaceId !== panelWorkspace?.id);
      const closedTabs = prevTabs.filter(t => t.id !== tabId && t.workspaceId === panelWorkspace?.id);
      const closedTermIds: string[] = [];
      closedTabs.forEach(t => {
        if (t.type === 'terminal' && t.layout) {
          const termIds = getTerminalIds(t.layout);
          termIds.forEach(id => {
            wsManager.unsubscribe(id);
            closedTermIds.push(id);
          });
        }
      });

      if (closedTermIds.length > 0) {
        setTerminalInstances(prev => {
          const next = { ...prev };
          closedTermIds.forEach(id => delete next[id]);
          return next;
        });
      }

      if (!remainingTabs.some(t => t.id === activeTabId)) {
        setActiveTabId(tabId);
      }

      return remainingTabs;
    });
  };

  const handleCloseAllTabs = () => {
    setTabs(prevTabs => {
      const remainingTabs = prevTabs.filter(t => t.workspaceId !== panelWorkspace?.id);
      const closedTabs = prevTabs.filter(t => t.workspaceId === panelWorkspace?.id);
      const closedTermIds: string[] = [];
      closedTabs.forEach(t => {
        if (t.type === 'terminal' && t.layout) {
          const termIds = getTerminalIds(t.layout);
          termIds.forEach(id => {
            wsManager.unsubscribe(id);
            closedTermIds.push(id);
          });
        }
      });

      if (closedTermIds.length > 0) {
        setTerminalInstances(prev => {
          const next = { ...prev };
          closedTermIds.forEach(id => delete next[id]);
          return next;
        });
      }

      setActiveTabId('');
      return remainingTabs;
    });
  };

  if (loading) {
    return (
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
    return (
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
    return (
      <LoginForm
        onSubmit={handleLogin}
        password={password}
        setPassword={setPassword}
        error={authError}
      />
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

  const filteredTabs = tabs.filter(t => t.workspaceId === panelWorkspace?.id);

  return (
    <div className="app-container">
      
      <div className="app-content-wrapper">
        
        {/* Sidebar Panel */}
        <div 
          className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
          style={{
            width: sidebarCollapsed ? '48px' : `${sidebarWidth}px`,
            minWidth: sidebarCollapsed ? '48px' : `${sidebarWidth}px`
          }}
        >
        
        <div className="sidebar-header" style={{ padding: sidebarCollapsed ? '12px 0' : '12px 16px', gap: '8px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
          <TerminalIcon size={16} className="text-purple-400 shrink-0" />
          {!sidebarCollapsed && (
            <span className="logo-text" style={{ fontSize: '1.05rem', fontWeight: 600 }}>t-line</span>
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
            {!sidebarCollapsed && <span>Workspaces</span>}
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
            {!sidebarCollapsed && <span>Explorer</span>}
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
              {sidebarCollapsed && changedFiles.length > 0 && (
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
            {!sidebarCollapsed && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Changes
                {changedFiles.length > 0 && (
                  <span className="changes-badge">{changedFiles.length}</span>
                )}
              </span>
            )}
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
            changedFiles={changedFiles}
            gitStatusLoading={gitStatusLoading}
            refreshGitStatus={() => fetchGitStatus(true)}
            onEditWorkspace={handleOpenEditWorkspaceModal}
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
        <div className="sidebar-overlay md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {rightMenuOpen && (
        <div className="sidebar-overlay md:hidden" onClick={() => setRightMenuOpen(false)} />
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
        handleLogout={handleLogout}
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
      />

      {/* Main Panel */}
      <div className="main-panel">
        
        {/* Topbar */}
        <div className="top-bar flex items-center justify-between">
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

          {/* Left Divider if there are tabs */}
          {filteredTabs.length > 0 && (
            <div className="window-controls-separator shrink-0 desktop-only" style={{ margin: '0 12px', height: '16px' }} />
          )}

          {/* Integrated Tab Bar */}
          {filteredTabs.length > 0 && (
            <div className="chrome-tabs-container mx-3 desktop-only" style={{ WebkitAppRegion: 'no-drag' } as any}>
              {filteredTabs.map(t => {
                const isFile = t.type === 'file';
                const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
                const shellType = focusedInst?.shellType || '';
                const displayName = isFile ? t.name : (focusedInst?.name || t.name);
                const branch = getTabGitBranch(t);
                return (
                  <div 
                    key={t.id} 
                    className={`tab ${activeTabId === t.id ? 'tab-active' : ''}`}
                    onClick={() => handleTabClick(t)}
                    onMouseEnter={(e) => handleTabMouseEnter(e, t)}
                    onMouseLeave={handleTabMouseLeave}
                    onContextMenu={(e) => handleTabContextMenu(e, t.id)}
                  >
                    {!isFile && branch && (
                      <span className="tab-branch-prefix shrink-0">
                        <GitBranch size={10} />
                        <span>{branch}</span>
                        <span className="tab-branch-separator">|</span>
                      </span>
                    )}
                    {isFile ? (
                      <FileCode size={13} className="tab-icon shrink-0" style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                    ) : (
                      <TerminalIcon size={13} className="tab-icon shrink-0" style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                    )}
                    <span className="tab-title-container">
                      <span className="tab-title">{displayName}</span>
                      {shellType && (
                        <span className="tab-shell-type">({shellType === 'powershell' ? 'ps' : shellType})</span>
                      )}
                    </span>
                    <span className="tab-close" onClick={(e) => closeTerminal(t.id, e)}>×</span>
                  </div>
                );
              })}
              {/* New Terminal button */}
              <button
                className="action-btn shrink-0"
                onClick={() => openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '')}
                title="New terminal (Alt+T)"
                style={{ marginLeft: '6px' }}
              >
                <Plus size={14} />
              </button>
            </div>
          )}


          {/* Right Divider if there are tabs */}
          {filteredTabs.length > 0 && (
            <div className="window-controls-separator shrink-0 desktop-only" style={{ margin: '0 12px', height: '16px' }} />
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

            {/* Unified Control Pill */}
            <div className="window-controls flex items-center bg-slate-950/20 border border-white/5 rounded-lg p-0.5 desktop-only" style={{ WebkitAppRegion: 'no-drag' } as any}>
              <button type="button" className="window-control-btn" onClick={() => setShowShortcutModal(true)} title="Keyboard Shortcuts">
                <HelpCircle size={13} />
              </button>
              <button type="button" className="window-control-btn" onClick={() => setShowSettingsModal(true)} title="Settings">
                <Settings size={13} />
              </button>
              <button type="button" className="window-control-btn" onClick={handleLogout} title="Log out">
                <LogOut size={13} />
              </button>
              
              {(window as any).electron && (
                <>
                  <div style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
                  <button type="button" className="window-control-btn" onClick={() => (window as any).electron.minimize()} title="Minimize">
                    <span style={{ fontSize: '10px' }}>—</span>
                  </button>
                  <button 
                    type="button" 
                    className="window-control-btn" 
                    onClick={() => (window as any).electron.maximize()} 
                    title={isMaximized ? "Restore" : "Maximize"}
                  >
                    <span style={{ fontSize: '10px' }}>{isMaximized ? "❐" : "▢"}</span>
                  </button>
                  <button type="button" className="window-control-btn window-control-btn-close" onClick={() => (window as any).electron.close()} title="Close">
                    <span style={{ fontSize: '10px' }}>✕</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>



        {/* Dynamic Panels */}
        <div className={`content-area ${filteredTabs.length > 0 ? 'content-area-tabs' : 'content-area-empty'}`}>
          {filteredTabs.length === 0 ? (
            
            // Empty Dashboard Welcome View
            <EmptyDashboard
              setShowWorkspaceModal={setShowWorkspaceModal}
              openTerminal={openTerminal}
              panelWorkspace={panelWorkspace}
              workspaces={workspaces}
            />
            
          ) : (
            
            // Terminals View — supports split pane and drag-and-drop splitting
            <div className="terminal-container">


              {(() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (!activeTab) return null;
                if (activeTab.type === 'file') {
                  return (
                    <FileViewerTab
                      filePath={activeTab.filePath || ''}
                      token={localStorage.getItem('token') || ''}
                      onSave={() => fetchGitStatus(false)}
                    />
                  );
                }
                if (activeTab.type === 'terminal' && activeTab.layout) {
                  return (
                    <SplitLayoutRenderer
                      node={activeTab.layout}
                      activeTabId={activeTabId}
                      focusedTerminalId={activeTab.focusedTerminalId}
                      wsConnected={wsConnected}
                      terminalFontSize={terminalFontSize}
                      terminalInstances={terminalInstances}
                      handleTitleChange={handleTitleChange}
                      focusTerminal={focusTerminal}
                      closePane={closePane}
                      splitFocusedTerminal={splitFocusedTerminal}
                      hasMultiplePanes={activeTab.layout.type === 'split'}
                      refreshTriggers={refreshTriggers}
                    />
                  );
                }
                return null;
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

      <Footer
        panelWorkspace={panelWorkspace}
        tunnelStatus={tunnelStatus}
        tunnelLoading={tunnelLoading}
        terminalFontSize={terminalFontSize}
        defaultShell={defaultShell}
        setDefaultShell={setDefaultShell}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handleStartTunnel={handleStartTunnel}
        handleStopTunnel={handleStopTunnel}
        activeTabType={tabs.find(t => t.id === activeTabId)?.type || null}
        onRefreshTerminal={() => refreshTerminal(tabs.find(t => t.id === activeTabId)?.focusedTerminalId || '')}
        activeTabPath={getActiveTabPath()}
      />

      {activeTooltip && !tabContextMenu && (
        <div 
          className="tab-tooltip"
          style={{
            position: 'fixed',
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          <div className="tab-tooltip-title">{activeTooltip.title}</div>
          {activeTooltip.branch && (
            <div className="tab-tooltip-branch">
              <GitBranch size={10} className="shrink-0" />
              <span>{activeTooltip.branch}</span>
            </div>
          )}
          <div className="tab-tooltip-path">{activeTooltip.path}</div>
        </div>
      )}

      {tabContextMenu && (
        <div 
          className="terminal-context-menu"
          style={{
            position: 'fixed',
            top: tabContextMenu.y,
            left: tabContextMenu.x,
            zIndex: 1000
          }}
        >
          <button
            onClick={() => closeTerminal(tabContextMenu.tabId)}
            className="terminal-context-menu-item"
          >
            <span>Close Tab</span>
          </button>
          <button
            onClick={() => handleCloseOtherTabs(tabContextMenu.tabId)}
            className="terminal-context-menu-item"
          >
            <span>Close Other Tabs</span>
          </button>
          <button
            onClick={handleCloseAllTabs}
            className="terminal-context-menu-item"
          >
            <span>Close All Tabs</span>
          </button>
          {tabs.find(t => t.id === tabContextMenu.tabId)?.type === 'terminal' && (
            <>
              <div className="terminal-context-menu-separator" />
              <button
                onClick={() => {
                  setActiveTabId(tabContextMenu.tabId);
                  setTimeout(() => splitFocusedTerminal('vertical'), 50);
                }}
                className="terminal-context-menu-item"
              >
                <span>Split Pane Vertically</span>
              </button>
              <button
                onClick={() => {
                  setActiveTabId(tabContextMenu.tabId);
                  setTimeout(() => splitFocusedTerminal('horizontal'), 50);
                }}
                className="terminal-context-menu-item"
              >
                <span>Split Pane Horizontally</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
