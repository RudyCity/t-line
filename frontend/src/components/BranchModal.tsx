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

  const handleDeleteBranch = async (branchName: string, force = false) => {
    if (!workspace) return;
    setLoadingBranches(true);
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/git/branch/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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
          setSyncStatus({ 
            type: 'error', 
            message: `Branch '${branchName}' has unmerged changes. Delete anyway (force)?` 
          });
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
      const apiEndpoint = action === 'fetch' ? 'fetch' : action;
      const res = await fetch(`/api/workspaces/${workspace.id}/git/${apiEndpoint}`, {
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
          message: `${action === 'pull' ? 'Pulled' : action === 'push' ? 'Pushed' : 'Fetched'} changes successfully!\n${data.output || ''}` 
        });
        if (action === 'fetch' || action === 'pull') {
          fetchBranches();
        }
        if (onBranchChanged) onBranchChanged();
      } else {
        setSyncStatus({ 
          type: 'error', 
          message: `${action === 'pull' ? 'Pull' : action === 'push' ? 'Push' : 'Fetch'} failed:\n${data.output || 'Unknown error.'}` 
        });
      }
    } catch (e: any) {
      setSyncStatus({ 
        type: 'error', 
        message: `${action === 'pull' ? 'Pull' : action === 'push' ? 'Push' : 'Fetch'} failed: ${e.message}` 
      });
    } finally {
      setSyncAction(null);
    }
  };

  if (!show) return null;

  const filteredBranches = branches.filter(b => 
    b.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="branch-modal-overlay">
      <style>{`
        .branch-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(8, 10, 15, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: branchFadeIn 0.2s ease-out;
        }

        @keyframes branchFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .branch-modal-content {
          width: 100%;
          max-width: 450px;
          background: rgba(20, 24, 33, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5);
          padding: 24px;
          color: #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 18px;
          animation: branchScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes branchScaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .branch-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 4px;
        }

        .branch-modal-title {
          font-size: 1.2rem;
          font-weight: 600;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .branch-close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .branch-close-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f1f5f9;
        }

        .branch-path-badge {
          background: rgba(139, 92, 246, 0.06);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 6px;
          padding: 8px 12px;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 0.75rem;
          color: #d8b4fe;
          word-break: break-all;
        }

        .branch-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .branch-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 38px;
          font-size: 0.8rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #cbd5e1;
        }

        .branch-action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .branch-action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .branch-action-btn.btn-primary-purple {
          background: #8b5cf6;
          color: white;
          border: none;
        }

        .branch-action-btn.btn-primary-purple:hover:not(:disabled) {
          background: #a78bfa;
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.35);
        }

        .branch-search-container {
          position: relative;
          width: 100%;
        }

        .branch-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
        }

        .branch-search-input {
          width: 100%;
          height: 36px;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 0 12px 0 32px;
          color: #f8fafc;
          font-size: 0.8rem;
          transition: all 0.2s;
        }

        .branch-search-input:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
        }

        .branch-list-container {
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
        }

        .branch-list-container::-webkit-scrollbar {
          width: 6px;
        }

        .branch-list-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .branch-list-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .branch-list-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .branch-list-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          cursor: pointer;
          transition: all 0.15s;
          font-size: 0.8rem;
          color: #cbd5e1;
          min-height: 38px;
        }

        .branch-list-item:last-child {
          border-bottom: none;
        }

        .branch-list-item:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #ffffff;
        }

        .branch-list-item.is-active {
          background: rgba(139, 92, 246, 0.08);
          border-left: 3px solid #8b5cf6;
          color: #e9d5ff;
          font-weight: 600;
        }

        .branch-list-item-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .branch-list-item-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .branch-list-item-trash-btn {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          opacity: 0;
        }

        .branch-list-item:hover .branch-list-item-trash-btn {
          opacity: 0.8;
        }

        .branch-list-item-trash-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          opacity: 1 !important;
        }

        .branch-item-confirm-delete {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: #f87171;
          width: 100%;
          justify-content: space-between;
        }

        .branch-confirm-actions {
          display: flex;
          gap: 6px;
        }

        .branch-confirm-yes-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.72rem;
          font-weight: 600;
          transition: background 0.15s;
        }

        .branch-confirm-yes-btn:hover {
          background: #dc2626;
        }

        .branch-confirm-cancel-btn {
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.72rem;
          transition: background 0.15s;
        }

        .branch-confirm-cancel-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .branch-section-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .branch-no-results {
          padding: 20px;
          text-align: center;
          color: #64748b;
          font-size: 0.8rem;
        }

        .branch-create-form {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .branch-create-input {
          flex: 1;
          height: 36px;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 0 12px;
          color: #f8fafc;
          font-size: 0.8rem;
          transition: all 0.2s;
        }

        .branch-create-input:focus {
          outline: none;
          border-color: #8b5cf6;
        }

        .branch-create-btn {
          height: 36px;
          padding: 0 14px;
          background: #8b5cf6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: background 0.15s;
        }

        .branch-create-btn:hover:not(:disabled) {
          background: #9f75ff;
        }

        .branch-create-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .branch-status-box {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 0.75rem;
          white-space: pre-wrap;
          margin-top: 4px;
          align-items: flex-start;
        }

        .branch-status-box.is-success {
          background: rgba(16, 185, 129, 0.08);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.15);
        }

        .branch-status-box.is-error {
          background: rgba(239, 68, 68, 0.08);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.15);
        }
      `}</style>

      <div className="branch-modal-content">
        {/* Header */}
        <div className="branch-modal-header">
          <div className="branch-modal-title">
            <GitBranch size={18} className="text-purple-400" />
            <span>Branch Management</span>
          </div>
          <button type="button" className="branch-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Workspace Path Info */}
        <div className="branch-path-badge">
          Path: {worktreePath || workspace?.path}
        </div>

        {/* Repository Sync Buttons Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="branch-section-label">Synchronize Repository</div>
          <div className="branch-grid-3">
            <button
              type="button"
              onClick={() => handleSync('fetch')}
              disabled={!!syncAction || loadingBranches}
              className="branch-action-btn"
            >
              {syncAction === 'fetch' ? (
                <Loader2 size={13} className="animate-spin text-purple-400" />
              ) : (
                <>
                  <RefreshCw size={13} />
                  Fetch
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSync('pull')}
              disabled={!!syncAction || loadingBranches}
              className="branch-action-btn"
            >
              {syncAction === 'pull' ? (
                <Loader2 size={13} className="animate-spin text-purple-400" />
              ) : (
                <>
                  <Download size={13} />
                  Pull
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSync('push')}
              disabled={!!syncAction || loadingBranches}
              className="branch-action-btn btn-primary-purple"
            >
              {syncAction === 'push' ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <>
                  <Upload size={13} />
                  Push
                </>
              )}
            </button>
          </div>
        </div>

        {/* Branch List Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="branch-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Checkout Local Branch</span>
            {loadingBranches && <Loader2 size={12} className="animate-spin text-purple-400" />}
          </div>

          {/* Search Box */}
          <div className="branch-search-container">
            <Search size={14} className="branch-search-icon" />
            <input
              type="text"
              placeholder="Search branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!!syncAction || loadingBranches}
              className="branch-search-input"
            />
          </div>

          {/* Custom Scrollable Branch List */}
          <div className="branch-list-container">
            {filteredBranches.length === 0 ? (
              <div className="branch-no-results">
                {branches.length === 0 ? 'No local branches found.' : 'No branches match search.'}
              </div>
            ) : (
              filteredBranches.map(b => {
                const isActive = b === selectedBranch;
                const isDeleting = deletingBranch === b;
                const isForceDeleting = forceDeleteBranch === b;

                if (isDeleting || isForceDeleting) {
                  return (
                    <div key={b} className="branch-list-item" style={{ cursor: 'default' }}>
                      <div className="branch-item-confirm-delete">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertCircle size={14} />
                          {isForceDeleting ? `Force delete '${b}'?` : `Delete branch '${b}'?`}
                        </span>
                        <div className="branch-confirm-actions">
                          <button
                            type="button"
                            className="branch-confirm-yes-btn"
                            onClick={() => handleDeleteBranch(b, isForceDeleting)}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="branch-confirm-cancel-btn"
                            onClick={() => {
                              setDeletingBranch(null);
                              setForceDeleteBranch(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={b}
                    className={`branch-list-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => {
                      if (!isActive && !syncAction && !loadingBranches) {
                        handleCheckout(b);
                      }
                    }}
                  >
                    <div className="branch-list-item-left">
                      <GitBranch size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b}</span>
                    </div>
                    <div className="branch-list-item-right" onClick={(e) => e.stopPropagation()}>
                      {isActive ? (
                        <Check size={13} className="text-purple-400" style={{ marginRight: '4px' }} />
                      ) : (
                        <button
                          type="button"
                          className="branch-list-item-trash-btn"
                          disabled={!!syncAction || loadingBranches}
                          onClick={() => setDeletingBranch(b)}
                          title="Delete local branch"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Create Branch Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
          <div className="branch-section-label">Create New Branch</div>
          <form onSubmit={handleCreateBranch} className="branch-create-form">
            <input
              type="text"
              placeholder="Enter branch name..."
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              disabled={creatingBranch || !!syncAction}
              className="branch-create-input"
              required
            />
            <button
              type="submit"
              disabled={creatingBranch || !!syncAction || !newBranchName.trim()}
              className="branch-create-btn"
            >
              {creatingBranch ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <>
                  <Plus size={13} />
                  Create
                </>
              )}
            </button>
          </form>
        </div>

        {/* Status Messages */}
        {syncStatus && (
          <div className={`branch-status-box ${syncStatus.type === 'success' ? 'is-success' : 'is-error'}`}>
            {syncStatus.type === 'success' ? (
              <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            )}
            <div style={{ flex: 1, overflowX: 'auto', fontFamily: 'monospace' }}>{syncStatus.message}</div>
          </div>
        )}
      </div>
    </div>
  );
};
