import React, { useState, useEffect } from 'react';
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
  Menu as MenuIcon
} from 'lucide-react';
import { wsManager } from './services/websocket';
import { TerminalInstance } from './components/TerminalInstance';
import { SetupSecurityForm, LoginForm } from './components/AuthForms';
import { WorkspaceAddModal, WorktreeAddModal, TunnelSetupModal } from './components/Modals';

// Types
interface WorktreeInfo {
  path: string;
  commit: string;
  branch?: string;
  isMain: boolean;
  isDirty?: boolean;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  worktrees: WorktreeInfo[];
  defaultShell?: string;
}

interface TerminalTab {
  id: string;
  name: string;
  cwd: string;
  shellType: string;
}

interface TunnelStatus {
  active: boolean;
  url: string | null;
  type: 'quick' | 'token' | 'none';
  error: string | null;
}

export default function App() {
  // Auth states
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Connection states
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // App data states
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus>({
    active: false,
    url: null,
    type: 'none',
    error: null
  });

  // Modal states
  const [showWorkspaceModal, setShowWorkspaceModal] = useState<boolean>(false);
  const [newWorkspacePath, setNewWorkspacePath] = useState<string>('');
  const [newWorkspaceShell, setNewWorkspaceShell] = useState<string>('powershell');
  const [showFolderExplorer, setShowFolderExplorer] = useState<boolean>(false);
  const [explorerPath, setExplorerPath] = useState<string>('');
  const [explorerDirs, setExplorerDirs] = useState<{name: string, path: string}[]>([]);
  const [explorerParent, setExplorerParent] = useState<string | null>(null);
  
  const [showWorktreeModal, setShowWorktreeModal] = useState<boolean>(false);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string>('');
  const [newWorktreePath, setNewWorktreePath] = useState<string>('');
  const [newWorktreeBranch, setNewWorktreeBranch] = useState<string>('');
  const [isNewBranch, setIsNewBranch] = useState<boolean>(false);
  const [repoBranches, setRepoBranches] = useState<string[]>([]);
  const [gitLoading, setGitLoading] = useState<boolean>(false);

  const [showTunnelModal, setShowTunnelModal] = useState<boolean>(false);
  const [tunnelToken, setTunnelToken] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Terminal tab states
  const [terminals, setTerminals] = useState<TerminalTab[]>(() => {
    try {
      const saved = localStorage.getItem('tline-terminals');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem('tline-active-tab-id') || '';
  });
  const [defaultShell, setDefaultShell] = useState<string>('powershell');

  // Lifecycle
  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      wsManager.connect();
      wsManager.setOnConnectionChange(setWsConnected);
      fetchDashboardData();

      // Poll tunnel status every 5 seconds
      const interval = setInterval(fetchTunnelStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('tline-terminals', JSON.stringify(terminals));
  }, [terminals]);

  useEffect(() => {
    localStorage.setItem('tline-active-tab-id', activeTabId);
  }, [activeTabId]);

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

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setWorkspaces(data);
      }
    } catch (e) {
      console.error('Failed to fetch workspaces:', e);
    }
  };

  const fetchTunnelStatus = async () => {
    try {
      const res = await fetch('/api/tunnel/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setTunnelStatus(data);
    } catch (e) {
      console.error('Failed to fetch tunnel status:', e);
    }
  };

  // Directory Browser Loader (Web fallback)
  const fetchDirectoryList = async (targetPath = '') => {
    try {
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(targetPath)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        setExplorerPath(data.currentPath);
        setExplorerParent(data.parentPath);
        setExplorerDirs(data.directories);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error('Failed to list directories:', e);
    }
  };

  const handleFolderBrowse = async () => {
    if ((window as any).electron) {
      try {
        const selected = await (window as any).electron.selectDirectory();
        if (selected) {
          setNewWorkspacePath(selected);
        }
      } catch (e) {
        console.error('Electron folder selection failed, falling back to Web Explorer:', e);
        setShowFolderExplorer(true);
        fetchDirectoryList(newWorkspacePath || explorerPath);
      }
    } else {
      setShowFolderExplorer(true);
      fetchDirectoryList(newWorkspacePath || explorerPath);
    }
  };

  // Add Workspace Handler
  const handleAddWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspacePath) return;

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ path: newWorkspacePath, defaultShell: newWorkspaceShell })
      });
      const data = await res.json();
      if (data.success) {
        setShowWorkspaceModal(false);
        setNewWorkspacePath('');
        setNewWorkspaceShell('powershell');
        setShowFolderExplorer(false);
        fetchWorkspaces();
      } else {
        alert(data.error || 'Failed to add workspace.');
      }
    } catch (e) {
      alert('Error occurred adding workspace.');
    }
  };

  // Remove Workspace Handler
  const handleRemoveWorkspace = async (workspacePath: string) => {
    if (!confirm('Are you sure you want to remove this workspace from tracking? (Files will not be deleted)')) return;

    try {
      const res = await fetch('/api/workspaces', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ path: workspacePath })
      });
      const data = await res.json();
      if (data.success) {
        fetchWorkspaces();
      }
    } catch (e) {
      console.error('Error removing workspace:', e);
    }
  };

  // Open Add Worktree Modal
  const handleOpenWorktreeModal = async (workspace: WorkspaceInfo) => {
    setSelectedRepoPath(workspace.path);
    // Pre-populate target directory path: Workspace parent + name-worktree
    const parentDir = workspace.path.substring(0, workspace.path.lastIndexOf(window.navigator.userAgent.includes('Windows') ? '\\' : '/'));
    const worktreeBaseDir = `${parentDir}/${workspace.name}-worktrees`;
    setNewWorktreePath(`${worktreeBaseDir}/new-worktree`);
    setNewWorktreeBranch('');
    setIsNewBranch(false);
    setShowWorktreeModal(true);
    setSidebarOpen(false);
    setGitLoading(true);

    try {
      const id = workspace.id;
      const res = await fetch(`/api/workspaces/${id}/branches`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const branches = await res.json();
      setRepoBranches(branches);
    } catch (e) {
      console.error('Failed to get repo branches:', e);
    } finally {
      setGitLoading(false);
    }
  };

  // Add Git Worktree Handler
  const handleAddWorktree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorktreePath || !newWorktreeBranch) return;

    setGitLoading(true);
    try {
      const res = await fetch('/api/worktrees/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          repoPath: selectedRepoPath,
          worktreePath: newWorktreePath,
          branchName: newWorktreeBranch,
          newBranch: isNewBranch
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowWorktreeModal(false);
        fetchWorkspaces();
      } else {
        alert(data.output || 'Failed to create worktree.');
      }
    } catch (e) {
      alert('Error occurred adding worktree.');
    } finally {
      setGitLoading(false);
    }
  };

  // Remove Git Worktree Handler
  const handleRemoveWorktree = async (repoPath: string, worktreePath: string) => {
    if (!confirm(`Are you sure you want to remove the worktree at ${worktreePath}? This will delete the checked-out files but keep the branch.`)) return;

    setGitLoading(true);
    try {
      const res = await fetch('/api/worktrees/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ repoPath, worktreePath, force: true })
      });
      const data = await res.json();
      if (data.success) {
        fetchWorkspaces();
      } else {
        alert(data.output || 'Failed to remove worktree.');
      }
    } catch (e) {
      console.error('Error removing worktree:', e);
    } finally {
      setGitLoading(false);
    }
  };

  // Terminals management
  const openTerminal = (name: string, cwd: string, shellType?: string) => {
    const id = `term-${Date.now()}`;
    const activeShell = shellType || defaultShell;
    const newTab = { id, name, cwd, shellType: activeShell };
    setTerminals(prev => [...prev, newTab]);
    setActiveTabId(id);
    setSidebarOpen(false);
  };

  const closeTerminal = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    wsManager.unsubscribe(id);
    
    setTerminals(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (activeTabId === id && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  };

  // Cloudflare Tunnel Toggles
  const handleStartTunnel = async (type: 'quick' | 'token') => {
    if (type === 'token') {
      setShowTunnelModal(true);
      return;
    }
    
    try {
      const res = await fetch('/api/tunnel/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type: 'quick' })
      });
      const data = await res.json();
      if (data.success) {
        fetchTunnelStatus();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Failed to start quick tunnel.');
    }
  };

  const handleStartTokenTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tunnelToken) return;

    try {
      const res = await fetch('/api/tunnel/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type: 'token', token: tunnelToken })
      });
      const data = await res.json();
      if (data.success) {
        setShowTunnelModal(false);
        setTunnelToken('');
        fetchTunnelStatus();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Failed to start named tunnel.');
    }
  };

  const handleStopTunnel = async () => {
    try {
      const res = await fetch('/api/tunnel/stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchTunnelStatus();
      }
    } catch (e) {
      console.error('Failed to stop tunnel:', e);
    }
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
      
      {/* Custom Title Bar */}
      <div className="title-bar">
        <div className="title-bar-logo">
          <TerminalIcon size={14} style={{ color: 'var(--color-primary)' }} />
          <span>t-line Workspace Manager <span style={{ opacity: 0.5, fontSize: '0.75rem', fontWeight: 'normal', marginLeft: '6px' }}>v1.0.1</span></span>
        </div>
        {(window as any).electron && (
          <div className="title-bar-controls">
            <button type="button" className="title-bar-btn" onClick={() => (window as any).electron.minimize()} title="Minimize">—</button>
            <button type="button" className="title-bar-btn" onClick={() => (window as any).electron.maximize()} title="Maximize">▢</button>
            <button type="button" className="title-bar-btn title-bar-btn-close" onClick={() => (window as any).electron.close()} title="Close">✕</button>
          </div>
        )}
      </div>

      <div className="app-content-wrapper">
        
        {/* Sidebar Panel */}
        <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        
        <div className="sidebar-header">
          <div className="welcome-icon-box" style={{ width: '32px', height: '32px', borderRadius: '8px', margin: 0 }}>
            <TerminalIcon size={18} />
          </div>
          <span className="logo-text">t-line</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', marginLeft: '8px', alignSelf: 'center' }}>v1.0.1</span>
        </div>

        <div className="sidebar-content">
          
          <div>
            <div className="section-title">
              <span>Workspaces</span>
              <button className="action-btn" onClick={() => { setShowWorkspaceModal(true); setSidebarOpen(false); }} title="Add Workspace">
                <Plus size={16} />
              </button>
            </div>

            <div className="workspace-list flex flex-col gap-3">
              {workspaces.map(w => (
                <div key={w.id} className="group p-4 rounded-xl border border-white/5 bg-slate-900/10 backdrop-blur-md hover:border-purple-500/25 hover:bg-slate-900/40 transition-all duration-300 shadow-md hover:shadow-[0_8px_30px_rgba(0,0,0,0.45)] relative overflow-hidden flex flex-col gap-2">
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
          </div>

        {/* Cloudflare Tunnel Widget */}
        <div className="tunnel-widget glass-panel" style={{ borderRadius: '0', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
          <div className="section-title" style={{ marginBottom: '4px' }}>
            <span>Cloudflare Tunnel</span>
            <span className="status-indicator">
              <span className={`dot ${tunnelStatus.active ? 'dot-active' : 'dot-inactive'}`} />
              {tunnelStatus.active ? 'Active' : 'Inactive'}
            </span>
          </div>

          {tunnelStatus.active && tunnelStatus.url && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="tunnel-url">{tunnelStatus.url}</div>
              <a 
                href={tunnelStatus.url} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', justifyContent: 'center', gap: '6px' }}
              >
                <span>Visit URL</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {tunnelStatus.error && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
              Error: {tunnelStatus.error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            {tunnelStatus.active ? (
              <button className="btn btn-danger" style={{ flex: '1', fontSize: '0.75rem', padding: '8px' }} onClick={handleStopTunnel}>
                Stop Tunnel
              </button>
            ) : (
              <>
                <button className="btn btn-secondary" style={{ flex: '1', fontSize: '0.75rem', padding: '8px' }} onClick={() => handleStartTunnel('quick')}>
                  Quick URL
                </button>
                <button className="btn btn-secondary" style={{ flex: '1', fontSize: '0.75rem', padding: '8px' }} onClick={() => handleStartTunnel('token')}>
                  Custom
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div className="sidebar-overlay md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Panel */}
      <div className="main-panel">
        
        {/* Topbar */}
        <div className="top-bar flex items-center justify-between">
          <div className="top-bar-info flex items-center gap-3">
            <button 
              className="action-btn md:hidden" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle Sidebar"
            >
              <MenuIcon size={18} />
            </button>
            <span className="status-indicator" title={wsConnected ? 'WebSocket connection active' : 'WebSocket connecting...'}>
              <span className={`dot ${wsConnected ? 'dot-active' : 'dot-inactive'}`} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {wsConnected ? 'Backend Connected' : 'Connecting to Backend...'}
              </span>
            </span>
          </div>
          <button className="action-btn" onClick={handleLogout} title="Log out">
            <LogOut size={16} />
          </button>
        </div>

        {/* Dynamic Panels */}
        <div className="content-area">
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
                    <button className="btn btn-secondary border border-white/5 hover:border-white/10" onClick={() => openTerminal('Global Shell', '')}>
                      Open Terminal
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
          ) : (
            
            // Terminals Terminal View
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: '12px' }}>
              <div className="tab-bar">
                {terminals.map(t => (
                  <div 
                    key={t.id} 
                    className={`tab ${activeTabId === t.id ? 'tab-active' : ''}`}
                    onClick={() => setActiveTabId(t.id)}
                  >
                    <TerminalIcon size={14} style={{ color: activeTabId === t.id ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                    <span>{t.name}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>({t.shellType === 'powershell' ? 'ps' : t.shellType})</span>
                    <span className="tab-close" onClick={(e) => closeTerminal(t.id, e)}>×</span>
                  </div>
                ))}
                <button className="action-btn" style={{ marginLeft: '4px' }} onClick={() => openTerminal('Shell', '')} title="New terminal">
                  <Plus size={16} />
                </button>

                {/* Shell Type Selector dropdown */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shell:</span>
                  <select 
                    value={defaultShell} 
                    onChange={(e) => setDefaultShell(e.target.value)}
                    className="form-input" 
                    style={{ 
                      width: '110px', 
                      padding: '2px 6px', 
                      fontSize: '0.75rem', 
                      height: '24px', 
                      background: 'rgba(255,255,255,0.04)', 
                      borderRadius: '4px', 
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                    title="Default Shell for new tabs"
                  >
                    <option value="powershell">PowerShell</option>
                    <option value="cmd">CMD</option>
                    <option value="gitbash">Git Bash</option>
                    <option value="wsl">WSL (Linux)</option>
                  </select>
                </div>
              </div>

              <div className="terminal-container">
                {terminals.map(t => (
                  <div 
                    key={t.id} 
                    style={{ display: activeTabId === t.id ? 'block' : 'none', width: '100%', height: '100%' }}
                  >
                    <TerminalInstance tab={t} active={activeTabId === t.id} wsConnected={wsConnected} />
                  </div>
                ))}
              </div>
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
    </div>
  );
}


