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
  HelpCircle
} from 'lucide-react';
import { wsManager } from './services/websocket';
import { FileViewerTab } from './components/FileViewerTab';
import { SetupSecurityForm, LoginForm } from './components/AuthForms';
import { WorkspaceAddModal, WorktreeAddModal, TunnelSetupModal, SettingsModal, ShortcutHelpModal, ConfirmModal, WorkspaceEditModal } from './components/Modals';
import { useTunnel } from './hooks/useTunnel';
import { useSystemStats } from './hooks/useSystemStats';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useUpdateChecker } from './hooks/useUpdateChecker';
import { useThemeAndFonts } from './hooks/useThemeAndFonts';
import { useTabUiHandlers } from './hooks/useTabUiHandlers';
import { useAuth } from './hooks/useAuth';
import { useTerminals, WorkspaceInfo, TabData } from './hooks/useTerminals';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SplitLayoutRenderer } from './components/SplitLayoutRenderer';
import { Footer } from './components/Footer';
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

export default function App() {
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    fontSans,
    setFontSans,
    fontMono,
    setFontMono,
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

  // Active panel state: 'workspaces' | 'explorer' | 'changes'
  const [activePanel, setActivePanel] = useState<'workspaces' | 'explorer' | 'changes' | 'tabs'>('workspaces');
  const [panelWorkspace, setPanelWorkspace] = useState<WorkspaceInfo | null>(null);
  const [panelWorktreePath, setPanelWorktreePath] = useState<string | null>(null);

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
    closeTerminal,
    closePane,
    splitFocusedTerminal,
    focusTerminal,
    handleTitleChange,
    handleActiveProcessesChange,
    importActiveSessions,
    refreshTerminal,
    refreshTriggers
  } = useTerminals(workspaces, () => setSidebarOpen(false));

  const {
    activeTooltip,
    tabContextMenu,
    getTabGitBranch,
    handleTabMouseEnter,
    handleTabMouseLeave,
    handleTabClick,
    handleTabContextMenu,
    handleCloseOtherTabs,
    handleCloseAllTabs
  } = useTabUiHandlers({
    tabs,
    setTabs,
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
    handleWorktreeClick
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
    setSidebarOpen,
    panelWorkspace,
    panelWorktreePath,
    setPanelWorktreePath
  });



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
    fetchLocalVersion();

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

      // Sync worktree path selection
      const matchedWtPath = getTabWorktreePath(activeTab, ws, terminalInstances);
      const wtObj = ws.worktrees?.find(wt => wt.path === matchedWtPath);
      const targetWtPath = (wtObj && !wtObj.isMain) ? matchedWtPath : ws.path;

      if (panelWorktreePath !== targetWtPath) {
        setPanelWorktreePath(targetWtPath);
      }

      // Dynamically sync terminal tab title with the current worktree branch name
      if (activeTab.type === 'terminal') {
        const expectedName = matchedWtPath 
          ? `${ws.name} (${wtObj?.branch || 'worktree'})`
          : ws.name;
        
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
      setPanelWorkspace(workspaces[0]);
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

  const filteredTabs = useMemo(() => {
    if (!panelWorkspace) {
      return tabs.filter(t => !t.workspaceId);
    }
    const wsTabs = tabs.filter(t => t.workspaceId === panelWorkspace.id);

    if (panelWorktreePath) {
      // In worktree mode, filter tabs to show only those belonging to that specific worktree
      return wsTabs.filter(t => {
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
  }, [tabs, panelWorkspace, panelWorktreePath, terminalInstances]);

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
        
        <div className="sidebar-header" style={{ padding: sidebarCollapsed ? '12px 0' : '12px 16px', gap: '8px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
          <TPlusLogo size={28} />
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
            deletingWorkspacePaths={deletingWorkspacePaths}
            deletingWorktreePaths={deletingWorktreePaths}
            panelWorktreePath={panelWorktreePath}
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
                return filteredTabs.map(t => {
                  const isFile = t.type === 'file';
                  const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
                  const shellType = focusedInst?.shellType || '';
                  const displayName = isFile ? t.name : (focusedInst?.name || t.name);
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

            {/* App Actions (Shortcuts, Settings, Logout) */}
            <div className="flex items-center gap-1.5 mr-2 desktop-only" style={{ WebkitAppRegion: 'no-drag' } as any}>
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

            {/* Window Controls (Electron Native style) */}
            {(window as any).electron && (
              <div className="window-controls flex items-center gap-0.5 desktop-only" style={{ WebkitAppRegion: 'no-drag' } as any}>
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
              </div>
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
              panelWorktreePath={panelWorktreePath}
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
                      onSave={() => {
                        fetchGitStatus(false);
                        fetchWorkspaces();
                      }}
                      theme={theme}
                      themeBackground={THEMES[theme]?.bgMain}
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
                      handleActiveProcessesChange={handleActiveProcessesChange}
                      focusTerminal={focusTerminal}
                      closePane={closePane}
                      splitFocusedTerminal={splitFocusedTerminal}
                      hasMultiplePanes={activeTab.layout.type === 'split'}
                      refreshTriggers={refreshTriggers}
                      fontFamily={MONO_FONTS[fontMono as keyof typeof MONO_FONTS]}
                      accentColor={accentColor}
                      themeBackground={THEMES[theme]?.bgMain}
                      themeForeground={THEMES[theme]?.textMain}
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

      <Footer
        panelWorkspace={panelWorkspace}
        panelWorktreePath={panelWorktreePath}
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
        appVersion={appVersion}
        updateAvailable={updateAvailable}
        latestVersion={latestVersion}
        systemStats={systemStats}
      />

      <TabTooltip activeTooltip={activeTooltip} tabContextMenu={tabContextMenu} />

      <TabContextMenu
        tabContextMenu={tabContextMenu}
        tabs={tabs}
        closeTerminal={closeTerminal}
        handleCloseOtherTabs={handleCloseOtherTabs}
        handleCloseAllTabs={handleCloseAllTabs}
        setActiveTabId={setActiveTabId}
        splitFocusedTerminal={splitFocusedTerminal}
      />
    </div>
  );
}
