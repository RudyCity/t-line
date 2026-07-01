import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Loader2, Download, Upload, X, CheckCircle2, AlertCircle, Search, Trash2, Check, RefreshCw } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

  const [newBranchName, setNewBranchName] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);

  const [syncAction, setSyncAction] = useState<'pull' | 'push' | 'fetch' | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
  const [forceDeleteBranch, setForceDeleteBranch] = useState<string | null>(null);

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
      setSearchQuery('');
      setSyncStatus(null);
      setSyncAction(null);
      setDeletingBranch(null);
      setForceDeleteBranch(null);
    }
  }, [show, workspace, fetchBranches]);

  const handleCheckout = async (branchName: string) => {
    if (!workspace || !branchName || branchName === selectedBranch) return;
    setLoadingBranches(true);
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/git/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  const handleDeleteBranch = async (branchName: string, force = false) => {
    if (!workspace) return;
    setLoadingBranches(true);
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/git/branch/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ branchName, force, worktreePath })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncStatus({ type: 'success', message: `Branch '${branchName}' deleted successfully.` });
        setDeletingBranch(null);
        setForceDeleteBranch(null);
        fetchBranches();
      } else {
        const isUnmerged = data.output && (
          data.output.includes('not fully merged') ||
          data.output.includes('git branch -D')
        );
        if (isUnmerged && !force) {
          setForceDeleteBranch(branchName);
          setSyncStatus({ type: 'error', message: `Branch '${branchName}' has unmerged changes. Delete anyway (force)?` });
        } else {
          setSyncStatus({ type: 'error', message: data.output || 'Failed to delete branch.' });
          setDeletingBranch(null);
          setForceDeleteBranch(null);
        }
      }
    } catch (e: any) {
      setSyncStatus({ type: 'error', message: e.message || 'Failed to delete branch.' });
      setDeletingBranch(null);
      setForceDeleteBranch(null);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleSync = async (action: 'pull' | 'push' | 'fetch') => {
    if (!workspace) return;
    setSyncAction(action);
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/git/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ worktreePath })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const actionLabel = action === 'pull' ? 'Pulled' : action === 'push' ? 'Pushed' : 'Fetched';
        setSyncStatus({ type: 'success', message: `${actionLabel} changes successfully!\n${data.output || ''}` });
        if (action === 'fetch' || action === 'pull') fetchBranches();
        if (onBranchChanged) onBranchChanged();
      } else {
        const actionLabel = action === 'pull' ? 'Pull' : action === 'push' ? 'Push' : 'Fetch';
        setSyncStatus({ type: 'error', message: `${actionLabel} failed:\n${data.output || 'Unknown error.'}` });
      }
    } catch (e: any) {
      const actionLabel = action === 'pull' ? 'Pull' : action === 'push' ? 'Push' : 'Fetch';
      setSyncStatus({ type: 'error', message: `${actionLabel} failed: ${e.message}` });
    } finally {
      setSyncAction(null);
    }
  };

  if (!show) return null;

  const filteredBranches = branches.filter(b =>
    b.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bm-overlay">
      <div className="bm-content">
        {/* Header */}
        <div className="bm-header">
          <div className="bm-title">
            <GitBranch size={18} className="bm-title-icon" />
            <span>Branch Management</span>
          </div>
          <button type="button" className="bm-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Path Badge */}
        <div className="bm-path-badge">
          <span className="bm-path-label">Path:</span>
          <span className="bm-path-value">{worktreePath || workspace?.path}</span>
        </div>

        {/* Sync Buttons */}
        <div className="bm-section">
          <div className="bm-section-label">Synchronize Repository</div>
          <div className="bm-sync-grid">
            <button type="button" onClick={() => handleSync('fetch')} disabled={!!syncAction || loadingBranches} className="bm-sync-btn">
              {syncAction === 'fetch' ? <Loader2 size={13} className="animate-spin" /> : <><RefreshCw size={13} />Fetch</>}
            </button>
            <button type="button" onClick={() => handleSync('pull')} disabled={!!syncAction || loadingBranches} className="bm-sync-btn">
              {syncAction === 'pull' ? <Loader2 size={13} className="animate-spin" /> : <><Download size={13} />Pull</>}
            </button>
            <button type="button" onClick={() => handleSync('push')} disabled={!!syncAction || loadingBranches} className="bm-sync-btn bm-sync-btn--primary">
              {syncAction === 'push' ? <Loader2 size={13} className="animate-spin" /> : <><Upload size={13} />Push</>}
            </button>
          </div>
        </div>

        {/* Branch List */}
        <div className="bm-section">
          <div className="bm-section-label bm-section-label--row">
            <span>Checkout Local Branch</span>
            {loadingBranches && <Loader2 size={12} className="animate-spin bm-title-icon" />}
          </div>
          {/* Search */}
          <div className="bm-search-wrap">
            <Search size={13} className="bm-search-icon" />
            <input
              type="text"
              placeholder="Search branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!!syncAction || loadingBranches}
              className="bm-search-input"
            />
          </div>
          {/* List */}
          <div className="bm-list">
            {filteredBranches.length === 0 ? (
              <div className="bm-list-empty">
                {branches.length === 0 ? 'No local branches found.' : 'No branches match search.'}
              </div>
            ) : filteredBranches.map(b => {
              const isActive = b === selectedBranch;
              const isDeleting = deletingBranch === b;
              const isForceDel = forceDeleteBranch === b;

              if (isDeleting || isForceDel) {
                return (
                  <div key={b} className="bm-list-item bm-list-item--confirm">
                    <span className="bm-confirm-label">
                      <AlertCircle size={13} />
                      {isForceDel ? `Force delete '${b}'?` : `Delete branch '${b}'?`}
                    </span>
                    <span className="bm-confirm-actions">
                      <button className="bm-confirm-yes" onClick={() => handleDeleteBranch(b, isForceDel)}>Delete</button>
                      <button className="bm-confirm-cancel" onClick={() => { setDeletingBranch(null); setForceDeleteBranch(null); }}>Cancel</button>
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={b}
                  className={`bm-list-item${isActive ? ' bm-list-item--active' : ''}`}
                  onClick={() => { if (!isActive && !syncAction && !loadingBranches) handleCheckout(b); }}
                >
                  <span className="bm-list-item-left">
                    <GitBranch size={12} />
                    <span className="bm-list-item-name">{b}</span>
                  </span>
                  <span className="bm-list-item-right" onClick={(e) => e.stopPropagation()}>
                    {isActive
                      ? <Check size={13} className="bm-active-check" />
                      : (
                        <button
                          type="button"
                          className="bm-trash-btn"
                          disabled={!!syncAction || loadingBranches}
                          onClick={() => setDeletingBranch(b)}
                          title="Delete local branch"
                        >
                          <Trash2 size={13} />
                        </button>
                      )
                    }
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Create Branch */}
        <div className="bm-section bm-section--bordered">
          <div className="bm-section-label">Create New Branch</div>
          <form onSubmit={handleCreateBranch} className="bm-create-form">
            <input
              type="text"
              placeholder="Enter branch name..."
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              disabled={creatingBranch || !!syncAction}
              className="bm-create-input"
              required
            />
            <button type="submit" disabled={creatingBranch || !!syncAction || !newBranchName.trim()} className="bm-create-btn">
              {creatingBranch ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} />Create</>}
            </button>
          </form>
        </div>

        {/* Status */}
        {syncStatus && (
          <div className={`bm-status${syncStatus.type === 'success' ? ' bm-status--success' : ' bm-status--error'}`}>
            {syncStatus.type === 'success'
              ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            }
            <span className="bm-status-text">{syncStatus.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
