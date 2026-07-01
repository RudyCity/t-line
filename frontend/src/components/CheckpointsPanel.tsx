import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Trash2,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Calendar,
  GitBranch,
  Loader2,
  X,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { WorkspaceInfo } from '../hooks/useTerminals';
import { WorkspaceSwitcher } from './SidebarContentPanel';

interface Checkpoint {
  id: string;
  name: string;
  description: string;
  timestamp: number;
  commitHash: string;
  parentCommit: string;
  branch: string;
  isDirty: boolean;
  worktreePath: string;
}

interface CommitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
}

interface CommitDetails {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
  files: CommitFile[];
}

interface CheckpointsPanelProps {
  panelWorkspace: WorkspaceInfo | null;
  panelWorktreePath: string | null;
  token: string;
  onWorkspaceClick: (wsId: string) => void;
  onWorktreeClick: (wsId: string, wtPath: string) => void;
  onOpenDiffTab?: (commitHash: string, filePath: string, worktreePath?: string) => void;
  onCheckpointChange?: () => void;
}

export function CheckpointsPanel({
  panelWorkspace,
  panelWorktreePath,
  token,
  onWorkspaceClick,
  onWorktreeClick,
  onOpenDiffTab,
  onCheckpointChange
}: CheckpointsPanelProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checkpoint details expansion
  const [expandedCp, setExpandedCp] = useState<string | null>(null);
  const [cpDetails, setCpDetails] = useState<Record<string, CommitDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  // Create Checkpoint Dialog State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCpName, setNewCpName] = useState('');
  const [newCpDesc, setNewCpDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Restore State
  const [restoringCpId, setRestoringCpId] = useState<string | null>(null);
  const [deletingCpId, setDeletingCpId] = useState<string | null>(null);

  const targetPath = panelWorktreePath || panelWorkspace?.path || '';

  // Fetch Checkpoints list
  const fetchCheckpoints = useCallback(async () => {
    if (!panelWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const wtParam = panelWorktreePath ? `?worktreePath=${encodeURIComponent(panelWorktreePath)}` : '';
      const res = await fetch(`/api/workspaces/${panelWorkspace.id}/checkpoints${wtParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCheckpoints(data.sort((a: Checkpoint, b: Checkpoint) => b.timestamp - a.timestamp));
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to load checkpoints.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  }, [panelWorkspace, panelWorktreePath, token]);

  useEffect(() => {
    fetchCheckpoints();
    setExpandedCp(null);
  }, [panelWorkspace, panelWorktreePath, fetchCheckpoints]);

  // Load details (files modified) for expanded checkpoint
  const loadCheckpointDetails = async (cp: Checkpoint) => {
    if (cpDetails[cp.commitHash] || loadingDetails[cp.commitHash] || !cp.isDirty) {
      return;
    }

    setLoadingDetails(prev => ({ ...prev, [cp.commitHash]: true }));
    try {
      const wtParam = panelWorktreePath ? `&worktreePath=${encodeURIComponent(panelWorktreePath)}` : '';
      const res = await fetch(
        `/api/workspaces/${panelWorkspace?.id}/git/commit-details?commitHash=${encodeURIComponent(cp.commitHash)}${wtParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setCpDetails(prev => ({ ...prev, [cp.commitHash]: data }));
      }
    } catch (e) {
      console.error('Error fetching checkpoint details:', e);
    } finally {
      setLoadingDetails(prev => ({ ...prev, [cp.commitHash]: false }));
    }
  };

  const handleToggleExpand = (cp: Checkpoint) => {
    if (expandedCp === cp.id) {
      setExpandedCp(null);
    } else {
      setExpandedCp(cp.id);
      loadCheckpointDetails(cp);
    }
  };

  const handleCreateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panelWorkspace || !newCpName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch(`/api/workspaces/${panelWorkspace.id}/checkpoints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          worktreePath: panelWorktreePath,
          name: newCpName.trim(),
          description: newCpDesc.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewCpName('');
        setNewCpDesc('');
        setShowCreateModal(false);
        fetchCheckpoints();
        onCheckpointChange?.();
      } else {
        alert(data.output || 'Failed to create checkpoint.');
      }

    } catch (e: any) {
      alert(e.message || 'Error creating checkpoint.');
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreCheckpoint = async (cp: Checkpoint) => {
    const confirmMsg = `Are you sure you want to restore the checkpoint '${cp.name}'?\n\n` +
      `This will checkout branch '${cp.branch}' and restore all changes.\n` +
      `Your current working directory MUST be clean, or this restore will fail.`;

    if (!window.confirm(confirmMsg)) return;

    setRestoringCpId(cp.id);
    try {
      const res = await fetch(`/api/workspaces/${panelWorkspace?.id}/checkpoints/${cp.id}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ worktreePath: panelWorktreePath })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Checkpoint '${cp.name}' restored successfully!`);
        fetchCheckpoints();
        onCheckpointChange?.();
      } else {
        alert(data.output || 'Failed to restore checkpoint.');
      }

    } catch (e: any) {
      alert(e.message || 'Error restoring checkpoint.');
    } finally {
      setRestoringCpId(null);
    }
  };

  const handleDeleteCheckpoint = async (cp: Checkpoint) => {
    if (!window.confirm(`Are you sure you want to delete checkpoint '${cp.name}'?`)) return;

    setDeletingCpId(cp.id);
    try {
      const res = await fetch(`/api/workspaces/${panelWorkspace?.id}/checkpoints/${cp.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ worktreePath: panelWorktreePath })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchCheckpoints();
        onCheckpointChange?.();
      } else {
        alert(data.output || 'Failed to delete checkpoint.');
      }

    } catch (e: any) {
      alert(e.message || 'Error deleting checkpoint.');
    } finally {
      setDeletingCpId(null);
    }
  };

  const formatTime = (ts: number) => {
    const diffMs = Date.now() - ts;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <style>{`
        .cp-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cp-card {
          background: var(--bg-card, rgba(30, 41, 59, 0.4));
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
          border-radius: 8px;
          padding: 10px 12px;
          transition: all 0.2s ease;
        }
        .cp-card:hover {
          border-color: color-mix(in srgb, var(--color-primary) 30%, var(--border-color));
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .cp-badge-dirty {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        .cp-badge-clean {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .cp-file-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 11px;
          color: var(--text-muted);
          transition: all 0.1s ease;
        }
        .cp-file-item:hover {
          background: rgba(255,255,255,0.03);
          color: var(--text-main);
        }
        .file-status-badge {
          font-family: monospace;
          font-size: 9px;
          font-weight: bold;
          padding: 1px 4px;
          border-radius: 3px;
          text-transform: uppercase;
        }
        .status-m { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .status-a { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .status-d { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .status-r { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
      `}</style>

      {/* Workspace Switcher header */}
      {panelWorkspace && (
        <WorkspaceSwitcher
          panelWorkspace={panelWorkspace}
          panelWorktreePath={panelWorktreePath}
          onWorkspaceClick={onWorkspaceClick}
          onWorktreeClick={onWorktreeClick}
        />
      )}

      {/* Header controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold flex items-center gap-1.5">
          <Clock size={11} className="text-purple-400" />
          Checkpoints & Snapshots
        </span>
        {panelWorkspace?.isGit && (
          <button
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold cursor-pointer transition-colors"
            onClick={() => setShowCreateModal(true)}
            title="Take a snapshot of current changes"
          >
            <Camera size={12} />
            <span>Snapshot</span>
          </button>
        )}
      </div>

      {/* Main content area */}
      <div className="cp-list">
        {loading && checkpoints.length === 0 ? (
          <div className="flex items-center justify-center py-12 gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 size={14} className="animate-spin text-purple-400" />
            <span>Loading snapshots...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-red-400 text-center px-4">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        ) : !panelWorkspace?.isGit ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <AlertTriangle size={24} className="text-amber-500/80" />
            <span className="text-xs text-[var(--text-muted)] font-medium">Checkpoints are only supported in Git workspaces.</span>
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <Camera size={24} className="text-[var(--text-muted)] opacity-30" />
            <span className="text-xs text-[var(--text-muted)] font-medium">No snapshots taken yet. Click "Snapshot" to save your current working state.</span>
          </div>
        ) : (
          checkpoints.map(cp => {
            const isExpanded = expandedCp === cp.id;
            const details = cpDetails[cp.commitHash];
            const isLoadingDetails = loadingDetails[cp.commitHash];

            return (
              <div key={cp.id} className="cp-card flex flex-col gap-2">
                {/* Card Title Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[var(--text-main)] truncate">{cp.name}</span>
                    {cp.description && (
                      <span className="text-[10px] text-[var(--text-muted)] line-clamp-2">{cp.description}</span>
                    )}
                  </div>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${cp.isDirty ? 'cp-badge-dirty' : 'cp-badge-clean'}`}>
                    {cp.isDirty ? 'dirty changes' : 'clean bookmark'}
                  </span>
                </div>

                {/* Card Meta Info */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[var(--text-muted)] font-mono border-t border-[var(--border-color)]/30 pt-1.5">
                  <span className="flex items-center gap-1">
                    <Calendar size={9} />
                    {formatTime(cp.timestamp)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <GitBranch size={9} />
                    {cp.branch}
                  </span>
                  <span className="opacity-60">@{cp.parentCommit.slice(0, 7)}</span>
                </div>

                {/* Expand changes section */}
                {cp.isDirty && (
                  <div className="mt-1 border-t border-[var(--border-color)]/30 pt-1">
                    <button
                      onClick={() => handleToggleExpand(cp)}
                      className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 font-semibold"
                    >
                      {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      <span>{isExpanded ? 'Hide changes' : 'View changes'}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-1.5 flex flex-col gap-1 pl-1">
                        {isLoadingDetails ? (
                          <div className="flex items-center gap-1.5 py-2 pl-2 text-[9px] text-[var(--text-muted)]">
                            <Loader2 size={10} className="animate-spin text-purple-400" />
                            <span>Reading snapshot files...</span>
                          </div>
                        ) : details?.files && details.files.length > 0 ? (
                          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                            {details.files.map(file => (
                              <div key={file.path} className="cp-file-item">
                                <span
                                  className="truncate flex-1 font-mono text-[10px] pr-2 cursor-pointer hover:underline text-left"
                                  onClick={() => onOpenDiffTab?.(cp.commitHash, file.path, panelWorktreePath ?? undefined)}
                                  title="Click to view diff"
                                >
                                  {file.path.split(/[/\\]/).pop()}
                                </span>
                                <span className={`file-status-badge shrink-0 status-${file.status[0]}`}>
                                  {file.status[0]}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[9px] text-[var(--text-muted)] py-1 pl-2">No files recorded.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="flex items-center justify-end gap-1.5 border-t border-[var(--border-color)]/30 pt-1.5 mt-0.5">
                  <button
                    onClick={() => handleRestoreCheckpoint(cp)}
                    disabled={restoringCpId !== null}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[10px] font-semibold text-purple-400 hover:text-purple-300 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {restoringCpId === cp.id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <RotateCcw size={10} />
                    )}
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCheckpoint(cp)}
                    disabled={deletingCpId !== null}
                    className="flex items-center justify-center p-1 rounded hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-[var(--text-muted)] hover:text-red-400 cursor-pointer disabled:opacity-50 transition-colors"
                    title="Delete snapshot"
                  >
                    {deletingCpId === cp.id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Trash2 size={10} />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE CHECKPOINT MODAL DIALOG */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Camera size={15} className="text-purple-400" />
                <h3 className="modal-title">Create State Snapshot</h3>
              </div>
              <button type="button" className="action-btn" onClick={() => setShowCreateModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateCheckpoint} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 0' }}>
              <div style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '10px', wordBreak: 'break-all' }}>
                <span className="text-slate-400">Target path:</span> <span className="font-mono text-purple-300">{targetPath}</span>
              </div>

              <div className="form-group">
                <label className="form-label text-[11px]">Snapshot Name</label>
                <input
                  type="text"
                  placeholder="e.g. Before merging branch-A"
                  value={newCpName}
                  onChange={(e) => setNewCpName(e.target.value)}
                  disabled={creating}
                  className="input-field text-xs text-[var(--text-main)] bg-[var(--bg-main)] border-[var(--border-color)]"
                  style={{ width: '100%', height: '32px', marginTop: '4px', padding: '0 8px', borderRadius: '4px' }}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label text-[11px]">Description (Optional)</label>
                <textarea
                  placeholder="Explain details of your work state..."
                  value={newCpDesc}
                  onChange={(e) => setNewCpDesc(e.target.value)}
                  disabled={creating}
                  className="input-field text-xs text-[var(--text-main)] bg-[var(--bg-main)] border-[var(--border-color)] py-1.5"
                  style={{ width: '100%', minHeight: '60px', marginTop: '4px', padding: '6px 8px', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[var(--border-color)]/30 pt-3 mt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-3 py-1.5 rounded bg-transparent hover:bg-white/5 text-[var(--text-muted)] hover:text-white text-xs font-semibold cursor-pointer border border-[var(--border-color)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newCpName.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer border-0"
                >
                  {creating ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Camera size={13} />
                      <span>Create Snapshot</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
