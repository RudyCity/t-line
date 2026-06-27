import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Folder, 
  GitBranch, 
  GitFork, 
  Plus, 
  Trash2, 
  Terminal as TerminalIcon, 
  LogOut, 
  Loader2, 
  FolderPlus, 
  ExternalLink,
  Menu as MenuIcon,
  GitCompare,
  FolderTree,
  Settings,
  FileCode,
  ZoomIn,
  ZoomOut,
  Keyboard
} from 'lucide-react';
import { wsManager } from './services/websocket';
import { TerminalInstance } from './components/TerminalInstance';
import { FileViewerTab } from './components/FileViewerTab';
import { SetupSecurityForm, LoginForm } from './components/AuthForms';
import { WorkspaceAddModal, WorktreeAddModal, TunnelSetupModal, SettingsModal, ShortcutHelpModal } from './components/Modals';
import { FileExplorer, GitChanges } from './components/FilePanel';
import { useTunnel } from './hooks/useTunnel';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useTerminals, WorkspaceInfo } from './hooks/useTerminals';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSplitPane } from './hooks/useSplitPane';




export default function App() {
  // Auth states
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Connection states
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Resizing and Sidebar States
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
    terminals,
    setTerminals,
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
    handleTitleChange
  } = useTerminals(workspaces, () => setSidebarOpen(false));

  // Split Pane Hook
  const {
    splitState,
    splitHorizontal,
    splitVertical,
    closeSplit,
    startResizeSplit
  } = useSplitPane();

  // Helper: get a secondary tab for split (the tab after active, or the first different one)
  const getSecondaryTabId = useCallback(() => {
    const termTabs = terminals.filter(t => t.type === 'terminal');
    if (termTabs.length < 2) return '';
    const currentIdx = termTabs.findIndex(t => t.id === activeTabId);
    if (currentIdx === -1) return termTabs[0].id;
    return termTabs[(currentIdx + 1) % termTabs.length].id;
  }, [terminals, activeTabId]);

  // Keyboard Shortcuts
  const hasModals = showWorkspaceModal || showWorktreeModal || showTunnelModal || showSettingsModal;
  useKeyboardShortcuts({
    enabled: isAuthenticated && !hasModals,
    onNewTerminal: () => openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || ''),
    onCloseTab: () => {
      if (activeTabId) closeTerminal(activeTabId);
    },
    onNextTab: () => {
      const idx = terminals.findIndex(t => t.id === activeTabId);
      if (idx !== -1 && terminals.length > 1) {
        setActiveTabId(terminals[(idx + 1) % terminals.length].id);
      }
    },
    onPrevTab: () => {
      const idx = terminals.findIndex(t => t.id === activeTabId);
      if (idx !== -1 && terminals.length > 1) {
        setActiveTabId(terminals[(idx - 1 + terminals.length) % terminals.length].id);
      }
    },
    onJumpToTab: (index) => {
      if (terminals[index]) setActiveTabId(terminals[index].id);
    },
    onSplitHorizontal: () => {
      const secId = getSecondaryTabId();
      if (secId) splitHorizontal(secId);
      else openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '');
    },
    onSplitVertical: () => {
      const secId = getSecondaryTabId();
      if (secId) splitVertical(secId);
      else openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '');
    },
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
  });

  // Auto-close split if the secondary tab is closed
  useEffect(() => {
    if (splitState.isSplit && splitState.secondaryTabId) {
      const exists = terminals.some(t => t.id === splitState.secondaryTabId);
      if (!exists) {
        closeSplit();
      }
    }
  }, [terminals, splitState.isSplit, splitState.secondaryTabId, closeSplit]);

  // Swap tabs if activeTabId becomes the secondary split tab to prevent duplicate rendering
  useEffect(() => {
    if (splitState.isSplit && activeTabId === splitState.secondaryTabId) {
      const otherTab = terminals.find(t => t.id !== activeTabId);
      if (otherTab) {
        if (splitState.direction === 'horizontal') {
          splitHorizontal(otherTab.id);
        } else {
          splitVertical(otherTab.id);
        }
      }
    }
  }, [activeTabId, splitState.isSplit, splitState.secondaryTabId, splitState.direction, terminals, splitHorizontal, splitVertical]);


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



  // Auto-select workspace logic when workspaces or activePanel changes
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

    // Multiple workspaces case
    if (activePanel === 'explorer') {
      if (!panelWorkspace || !workspaces.some(w => w.id === panelWorkspace.id)) {
        setPanelWorkspace(workspaces[0]);
      }
    } else if (activePanel === 'changes') {
      // For changes tab, prefer git-enabled workspace
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
      // Check query params first for token (Electron Integration)
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
    localStorage.removeItem('tline-terminals');
    localStorage.removeItem('tline-active-tab-id');
    setTerminals([]);
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

            <div className="workspace-list flex flex-col gap-2.5 px-3">
              {workspaces.map(w => (
                <div key={w.id} className="group p-3 rounded-lg border border-white/5 bg-slate-900/10 backdrop-blur-md hover:bg-slate-900/40 hover:border-purple-500/20 transition-all duration-300 relative overflow-hidden flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium truncate">
                      <Folder size={16} className="text-sky-400 shrink-0" />
                      <span className="text-sm font-semibold tracking-wide text-slate-100 truncate" title={w.path}>{w.name}</span>
                    </div>
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                      {w.isGit && (
                        <button className="action-btn" onClick={() => handleOpenWorktreeModal(w)} title="New Worktree branch">
                          <GitFork size={13} />
                        </button>
                      )}
                      {w.isGit && (
                        <button className="action-btn" onClick={() => { setPanelWorkspace(w); setActivePanel('changes'); }} title="Git Changes">
                          <GitCompare size={13} />
                        </button>
                      )}
                      <button className="action-btn" onClick={() => { setPanelWorkspace(w); setActivePanel('explorer'); }} title="Browse Files">
                        <FolderTree size={13} />
                      </button>
                      <button className="action-btn" onClick={() => openTerminal(w.name, w.path, w.defaultShell)} title={`Open terminal (${w.defaultShell || 'default'})`}>
                        <TerminalIcon size={13} />
                      </button>
                      <button className="action-btn action-btn-danger" onClick={() => handleRemoveWorkspace(w.path)} title="Remove workspace">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{w.path}</div>

                  {w.isGit && w.worktrees.length > 0 && (
                    <div className="mt-2 pl-2 border-l border-dashed border-white/10 flex flex-col gap-1.5">
                      {w.worktrees.map(wt => (
                        <div key={wt.path} className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 transition-all text-xs cursor-pointer group/item">
                          <div className="flex items-center gap-2 truncate" title={wt.path}>
                            <GitBranch size={12} className={wt.isMain ? 'text-purple-400' : 'text-emerald-400'} />
                            <span className={`truncate ${wt.isDirty ? 'text-amber-400 font-medium' : (wt.isMain ? 'text-slate-200' : 'text-slate-400')}`}>
                              {wt.branch || 'detached'}
                            </span>
                            {wt.isDirty && (
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_#f59e0b]" title="Uncommitted changes" />
                            )}
                            <span className={`badge ${wt.isMain ? 'badge-main' : 'badge-worktree'}`}>
                              {wt.isMain ? 'main' : 'wt'}
                            </span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 shrink-0">
                             <button className="action-btn" onClick={() => openTerminal(`${w.name} (${wt.branch || 'detached'})`, wt.path, w.defaultShell)} title={`Open terminal here (${w.defaultShell || 'default'})`}>
                              <TerminalIcon size={11} />
                            </button>
                            {!wt.isMain && (
                              <button className="action-btn action-btn-danger" onClick={() => handleRemoveWorktree(w.path, wt.path)} title="Delete worktree">
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

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
          {terminals.length > 0 && (
            <div className="window-controls-separator shrink-0" style={{ margin: '0 12px', height: '16px' }} />
          )}

          {/* Integrated Tab Bar */}
          {terminals.length > 0 && (
            <div className="flex items-center gap-2 flex-1 overflow-x-auto mx-3 h-full" style={{ scrollbarWidth: 'none', WebkitAppRegion: 'no-drag' } as any}>
              {terminals.map(t => {
                const isFile = t.type === 'file';
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
                    {!isFile && (
                      <span style={{ fontSize: '0.65rem', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>({t.shellType === 'powershell' ? 'ps' : t.shellType})</span>
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
          {terminals.length > 0 && (
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
        <div className="content-area" style={{ padding: terminals.length === 0 ? '16px' : '0', gap: '0' }}>
          {terminals.length === 0 ? (
            
            // Empty Dashboard Welcome View
            <div className="flex items-center justify-center flex-1 p-8">
              <div className="relative p-[1.5px] rounded-2xl bg-gradient-to-r from-purple-500/30 via-violet-600/30 to-cyan-500/30 shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden max-w-xl w-full">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 blur-2xl opacity-40 pointer-events-none" />
                <div className="relative bg-[#07090f]/95 rounded-[14px] p-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6 shadow-[0_0_15px_rgba(168,85,247,0.15)] animate-pulse">
                    <FolderPlus size={32} />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight mb-3 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                    Manage Workspaces & Git Worktrees
                  </h2>
                  <p className="text-sm text-slate-400 max-w-sm mb-8 leading-relaxed">
                    Register workspaces, view git branch/worktree checkouts, and launch terminal instances inside specific project directories.
                  </p>
                  <div className="flex gap-4">
                    <button className="btn btn-primary shadow-lg shadow-purple-500/10 hover:shadow-[0_0_15px_rgba(168,85,247,0.45)] transition-all duration-300" onClick={() => setShowWorkspaceModal(true)}>
                      Add Workspace Folder
                    </button>
                    <button className="btn btn-secondary border border-white/5 hover:border-white/10" onClick={() => openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '')}>
                      Open Terminal
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
          ) : (
            
            // Terminals View — supports split pane and drag-and-drop splitting
            <div className="terminal-container" style={{ flex: 1, border: 'none', borderRadius: 0, padding: 0, display: 'flex', flexDirection: splitState.direction === 'vertical' ? 'column' : 'row', position: 'relative' }}>
              {/* Drop Zones Overlay for Drag and Drop Splitting */}
              <div className="drag-drop-overlay">
                {/* Left Zone */}
                <div
                  className="drag-drop-zone"
                  style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '25%',
                    borderRight: '2px dashed rgba(168,85,247,0.4)',
                    background: 'rgba(168,85,247,0.03)'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain') || draggedTabIdRef.current;
                    if (draggedId) {
                      if (draggedId === activeTabId) {
                        const nextActive = getSecondaryTabId();
                        if (nextActive) {
                          setActiveTabId(nextActive);
                          splitHorizontal(draggedId);
                        }
                      } else {
                        splitHorizontal(draggedId);
                      }
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
                    borderLeft: '2px dashed rgba(168,85,247,0.4)',
                    background: 'rgba(168,85,247,0.03)'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain') || draggedTabIdRef.current;
                    if (draggedId) {
                      if (draggedId === activeTabId) {
                        const nextActive = getSecondaryTabId();
                        if (nextActive) {
                          setActiveTabId(nextActive);
                          splitHorizontal(draggedId);
                        }
                      } else {
                        splitHorizontal(draggedId);
                      }
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
                    borderBottom: '2px dashed rgba(168,85,247,0.4)',
                    background: 'rgba(168,85,247,0.03)'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain') || draggedTabIdRef.current;
                    if (draggedId) {
                      if (draggedId === activeTabId) {
                        const nextActive = getSecondaryTabId();
                        if (nextActive) {
                          setActiveTabId(nextActive);
                          splitVertical(draggedId);
                        }
                      } else {
                        splitVertical(draggedId);
                      }
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
                    borderTop: '2px dashed rgba(168,85,247,0.4)',
                    background: 'rgba(168,85,247,0.03)'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain') || draggedTabIdRef.current;
                    if (draggedId) {
                      if (draggedId === activeTabId) {
                        const nextActive = getSecondaryTabId();
                        if (nextActive) {
                          setActiveTabId(nextActive);
                          splitVertical(draggedId);
                        }
                      } else {
                        splitVertical(draggedId);
                      }
                    }
                    document.body.classList.remove('tab-dragging');
                  }}
                >
                  <span>Split Bottom</span>
                </div>

              </div>

              {/* Primary Pane */}
              <div style={{ flex: splitState.isSplit ? `0 0 ${splitState.splitRatio}%` : '1', position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                {terminals.map(t => (
                  <div
                    key={t.id}
                    style={{ display: activeTabId === t.id ? 'block' : 'none', width: '100%', height: '100%' }}
                  >
                    {t.type === 'file' ? (
                      <FileViewerTab filePath={t.filePath || ''} token={localStorage.getItem('token') || ''} />
                    ) : (
                      <TerminalInstance
                        tab={t as any}
                        active={activeTabId === t.id && (!splitState.isSplit || t.id !== splitState.secondaryTabId)}
                        wsConnected={wsConnected}
                        fontSize={terminalFontSize}
                        onTitleChange={(title) => handleTitleChange(t.id, title)}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Split Resizer + Secondary Pane */}
              {splitState.isSplit && (() => {
                const secondaryTab = terminals.find(t => t.id === splitState.secondaryTabId);
                if (!secondaryTab) return null;
                return (
                  <>
                    {/* Resize handle */}
                    <div
                      onMouseDown={startResizeSplit}
                      style={{
                        flexShrink: 0,
                        width: splitState.direction === 'horizontal' ? '4px' : '100%',
                        height: splitState.direction === 'vertical' ? '4px' : '100%',
                        background: 'rgba(168,85,247,0.15)',
                        cursor: splitState.direction === 'horizontal' ? 'col-resize' : 'row-resize',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.4)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.15)')}
                    />
                    {/* Secondary pane */}
                    <div style={{ flex: `0 0 ${100 - splitState.splitRatio}%`, position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                      {secondaryTab.type === 'file' ? (
                        <FileViewerTab filePath={secondaryTab.filePath || ''} token={localStorage.getItem('token') || ''} />
                      ) : (
                        <TerminalInstance
                          tab={secondaryTab as any}
                          active={true}
                          wsConnected={wsConnected}
                          fontSize={terminalFontSize}
                          onTitleChange={(title) => handleTitleChange(secondaryTab.id, title)}
                        />
                      )}
                    </div>
                  </>
                );
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
      <footer className="app-footer flex items-center justify-between px-[20px] py-2 border-t border-white/5 bg-slate-950/85 text-xs text-slate-400 select-none shrink-0 h-9 z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_6px_#a855f7]" />
            <span>t-line v1.1.3</span>
          </span>

          {panelWorkspace && (
            <span className="text-[11px] font-mono text-slate-500 hidden sm:flex items-center gap-2">
              <span>Workspace: {panelWorkspace.name}</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400 font-sans text-xs truncate max-w-[200px]" title={panelWorkspace.path}>
                {panelWorkspace.path}
              </span>
              {(() => {
                const activeBranch = getWorkspaceActiveBranch(panelWorkspace);
                if (!activeBranch) return null;
                return (
                  <>
                    <span className="text-slate-700">|</span>
                    <span className="flex items-center gap-1 text-[11px] text-purple-400 font-sans" title={activeBranch.isDirty ? "Uncommitted changes" : "Git Branch"}>
                      <GitBranch size={11} className={activeBranch.isMain ? 'text-purple-400' : 'text-emerald-400'} />
                      <span className={activeBranch.isDirty ? 'text-amber-400 font-medium' : ''}>
                        {activeBranch.name}
                      </span>
                      {activeBranch.isDirty && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_#f59e0b]" />
                      )}
                    </span>
                  </>
                );
              })()}
            </span>
          )}
        </div>

        {/* Zoom & Shell Controls (Dashboard Pill) */}
        <div className="flex items-center gap-3 bg-white/5 px-2.5 py-1 rounded border border-white/5">
          {/* Zoom controls */}
          <div className="flex items-center gap-1.5">
            <button 
              className="action-btn text-slate-400 hover:text-white" 
              onClick={handleZoomOut} 
              title="Zoom Out Terminal font"
              style={{ padding: '1px', display: 'flex', alignItems: 'center' }}
            >
              <ZoomOut size={11} />
            </button>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {terminalFontSize}px
            </span>
            <button 
              className="action-btn text-slate-400 hover:text-white" 
              onClick={handleZoomIn} 
              title="Zoom In Terminal font"
              style={{ padding: '1px', display: 'flex', alignItems: 'center' }}
            >
              <ZoomIn size={11} />
            </button>
          </div>

          <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.08)' }} />

          {/* Shell Selector */}
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Shell:</span>
            <select 
              value={defaultShell} 
              onChange={(e) => setDefaultShell(e.target.value)}
              style={{ 
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.65rem', 
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0',
                outline: 'none'
              }}
              title="Default Shell for new tabs"
            >
              <option value="powershell" style={{ background: '#0e111a', color: 'var(--text-main)' }}>powershell</option>
              <option value="cmd" style={{ background: '#0e111a', color: 'var(--text-main)' }}>cmd</option>
              <option value="gitbash" style={{ background: '#0e111a', color: 'var(--text-main)' }}>gitbash</option>
              <option value="wsl" style={{ background: '#0e111a', color: 'var(--text-main)' }}>wsl</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Cloudflare Tunnel:</span>
            <span className="flex items-center gap-1.5 font-medium px-2 py-0.5 rounded bg-white/5 text-[11px]">
              <span className={`h-1.5 w-1.5 rounded-full ${tunnelStatus.active ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]' : 'bg-red-400 shadow-[0_0_6px_#f87171]'}`} />
              <span className={tunnelStatus.active ? 'text-emerald-400' : 'text-red-400'}>
                {tunnelStatus.active ? 'Active' : 'Inactive'}
              </span>
            </span>
          </div>

          {tunnelStatus.active && tunnelStatus.url && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-sky-400 max-w-[200px] truncate" title={tunnelStatus.url}>
                {tunnelStatus.url}
              </span>
              <a 
                href={tunnelStatus.url} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded transition-all duration-150"
              >
                <span>Open</span>
                <ExternalLink size={10} />
              </a>
            </div>
          )}

          <div className="flex items-center gap-1">
            {tunnelStatus.active ? (
              <button 
                onClick={handleStopTunnel}
                className="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[10px] font-medium transition-all cursor-pointer"
              >
                Stop
              </button>
            ) : (
              <>
                <button 
                  onClick={() => handleStartTunnel('quick')}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-medium transition-all cursor-pointer"
                >
                  Quick URL
                </button>
                <button 
                  onClick={() => handleStartTunnel('token')}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-medium transition-all cursor-pointer"
                >
                  Custom
                </button>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}


