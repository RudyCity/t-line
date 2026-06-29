import React from 'react';
import { Folder, Loader2 } from 'lucide-react';
import { FormField, Input, Select, TextArea, Button } from './Form';
import { WorkspaceInfo } from '../hooks/useWorkspaces';

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
  newLocalBranchName: string;
  setNewLocalBranchName: (val: string) => void;
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
  gitLoading,
  newLocalBranchName,
  setNewLocalBranchName
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
              onChange={(e) => setNewWorktreeBranch(e.target.value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_\-\.\/]/g, ''))}
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

        {!isNewBranch && (
          <FormField label="Custom Local Branch Name (optional)">
            <Input 
              type="text" 
              placeholder="Leave empty to use existing branch name" 
              value={newLocalBranchName}
              onChange={(e) => setNewLocalBranchName(e.target.value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_\-\.\/]/g, ''))}
              disabled={gitLoading}
            />
          </FormField>
        )}

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

export { SettingsModal } from './SettingsModal';

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

interface WorkspaceEditModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (updates: { defaultShell: string; name: string }) => void;
  workspace: WorkspaceInfo | null;
}

export const WorkspaceEditModal: React.FC<WorkspaceEditModalProps> = ({
  show,
  onClose,
  onSubmit,
  workspace
}) => {
  const [name, setName] = React.useState('');
  const [defaultShell, setDefaultShell] = React.useState('powershell');

  React.useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setDefaultShell(workspace.defaultShell || 'powershell');
    }
  }, [workspace, show]);

  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, defaultShell });
  };

  const shellOptions = [
    { value: 'powershell', label: 'PowerShell' },
    { value: 'cmd', label: 'Command Prompt (cmd)' },
    { value: 'bash', label: 'Git Bash / Bash' },
    { value: 'wsl', label: 'WSL Default' }
  ];

  return (
    <div className="modal-overlay">
      <form onSubmit={handleSubmit} className="modal-content glass-panel" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Workspace Settings</h3>
          <button 
            type="button" 
            className="action-btn" 
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <FormField label="Display Name">
          <Input 
            type="text" 
            placeholder="e.g. My Awesome Project" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </FormField>

        <FormField label="Default Terminal Shell">
          <Select 
            value={defaultShell}
            onChange={(e) => setDefaultShell(e.target.value)}
            options={shellOptions}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
