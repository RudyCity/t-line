import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Keyboard
} from 'lucide-react';
import { wsManager } from './services/websocket';
import { FileViewerTab } from './components/FileViewerTab';
import { SetupSecurityForm, LoginForm } from './components/AuthForms';
import { WorkspaceAddModal, WorktreeAddModal, TunnelSetupModal, SettingsModal, ShortcutHelpModal } from './components/Modals';
import { FileExplorer, GitChanges } from './components/FilePanel';
import { useTunnel } from './hooks/useTunnel';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useTerminals, WorkspaceInfo } from './hooks/useTerminals';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SplitLayoutRenderer } from './components/SplitLayoutRenderer';
import { Footer } from './components/Footer';
import { WorkspaceList } from './components/WorkspaceList';
import { EmptyDashboard } from './components/EmptyDashboard';

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
  const [showShortcutModal, setShowShortcutModal] = useState<boolean>(false);
  const draggedTabIdRef = useRef<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);

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
    handleRemoveWorkspace,
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
    fetchTunnelStatus,
    handleStartTunnel,
    handleStartTokenTunnel,
    handleStopTunnel
  } = useTunnel(isAuthenticated);

  // Active panel state: 'workspaces' | 'explorer' | 'changes'
  const [activePanel, setActivePanel] = useState<'workspaces' | 'explorer' | 'changes'>('workspaces');
  const [panelWorkspace, setPanelWorkspace] = useState<WorkspaceInfo | null>(null);

  // Terminal state management hook
  const {
    tabs,
    setTabs,
    terminalInstances,
    setTerminalInstances,
    activeTabId,
    setActiveTabId,
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
    handleTitleChange
  } = useTerminals(workspaces, () => setSidebarOpen(false));

  // Helper for drag-and-drop merging of tabs
  const handleMergeTab = useCallback((draggedId: string, direction: 'horizontal' | 'vertical') => {
    if (draggedId === activeTabId) return;
    const draggedTab = tabs.find(t => t.id === draggedId);
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!draggedTab || !activeTab || draggedTab.type !== 'terminal' || activeTab.type !== 'terminal') return;

    const activeLayout = activeTab.layout;
    const draggedLayout = draggedTab.layout;
    if (!activeLayout || !draggedLayout) return;

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== draggedId);
      return filtered.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            layout: {
              type: 'split',
              direction,
              first: activeLayout,
              second: draggedLayout
            },
            focusedTerminalId: draggedTab.focusedTerminalId
          };
        }
        return t;
      });
    });
  }, [tabs, activeTabId, setTabs]);

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
      const idx = tabs.findIndex(t => t.id === activeTabId);
      if (idx !== -1 && tabs.length > 1) {
        setActiveTabId(tabs[(idx + 1) % tabs.length].id);
      }
    },
    onPrevTab: () => {
      const idx = tabs.findIndex(t => t.id === activeTabId);
      if (idx !== -1 && tabs.length > 1) {
        setActiveTabId(tabs[(idx - 1 + tabs.length) % tabs.length].id);
      }
    },
    onJumpToTab: (index) => {
      if (tabs[index]) setActiveTabId(tabs[index].id);
    },
    onSplitHorizontal: () => {
      splitFocusedTerminal('horizontal');
    },
    onSplitVertical: () => {
      splitFocusedTerminal('vertical');
    },
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

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startWidth = sidebarWidth;
    const startX = mouseDownEvent.clientX;

    const doDrag = (mouseMoveEvent: MouseEvent) => {
      const newWidth = startWidth + (mouseMoveEvent.clientX - startX);
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
        localStorage.setItem('tline-sidebar-width', newWidth.toString());
      }
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };
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

  const fetchDashboardData = () => {
    fetchWorkspaces();
    fetchTunnelStatus();
  };



  // Terminals management
  const getWorkspaceActiveBranch = (workspace: WorkspaceInfo | null): { name: string; isDirty: boolean; isMain: boolean } | null => {
    if (!workspace || !workspace.isGit || !workspace.worktrees || workspace.worktrees.length === 0) return null;
    
    const activeWt = workspace.worktrees.find(wt => wt.path === workspace.path) 
      || workspace.worktrees.find(wt => wt.isMain) 
      || workspace.worktrees[0];
      
    if (!activeWt) return null;
    return {
      name: activeWt.branch || 'detached',
      isDirty: !!activeWt.isDirty,
      isMain: activeWt.isMain
    };
  };





  // Loading Screen
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

  return (
    <div className="app-container">
      
      <div className="app-content-wrapper">
        
        {/* Sidebar Panel */}
        <div 
          className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
          style={{
            width: sidebarCollapsed ? 0 : `${sidebarWidth}px`,
            minWidth: sidebarCollapsed ? 0 : `${sidebarWidth}px`
          }}
        >
        
        <div className="sidebar-header" style={{ padding: '12px 16px', gap: '8px' }}>
          <TerminalIcon size={16} className="text-purple-400 shrink-0" />
          <span className="logo-text" style={{ fontSize: '1.05rem', fontWeight: 600 }}>t-line</span>
        </div>

        {/* Sidebar Panel Tabs */}
        <div className="sidebar-panel-tabs">
          <button
            className={`sidebar-panel-tab ${activePanel === 'workspaces' ? 'active' : ''}`}
            onClick={() => setActivePanel('workspaces')}
            title="Workspaces"
          >
            <Folder size={15} />
            <span>Workspaces</span>
          </button>
          <button
            className={`sidebar-panel-tab ${activePanel === 'explorer' ? 'active' : ''}`}
            onClick={() => setActivePanel('explorer')}
            title="File Explorer"
          >
            <FolderTree size={15} />
            <span>Explorer</span>
          </button>
          <button
            className={`sidebar-panel-tab ${activePanel === 'changes' ? 'active' : ''}`}
            onClick={() => setActivePanel('changes')}
            title="Git Changes"
          >
            <GitCompare size={15} />
            <span>Changes</span>
          </button>
        </div>

        <div 
          className="sidebar-content"
          style={{
            padding: activePanel === 'workspaces' ? '16px 0px' : '0px',
            gap: activePanel === 'workspaces' ? '16px' : '0px'
          }}
        >

          {/* ── Workspaces Panel ── */}
          {activePanel === 'workspaces' && (
          <div>
            <div className="section-title" style={{ padding: '0 16px' }}>
              <span>Workspaces</span>
              <button className="action-btn" onClick={() => { setShowWorkspaceModal(true); setSidebarOpen(false); }} title="Add Workspace">
                <Plus size={16} />
              </button>
            </div>

            <WorkspaceList
              workspaces={workspaces}
              setPanelWorkspace={setPanelWorkspace}
              setActivePanel={setActivePanel}
              handleOpenWorktreeModal={handleOpenWorktreeModal}
              openTerminal={openTerminal}
              handleRemoveWorkspace={handleRemoveWorkspace}
              handleRemoveWorktree={handleRemoveWorktree}
            />

              {workspaces.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.85rem', padding: '16px' }}>
                  No workspaces registered.
                </div>
              )}
          </div>
          )}

          {/* ── File Explorer Panel ── */}
          {activePanel === 'explorer' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {workspaces.length > 0 && (
                <div className="workspace-select-bar">
                  <span className="select-bar-label">Workspace:</span>
                  <select
                    value={panelWorkspace?.id || ''}
                    onChange={(e) => {
                      const ws = workspaces.find(w => w.id === e.target.value);
                      if (ws) setPanelWorkspace(ws);
                    }}
                    className="workspace-select-dropdown"
                  >
                    <option value="" disabled>Select Workspace...</option>
                    {workspaces.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {panelWorkspace ? (
                <FileExplorer
                  rootPath={panelWorkspace.path}
                  token={localStorage.getItem('token') || ''}
                  onFileClick={openFileTab}
                />
              ) : (
                <div className="panel-empty" style={{ flex: 1 }}>
                  <FolderTree size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <span>No workspace selected</span>
                </div>
              )}
            </div>
          )}

          {/* ── Git Changes Panel ── */}
          {activePanel === 'changes' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {workspaces.filter(w => w.isGit).length > 0 && (
                <div className="workspace-select-bar">
                  <span className="select-bar-label">Workspace:</span>
                  <select
                    value={panelWorkspace?.id || ''}
                    onChange={(e) => {
                      const ws = workspaces.find(w => w.id === e.target.value);
                      if (ws) setPanelWorkspace(ws);
                    }}
                    className="workspace-select-dropdown"
                  >
                    <option value="" disabled>Select Workspace...</option>
                    {workspaces.filter(w => w.isGit).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {panelWorkspace && panelWorkspace.isGit ? (
                <GitChanges
                  workspaceId={panelWorkspace.id}
                  token={localStorage.getItem('token') || ''}
                />
              ) : (
                <div className="panel-empty" style={{ flex: 1 }}>
                  <GitCompare size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <span>No Git workspace selected</span>
                </div>
              )}
            </div>
          )}


        </div>
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
          {tabs.length > 0 && (
            <div className="window-controls-separator shrink-0" style={{ margin: '0 12px', height: '16px' }} />
          )}

          {/* Integrated Tab Bar */}
          {tabs.length > 0 && (
            <div className="flex items-center gap-2 flex-1 overflow-x-auto mx-3 h-full" style={{ scrollbarWidth: 'none', WebkitAppRegion: 'no-drag' } as any}>
              {tabs.map(t => {
                const isFile = t.type === 'file';
                const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
                const shellType = focusedInst?.shellType || '';
                return (
                  <div 
                    key={t.id} 
                    className={`tab ${activeTabId === t.id ? 'tab-active' : ''}`}
                    onClick={() => setActiveTabId(t.id)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', t.id);
                      draggedTabIdRef.current = t.id;
                      document.body.classList.add('tab-dragging');
                    }}
                    onDragEnd={() => {
                      draggedTabIdRef.current = null;
                      document.body.classList.remove('tab-dragging');
                    }}
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
                      cursor: 'grab',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isFile ? (
                      <FileCode size={13} style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                    ) : (
                      <TerminalIcon size={13} style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                    )}
                    <span>{t.name}</span>
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
          {tabs.length > 0 && (
            <div className="window-controls-separator shrink-0" style={{ margin: '0 12px', height: '16px' }} />
          )}

          <div className="top-bar-actions flex items-center gap-3 shrink-0">
            <button className="action-btn" onClick={() => setShowShortcutModal(true)} title="Keyboard Shortcuts">
              <Keyboard size={16} />
            </button>
            <button className="action-btn" onClick={() => setShowSettingsModal(true)} title="Settings">
              <Settings size={16} />
            </button>
            <button className="action-btn" onClick={handleLogout} title="Log out">
              <LogOut size={16} />
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
        <div className="content-area" style={{ padding: tabs.length === 0 ? '16px' : '0', gap: '0' }}>
          {tabs.length === 0 ? (
            
            // Empty Dashboard Welcome View
            <EmptyDashboard
              setShowWorkspaceModal={setShowWorkspaceModal}
              openTerminal={openTerminal}
              panelWorkspace={panelWorkspace}
              workspaces={workspaces}
            />
            
          ) : (
            
            // Terminals View — supports split pane and drag-and-drop splitting
            <div className="terminal-container" style={{ flex: 1, border: 'none', borderRadius: 0, padding: 0, display: 'flex', flexDirection: 'row', position: 'relative' }}>
              {/* Drop Zones Overlay for Drag and Drop Splitting */}
              <div className="drag-drop-overlay">
                {/* Left Zone */}
                <div
                  className="drag-drop-zone"
                  style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '25%',
                    borderRight: dragOverZone === 'left' ? '2.5px solid rgba(168,85,247,0.85)' : '2px dashed rgba(168,85,247,0.4)',
                    background: dragOverZone === 'left' ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.03)',
                    boxShadow: dragOverZone === 'left' ? 'inset 15px 0 30px -15px rgba(168,85,247,0.25)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease-in-out',
                    color: dragOverZone === 'left' ? '#c084fc' : 'rgba(168,85,247,0.5)',
                    fontWeight: dragOverZone === 'left' ? 'bold' : 'normal',
                    fontSize: '12px'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setDragOverZone('left')}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    const draggedId = e.dataTransfer.getData('text/plain') || draggedTabIdRef.current;
                    if (draggedId) {
                      handleMergeTab(draggedId, 'horizontal');
                    }
                    document.body.classList.remove('tab-dragging');
                  }}
                >
                  <span style={{ writingMode: 'vertical-lr' }}>Split Left</span>
                </div>

                {/* Right Zone */}
                <div
                  className="drag-drop-zone"
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: '25%',
                    borderLeft: dragOverZone === 'right' ? '2.5px solid rgba(168,85,247,0.85)' : '2px dashed rgba(168,85,247,0.4)',
                    background: dragOverZone === 'right' ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.03)',
                    boxShadow: dragOverZone === 'right' ? 'inset -15px 0 30px -15px rgba(168,85,247,0.25)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease-in-out',
                    color: dragOverZone === 'right' ? '#c084fc' : 'rgba(168,85,247,0.5)',
                    fontWeight: dragOverZone === 'right' ? 'bold' : 'normal',
                    fontSize: '12px'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setDragOverZone('right')}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    const draggedId = e.dataTransfer.getData('text/plain') || draggedTabIdRef.current;
                    if (draggedId) {
                      handleMergeTab(draggedId, 'horizontal');
                    }
                    document.body.classList.remove('tab-dragging');
                  }}
                >
                  <span style={{ writingMode: 'vertical-lr' }}>Split Right</span>
                </div>

                {/* Top Zone */}
                <div
                  className="drag-drop-zone"
                  style={{
                    position: 'absolute', left: '25%', right: '25%', top: 0, height: '25%',
                    borderBottom: dragOverZone === 'top' ? '2.5px solid rgba(168,85,247,0.85)' : '2px dashed rgba(168,85,247,0.4)',
                    background: dragOverZone === 'top' ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.03)',
                    boxShadow: dragOverZone === 'top' ? 'inset 0 15px 30px -15px rgba(168,85,247,0.25)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease-in-out',
                    color: dragOverZone === 'top' ? '#c084fc' : 'rgba(168,85,247,0.5)',
                    fontWeight: dragOverZone === 'top' ? 'bold' : 'normal',
                    fontSize: '12px'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setDragOverZone('top')}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    const draggedId = e.dataTransfer.getData('text/plain') || draggedTabIdRef.current;
                    if (draggedId) {
                      handleMergeTab(draggedId, 'vertical');
                    }
                    document.body.classList.remove('tab-dragging');
                  }}
                >
                  <span>Split Top</span>
                </div>

                {/* Bottom Zone */}
                <div
                  className="drag-drop-zone"
                  style={{
                    position: 'absolute', left: '25%', right: '25%', bottom: 0, height: '25%',
                    borderTop: dragOverZone === 'bottom' ? '2.5px solid rgba(168,85,247,0.85)' : '2px dashed rgba(168,85,247,0.4)',
                    background: dragOverZone === 'bottom' ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.03)',
                    boxShadow: dragOverZone === 'bottom' ? 'inset 0 -15px 30px -15px rgba(168,85,247,0.25)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease-in-out',
                    color: dragOverZone === 'bottom' ? '#c084fc' : 'rgba(168,85,247,0.5)',
                    fontWeight: dragOverZone === 'bottom' ? 'bold' : 'normal',
                    fontSize: '12px'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setDragOverZone('bottom')}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    const draggedId = e.dataTransfer.getData('text/plain') || draggedTabIdRef.current;
                    if (draggedId) {
                      handleMergeTab(draggedId, 'vertical');
                    }
                    document.body.classList.remove('tab-dragging');
                  }}
                >
                  <span>Split Bottom</span>
                </div>

              </div>

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
                    />
                  );
                }
                return null;
              })()}
            </div>

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

      {/* Cloudflare Tunnel Setup Modal */}
      <TunnelSetupModal
        show={showTunnelModal}
        onClose={() => setShowTunnelModal(false)}
        onSubmit={handleStartTokenTunnel}
        tunnelToken={tunnelToken}
        setTunnelToken={setTunnelToken}
      />

      {/* Settings Modal */}
      <SettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        token={localStorage.getItem('token') || ''}
        workspacesCount={workspaces.length}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <ShortcutHelpModal
        show={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
      />


      {/* App Footer */}
      <Footer
        panelWorkspace={panelWorkspace}
        tunnelStatus={tunnelStatus}
        terminalFontSize={terminalFontSize}
        defaultShell={defaultShell}
        setDefaultShell={setDefaultShell}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handleStartTunnel={handleStartTunnel}
        handleStopTunnel={handleStopTunnel}
        getWorkspaceActiveBranch={getWorkspaceActiveBranch}
      />
    </div>
  );
}
