import React from 'react';
import { Folder, Loader2, Info, Shield, Eye, EyeOff } from 'lucide-react';
import { FormField, Input, Select, TextArea, Button } from './Form';

interface WorkspaceAddModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newWorkspacePath: string;
  setNewWorkspacePath: (val: string) => void;
  newWorkspaceShell: string;
  setNewWorkspaceShell: (val: string) => void;
  handleFolderBrowse: () => void;
  showFolderExplorer: boolean;
  setShowFolderExplorer: (val: boolean) => void;
  explorerPath: string;
  explorerParent: string | null;
  explorerDirs: { name: string; path: string }[];
  fetchDirectoryList: (path: string) => void;
}

export const WorkspaceAddModal: React.FC<WorkspaceAddModalProps> = ({
  show,
  onClose,
  onSubmit,
  newWorkspacePath,
  setNewWorkspacePath,
  newWorkspaceShell,
  setNewWorkspaceShell,
  handleFolderBrowse,
  showFolderExplorer,
  setShowFolderExplorer,
  explorerPath,
  explorerParent,
  explorerDirs,
  fetchDirectoryList
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <form onSubmit={onSubmit} className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Track New Workspace</h3>
          <button 
            type="button" 
            className="action-btn" 
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <FormField label="Workspace Directory Path">
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input 
              type="text" 
              placeholder="e.g. D:\projects\my-repo" 
              value={newWorkspacePath}
              onChange={(e) => setNewWorkspacePath(e.target.value)}
              required
              autoFocus
            />
            <Button 
              type="button" 
              variant="secondary"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }} 
              onClick={handleFolderBrowse}
            >
              Browse
            </Button>
          </div>
        </FormField>

        {/* Web-based directory browser container */}
        {showFolderExplorer && (
          <div className="form-group">
            <div className="folder-explorer">
              <div className="folder-explorer-header">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                  Path: {explorerPath || 'Drives'}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {explorerParent && (
                    <button 
                      type="button" 
                      className="action-btn" 
                      onClick={() => fetchDirectoryList(explorerParent)}
                      style={{ fontSize: '0.7rem', padding: '2px 4px' }}
                    >
                      Up
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="action-btn" 
                    onClick={() => {
                      setNewWorkspacePath(explorerPath);
                      setShowFolderExplorer(false);
                    }}
                    style={{ color: 'var(--color-success)', fontSize: '0.7rem', padding: '2px 4px' }}
                  >
                    Select
                  </button>
                  <button 
                    type="button" 
                    className="action-btn action-btn-danger" 
                    onClick={() => setShowFolderExplorer(false)}
                    style={{ fontSize: '0.7rem', padding: '2px 4px' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {explorerDirs.map(d => (
                  <button
                    key={d.path}
                    type="button"
                    className="folder-explorer-item"
                    onClick={() => fetchDirectoryList(d.path)}
                  >
                    <Folder size={14} style={{ color: 'var(--color-info)', marginRight: '6px' }} />
                    <span>{d.name}</span>
                  </button>
                ))}
                {explorerDirs.length === 0 && (
                  <div style={{ fontSize: '0.75rem', padding: '12px', color: 'var(--text-dark)', textAlign: 'center' }}>
                    (Empty or Access Denied)
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <FormField label="Default Shell for Workspace">
          <Select 
            value={newWorkspaceShell} 
            onChange={(e) => setNewWorkspaceShell(e.target.value)}
            options={[
              { value: 'powershell', label: 'PowerShell' },
              { value: 'cmd', label: 'Command Prompt (CMD)' },
              { value: 'gitbash', label: 'Git Bash' },
              { value: 'wsl', label: 'WSL (Linux)' }
            ]}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button 
            type="button" 
            variant="secondary" 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit">Track Workspace</Button>
        </div>
      </form>
    </div>
  );
};

interface WorktreeAddModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newWorktreePath: string;
  setNewWorktreePath: (val: string) => void;
  isNewBranch: boolean;
  setIsNewBranch: (val: boolean) => void;
  newWorktreeBranch: string;
  setNewWorktreeBranch: (val: string) => void;
  repoBranches: string[];
  gitLoading: boolean;
}

export const WorktreeAddModal: React.FC<WorktreeAddModalProps> = ({
  show,
  onClose,
  onSubmit,
  newWorktreePath,
  setNewWorktreePath,
  isNewBranch,
  setIsNewBranch,
  newWorktreeBranch,
  setNewWorktreeBranch,
  repoBranches,
  gitLoading
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <form onSubmit={onSubmit} className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Create Git Worktree</h3>
          <button type="button" className="action-btn" onClick={onClose} disabled={gitLoading}>×</button>
        </div>
        
        <FormField label="Target Checkout Directory Path">
          <Input 
            type="text" 
            placeholder="e.g. D:\projects\my-repo-worktrees\feature-branch" 
            value={newWorktreePath}
            onChange={(e) => setNewWorktreePath(e.target.value)}
            required
            disabled={gitLoading}
          />
        </FormField>

        <div className="form-group" style={{ display: 'flex', gap: '16px', alignItems: 'center', margin: '12px 0' }}>
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={isNewBranch} 
              onChange={(e) => {
                setIsNewBranch(e.target.checked);
                setNewWorktreeBranch('');
              }}
              disabled={gitLoading}
            />
            <span>Create a new branch instead of tracking existing branch</span>
          </label>
        </div>

        <FormField label={isNewBranch ? 'New Branch Name' : 'Existing Git Branch'}>
          {isNewBranch ? (
            <Input 
              type="text" 
              placeholder="e.g. feature-login" 
              value={newWorktreeBranch}
              onChange={(e) => setNewWorktreeBranch(e.target.value)}
              required
              disabled={gitLoading}
            />
          ) : (
            <Select 
              value={newWorktreeBranch}
              onChange={(e) => setNewWorktreeBranch(e.target.value)}
              required
              disabled={gitLoading}
              options={[
                { value: '', label: 'Select an existing branch', disabled: true },
                ...repoBranches.map(b => ({ value: b, label: b }))
              ]}
            />
          )}
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={gitLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={gitLoading} loading={gitLoading}>
            {gitLoading ? <Loader2 className="animate-spin" size={16} /> : 'Create Worktree'}
          </Button>
        </div>
      </form>
    </div>
  );
};

interface TunnelSetupModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  tunnelToken: string;
  setTunnelToken: (val: string) => void;
  loading?: boolean;
}

export const TunnelSetupModal: React.FC<TunnelSetupModalProps> = ({
  show,
  onClose,
  onSubmit,
  tunnelToken,
  setTunnelToken,
  loading = false
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <form onSubmit={onSubmit} className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Cloudflare Named Tunnel</h3>
          <button type="button" className="action-btn" onClick={onClose} disabled={loading}>×</button>
        </div>
        
        <FormField label="Cloudflare Tunnel Token">
          <TextArea 
            rows={4}
            placeholder="Paste your cloudflared tunnel token here (from your Cloudflare Zero Trust console)" 
            value={tunnelToken}
            onChange={(e) => setTunnelToken(e.target.value)}
            required
            disabled={loading}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'none' }}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" disabled={loading || !tunnelToken}>
            {loading ? (
              <span className="flex items-center gap-1.5 justify-center">
                <Loader2 size={12} className="animate-spin" />
                Starting...
              </span>
            ) : 'Start Named Tunnel'}
          </Button>
        </div>
      </form>
    </div>
  );
};

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  token: string;
  workspacesCount: number;
  showAlert: (title: string, message: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  show,
  onClose,
  token,
  workspacesCount,
  showAlert
}) => {
  const [activeTab, setActiveTab] = React.useState<'general' | 'security' | 'connections'>('general');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Access Control State
  const [connections, setConnections] = React.useState<any[]>([]);
  const [ipRules, setIpRules] = React.useState<Record<string, string>>({});

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/security/connections', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.accesses || []);
        setIpRules(data.rules || {});
      }
    } catch (e) {
      console.error('Failed to fetch connections:', e);
    }
  };

  React.useEffect(() => {
    if (show) {
      fetchConnections();
      
      // Auto-refresh logs every 10 seconds if Access Control tab is open
      if (activeTab === 'connections') {
        const interval = setInterval(fetchConnections, 10000);
        return () => clearInterval(interval);
      }
    }
  }, [show, activeTab]);

  const handleToggleRule = async (ip: string, currentRule: string | undefined) => {
    const newRule = currentRule === 'block' ? 'allow' : 'block';
    try {
      const res = await fetch('/api/security/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ip, rule: newRule })
      });
      if (res.ok) {
        const data = await res.json();
        setIpRules(data.rules || {});
        fetchConnections();
      } else {
        const errData = await res.json();
        showAlert('Security Rule Error', errData.error || 'Failed to update rule');
      }
    } catch (e) {
      showAlert('Security Rule Error', 'Error updating security rule.');
    }
  };

  if (!show) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Password updated successfully.');
        localStorage.setItem('token', data.token);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to update password.');
      }
    } catch (err) {
      setError('An error occurred during password change.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '480px', padding: 0, overflow: 'hidden' }}>
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="modal-title">Settings</h3>
          <button type="button" className="action-btn" onClick={onClose}>×</button>
        </div>

        {/* Tabs navigation */}
        <div className="sidebar-panel-tabs" style={{ background: 'rgba(0,0,0,0.15)' }}>
          <button
            type="button"
            className={`sidebar-panel-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
            style={{ padding: '12px' }}
          >
            <Info size={14} />
            <span>General</span>
          </button>
          <button
            type="button"
            className={`sidebar-panel-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
            style={{ padding: '12px' }}
          >
            <Shield size={14} />
            <span>Security</span>
          </button>
          <button
            type="button"
            className={`sidebar-panel-tab ${activeTab === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveTab('connections')}
            style={{ padding: '12px' }}
          >
            <Shield size={14} />
            <span>Access Control</span>
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'general' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Application Version</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>v1.0.3</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Workspaces</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{workspacesCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Backend Connection</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 'bold' }}>Active</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Client OS Platform</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                    {window.navigator.userAgent.includes('Windows') ? 'Windows' : 'Unix-like'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <Button type="button" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordChange}>
              {error && (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginBottom: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ color: 'var(--color-success)', fontSize: '0.8rem', marginBottom: '12px', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  {success}
                </div>
              )}

              <FormField label="Current Master Password">
                <div className="relative flex items-center">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <FormField label="New Master Password">
                <div className="relative flex items-center">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Min 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <FormField label="Confirm New Master Password">
                <div className="relative flex items-center">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Retype new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" loading={loading} disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          )}

          {activeTab === 'connections' && (
            <div>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.1)', padding: '10px', borderRadius: '8px' }}>
                <Shield size={16} className="text-purple-400 shrink-0" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Manage client devices accessing your server. You can block individual IPs to prevent unauthorized web or terminal connection requests.
                </span>
              </div>

              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                Active & Recent Devices
              </h4>
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', background: 'rgba(0,0,0,0.1)' }}>
                {connections.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', padding: '16px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    No connection history logged.
                  </div>
                ) : (
                  connections.map(conn => {
                    const isBlocked = ipRules[conn.ip] === 'block';
                    const relativeTime = Math.max(0, Math.round((Date.now() - conn.lastActive) / 1000));
                    let timeStr = 'Just now';
                    if (relativeTime >= 60) {
                      const mins = Math.floor(relativeTime / 60);
                      timeStr = `${mins}m ago`;
                    } else if (relativeTime > 5) {
                      timeStr = `${relativeTime}s ago`;
                    }
                    
                    return (
                      <div key={conn.ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1, paddingRight: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{conn.deviceType}</span>
                            <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                              {conn.path.split('/')[2] || 'api'}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }} className="truncate">
                            {conn.ip}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                            Last Active: {timeStr}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleRule(conn.ip, ipRules[conn.ip])}
                          className={`btn ${isBlocked ? 'btn-secondary' : 'btn-danger'}`}
                          style={{ padding: '3px 8px', fontSize: '0.65rem', height: '22px', cursor: 'pointer', flexShrink: 0, borderRadius: '4px' }}
                        >
                          {isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {Object.keys(ipRules).length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'rgb(248, 113, 113)' }}>
                    Blocked IPs ({Object.keys(ipRules).length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                    {Object.keys(ipRules).map(ip => (
                      <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', fontSize: '0.75rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'rgb(248, 113, 113)' }}>{ip}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleRule(ip, 'block')}
                          className="btn btn-secondary"
                          style={{ padding: '3px 6px', fontSize: '0.65rem', height: '20px', cursor: 'pointer', borderRadius: '4px' }}
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <Button type="button" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Keyboard Shortcut Help Modal
// ─────────────────────────────────────────────────────────────────

interface ShortcutGroup {
  title: string;
  icon: string;
  shortcuts: { keys: string[]; label: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Terminal',
    icon: '⌨️',
    shortcuts: [
      { keys: ['Alt', 'T'], label: 'Buka terminal baru' },
      { keys: ['Alt', 'W'], label: 'Tutup tab aktif' },
      { keys: ['Alt', ']'], label: 'Tab berikutnya' },
      { keys: ['Alt', '['], label: 'Tab sebelumnya' },
      { keys: ['Alt', '1–9'], label: 'Loncat ke tab ke-N' },
    ],
  },
  {
    title: 'Split Pane',
    icon: '⬛',
    shortcuts: [
      { keys: ['Alt', 'D'], label: 'Split horizontal (side-by-side)' },
      { keys: ['Alt', 'E'], label: 'Split vertikal (atas-bawah)' },
      { keys: ['Alt', 'D'], label: 'Tutup split (klik ulang)' },
    ],
  },
  {
    title: 'Tampilan',
    icon: '🔍',
    shortcuts: [
      { keys: ['Alt', '='], label: 'Zoom in font terminal' },
      { keys: ['Alt', '-'], label: 'Zoom out font terminal' },
      { keys: ['Ctrl', 'Shift', 'F'], label: 'Cari teks di terminal' },
    ],
  },
  {
    title: 'Search Bar',
    icon: '🔎',
    shortcuts: [
      { keys: ['Enter'], label: 'Cari berikutnya' },
      { keys: ['Shift', 'Enter'], label: 'Cari sebelumnya' },
      { keys: ['Esc'], label: 'Tutup search bar' },
    ],
  },
];

interface ShortcutHelpModalProps {
  show: boolean;
  onClose: () => void;
}

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-panel"
        style={{ maxWidth: '560px', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
            }}>⌨️</div>
            <div>
              <h3 className="modal-title" style={{ margin: 0 }}>Keyboard Shortcuts</h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                Semua shortcut t-line — kompatibel di browser &amp; Electron
              </p>
            </div>
          </div>
          <button type="button" className="action-btn" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '10px', paddingBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)'
              }}>
                <span style={{ fontSize: '13px' }}>{group.icon}</span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'rgba(168,85,247,0.9)'
                }}>{group.title}</span>
              </div>

              {/* Shortcut rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {group.shortcuts.map((sc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    {/* Label */}
                    <span style={{ fontSize: '13px', color: 'var(--text-main)', flex: 1 }}>{sc.label}</span>
                    {/* Key badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {sc.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          <kbd style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: '28px', padding: '2px 7px',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderBottom: '2px solid rgba(255,255,255,0.18)',
                            borderRadius: '5px',
                            fontFamily: 'var(--font-mono)', fontSize: '11px',
                            fontWeight: 600, color: '#e2e8f0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            lineHeight: 1.4,
                            whiteSpace: 'nowrap'
                          }}>
                            {k}
                          </kbd>
                          {ki < sc.keys.length - 1 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', userSelect: 'none' }}>+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer tip */}
          <div style={{
            marginTop: '4px', padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.15)',
            fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6
          }}>
            💡 <strong style={{ color: 'var(--text-main)' }}>Tip:</strong> Shortcut menggunakan <kbd style={{ padding: '1px 5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '10px' }}>Alt</kbd> agar tidak konflik dengan shortcut browser Chrome/Firefox.
          </div>
        </div>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  show: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  isAlert?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  show,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isAlert = false,
  onConfirm,
  onCancel
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button 
            type="button" 
            className="action-btn" 
            onClick={onCancel || onConfirm}
          >
            ×
          </button>
        </div>
        <div style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {!isAlert && onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button 
            type="button" 
            variant={variant} 
            onClick={onConfirm}
          >
            {isAlert ? 'OK' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
