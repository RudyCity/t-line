import React from 'react';
import { Folder, Loader2, Info, Shield } from 'lucide-react';
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
}

export const TunnelSetupModal: React.FC<TunnelSetupModalProps> = ({
  show,
  onClose,
  onSubmit,
  tunnelToken,
  setTunnelToken
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <form onSubmit={onSubmit} className="modal-content glass-panel" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Cloudflare Named Tunnel</h3>
          <button type="button" className="action-btn" onClick={onClose}>×</button>
        </div>
        
        <FormField label="Cloudflare Tunnel Token">
          <TextArea 
            rows={4}
            placeholder="Paste your cloudflared tunnel token here (from your Cloudflare Zero Trust console)" 
            value={tunnelToken}
            onChange={(e) => setTunnelToken(e.target.value)}
            required
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'none' }}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Start Named Tunnel</Button>
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
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  show,
  onClose,
  token,
  workspacesCount
}) => {
  const [activeTab, setActiveTab] = React.useState<'general' | 'security'>('general');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

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
      <div className="modal-content glass-panel" style={{ maxWidth: '440px', padding: 0, overflow: 'hidden' }}>
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
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                />
              </FormField>

              <FormField label="New Master Password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Min 6 characters"
                />
              </FormField>

              <FormField label="Confirm New Master Password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Retype new password"
                />
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
        </div>
      </div>
    </div>
  );
};
