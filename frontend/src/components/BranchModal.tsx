import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Loader2, Download, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';

interface BranchModalProps {
  show: boolean;
  onClose: () => void;
  workspace: WorkspaceInfo | null;
  worktreePath?: string | null;
  token: string;
  onBranchChanged?: () => void;
}

export const BranchModal: React.FC<BranchModalProps> = ({
  show,
  onClose,
  workspace,
  worktreePath,
  token,
  onBranchChanged
}) => {
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const [newBranchName, setNewBranchName] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);
  
  const [syncAction, setSyncAction] = useState<'pull' | 'push' | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchBranches = useCallback(async () => {
    if (!workspace) return;
    setLoadingBranches(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/branches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
        // Find current branch
        const targetPath = worktreePath || workspace.path;
        const currentWt = workspace.worktrees?.find(wt => wt.path === targetPath);
        if (currentWt && currentWt.branch) {
          setSelectedBranch(currentWt.branch);
        }
      }
    } catch (e) {
      console.error('Error fetching branches:', e);
    } finally {
      setLoadingBranches(false);
    }
  }, [workspace, token, worktreePath]);

  useEffect(() => {
    if (show && workspace) {
      fetchBranches();
      setNewBranchName('');
      setSyncStatus(null);
      setSyncAction(null);
    }
  }, [show, workspace, fetchBranches]);

  const handleCheckout = async (branchName: string) => {
    if (!workspace || !branchName) return;
    setLoadingBranches(true);
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/git/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ branchName, worktreePath })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedBranch(branchName);
        setSyncStatus({ type: 'success', message: `Checked out to ${branchName} successfully!` });
        if (onBranchChanged) onBranchChanged();
      } else {
        setSyncStatus({ type: 'error', message: data.output || 'Checkout failed.' });
      }
    } catch (e: any) {
      setSyncStatus({ type: 'error', message: e.message || 'Checkout failed.' });
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !newBranchName.trim()) return;
    setCreatingBranch(true);
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/git/branch/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ branchName: newBranchName.trim(), worktreePath })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncStatus({ type: 'success', message: `Branch '${newBranchName}' created and checked out!` });
        setNewBranchName('');
        fetchBranches();
        if (onBranchChanged) onBranchChanged();
      } else {
        setSyncStatus({ type: 'error', message: data.output || 'Failed to create branch.' });
      }
    } catch (e: any) {
      setSyncStatus({ type: 'error', message: e.message || 'Failed to create branch.' });
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleSync = async (action: 'pull' | 'push') => {
    if (!workspace) return;
    setSyncAction(action);
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/git/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ worktreePath })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncStatus({ 
          type: 'success', 
          message: `${action === 'pull' ? 'Pulled' : 'Pushed'} changes successfully!\n${data.output || ''}` 
        });
        if (onBranchChanged) onBranchChanged();
      } else {
        setSyncStatus({ 
          type: 'error', 
          message: `${action === 'pull' ? 'Pull' : 'Push'} failed:\n${data.output || 'Unknown error.'}` 
        });
      }
    } catch (e: any) {
      setSyncStatus({ 
        type: 'error', 
        message: `${action === 'pull' ? 'Pull' : 'Push'} failed: ${e.message}` 
      });
    } finally {
      setSyncAction(null);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-purple-400" />
            <h3 className="modal-title">Branch Management</h3>
          </div>
          <button type="button" className="action-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
          {/* Workspace Path Info */}
          <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.75rem', wordBreak: 'break-all' }}>
            <span className="text-slate-400">Path:</span> <span className="font-mono text-purple-300">{worktreePath || workspace?.path}</span>
          </div>

          {/* Checkout Section */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Checkout Local Branch</span>
              {loadingBranches && <Loader2 size={12} className="animate-spin text-purple-400" />}
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => handleCheckout(e.target.value)}
              disabled={loadingBranches || !!syncAction}
              className="workspace-select-dropdown"
              style={{ width: '100%', marginTop: '6px' }}
            >
              <option value="" disabled>Select a branch...</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Create Branch Section */}
          <form onSubmit={handleCreateBranch} className="form-group" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <label className="form-label">Create New Branch</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <input
                type="text"
                placeholder="branch-name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                disabled={creatingBranch || !!syncAction}
                className="input-field"
                style={{ flex: 1, height: '36px' }}
                required
              />
              <button
                type="submit"
                disabled={creatingBranch || !!syncAction || !newBranchName.trim()}
                className="git-commit-btn"
                style={{ height: '36px', padding: '0 12px', whiteSpace: 'nowrap' }}
              >
                {creatingBranch ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <Plus size={14} style={{ marginRight: '4px' }} />
                    Create
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Repository Sync Section */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <label className="form-label">Synchronize Repository</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => handleSync('pull')}
                disabled={!!syncAction || loadingBranches}
                className="git-commit-btn"
                style={{ flex: 1, height: '36px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {syncAction === 'pull' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <Download size={14} style={{ marginRight: '6px' }} />
                    Pull
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSync('push')}
                disabled={!!syncAction || loadingBranches}
                className="git-commit-btn"
                style={{ flex: 1, height: '36px' }}
              >
                {syncAction === 'push' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <Upload size={14} style={{ marginRight: '6px' }} />
                    Push
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sync status logs */}
          {syncStatus && (
            <div 
              style={{
                display: 'flex',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
                marginTop: '8px',
                background: syncStatus.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                color: syncStatus.type === 'success' ? '#10b981' : '#ef4444',
                border: syncStatus.type === 'success' ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(239,68,68,0.15)'
              }}
            >
              {syncStatus.type === 'success' ? (
                <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              ) : (
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              )}
              <div style={{ flex: 1, overflowX: 'auto', fontFamily: 'monospace' }}>{syncStatus.message}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
