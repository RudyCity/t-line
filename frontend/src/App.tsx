import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  Plus, 
  Terminal as TerminalIcon, 
  LogOut, 
  Loader2, 
  Menu as MenuIcon,
  GitCompare,
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
import { WorkspaceAddModal, WorktreeAddModal, TunnelSetupModal, SettingsModal, ShortcutHelpModal } from './components/Modals';
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
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [rightMenuOpen, setRightMenuOpen] = useState<boolean>(false);
  const [showShortcutModal, setShowShortcutModal] = useState<boolean>(false);

  const [showMobileKeyboard, setShowMobileKeyboard] = useState<boolean>(false);

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
    handleRemoveWorktree
  } = useWorkspaces(isAuthenticated, localStorage.getItem('token'));

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
  } = useTunnel(isAuthenticated);

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

  // Handle workspace removal and close all associated terminal and file tabs
  const handleRemoveWorkspace = async (workspacePath: string) => {
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
            <GitCompare size={15} />
            {!sidebarCollapsed && <span>Changes</span>}
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
            handleRemoveWorktree={handleRemoveWorktree}
            openFileTab={openFileTab}
            closeTerminal={closeTerminal}
            workspaceActiveTab={workspaceActiveTab}
            onWorkspaceClick={handleWorkspaceClick}
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
            <div className="flex items-center gap-2 flex-1 overflow-x-auto mx-3 h-full desktop-only" style={{ scrollbarWidth: 'none', WebkitAppRegion: 'no-drag' } as any}>
              {filteredTabs.map(t => {
                const isFile = t.type === 'file';
                const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
                const shellType = focusedInst?.shellType || '';
                const displayName = isFile ? t.name : (focusedInst?.name || t.name);
                return (
                  <div 
                    key={t.id} 
                    className={`tab ${activeTabId === t.id ? 'tab-active' : ''}`}
                    onClick={() => setActiveTabId(t.id)}
                    style={{ 
                      height: '32px', 
                      padding: '0 12px', 
                      borderRadius: '6px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      fontSize: '0.75rem', 
                      background: activeTabId === t.id ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                      border: activeTabId === t.id ? '1px solid rgba(168, 85, 247, 0.25)' : '1px solid transparent',
                      color: activeTabId === t.id ? '#c084fc' : 'var(--text-muted)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isFile ? (
                      <FileCode size={13} style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                    ) : (
                      <TerminalIcon size={13} style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                    )}
                    <span>{displayName}</span>
                    {shellType && (
                      <span style={{ fontSize: '0.65rem', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>({shellType === 'powershell' ? 'ps' : shellType})</span>
                    )}
                    <span className="tab-close" onClick={(e) => closeTerminal(t.id, e)} style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.6 }}>×</span>
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

          <div className="top-bar-actions flex items-center gap-3 shrink-0">
            <button 
              className={`action-btn mobile-only ${showMobileKeyboard ? 'text-purple-400 bg-purple-500/10' : ''}`}
              onClick={() => setShowMobileKeyboard(v => !v)}
              title="Toggle virtual touch keyboard"
            >
              <Keyboard size={18} />
            </button>
            <button className="action-btn desktop-only" onClick={() => setShowShortcutModal(true)} title="Keyboard Shortcuts">
              <HelpCircle size={16} />
            </button>
            <button className="action-btn desktop-only" onClick={() => setShowSettingsModal(true)} title="Settings">
              <Settings size={16} />
            </button>
            <button className="action-btn desktop-only" onClick={handleLogout} title="Log out">
              <LogOut size={16} />
            </button>
            <button 
              className="action-btn mobile-only" 
              onClick={() => setRightMenuOpen(!rightMenuOpen)} 
              title="Toggle Menu"
            >
              <MoreVertical size={18} />
            </button>
            {(window as any).electron && (
              <>
                <div className="window-controls-separator" style={{ margin: '0 12px' }} />
                <div className="window-controls flex items-center">
                  <button type="button" className="window-control-btn" onClick={() => (window as any).electron.minimize()} title="Minimize">—</button>
                  <button 
                    type="button" 
                    className="window-control-btn" 
                    onClick={() => (window as any).electron.maximize()} 
                    title={isMaximized ? "Restore" : "Maximize"}
                  >
                    {isMaximized ? "❐" : "▢"}
                  </button>
                  <button type="button" className="window-control-btn window-control-btn-close" onClick={() => (window as any).electron.close()} title="Close">✕</button>
                </div>
              </>
            )}
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
                    <FileViewerTab filePath={activeTab.filePath || ''} token={localStorage.getItem('token') || ''} />
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
                      onTerminalFocus={() => {
                        if (window.innerWidth <= 768) {
                          setShowMobileKeyboard(true);
                        }
                      }}
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
      />

      <ShortcutHelpModal
        show={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
      />

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
      />
    </div>
  );
}
