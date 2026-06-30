import React, { useState, useCallback } from 'react';
import {
  FilePlus,
  FileMinus,
  FileX,
  FileCode,
  X,
  Loader2,
  Plus,
  Minus,
  RotateCcw,
  GitCommit,
  RefreshCw,
  GitBranch
} from 'lucide-react';
import { GitHistory } from './GitHistory';

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed';
  staged: boolean;
  unstaged: boolean;
}

interface GitChangesProps {
  workspaceId: string;
  token: string;
  files: GitFileStatus[];
  loading: boolean;
  onRefresh: () => void;
  worktreePath?: string | null;
  onOpenBranchModal?: () => void;
  onFileOpen?: (filePath: string, name: string) => void;
  workspacePath?: string;
}

function StatusIcon({ status }: { status: GitFileStatus['status'] }) {
  switch (status) {
    case 'added':
      return <FilePlus size={13} style={{ color: '#4ade80', flexShrink: 0 }} />;
    case 'deleted':
      return <FileMinus size={13} style={{ color: '#f87171', flexShrink: 0 }} />;
    case 'untracked':
      return <FileX size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />;
    case 'renamed':
      return <FileCode size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />;
    default:
      return <FileCode size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />;
  }
}

const STATUS_LABEL: Record<GitFileStatus['status'], { label: string; color: string }> = {
  modified: { label: 'M', color: '#fbbf24' },
  added:    { label: 'A', color: '#4ade80' },
  deleted:  { label: 'D', color: '#f87171' },
  untracked:{ label: 'U', color: '#94a3b8' },
  renamed:  { label: 'R', color: '#a78bfa' }
};

function parseDiff(diff: string): { header: string; hunks: { header: string; lines: { type: '+' | '-' | ' '; text: string }[] }[] } {
  const lines = diff.split('\n');
  let header = '';
  const hunks: { header: string; lines: { type: '+' | '-' | ' '; text: string }[] }[] = [];
  let currentHunk: typeof hunks[0] | null = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = { header: line, lines: [] };
    } else if (currentHunk) {
      if (line.startsWith('+')) currentHunk.lines.push({ type: '+', text: line.slice(1) });
      else if (line.startsWith('-')) currentHunk.lines.push({ type: '-', text: line.slice(1) });
      else currentHunk.lines.push({ type: ' ', text: line.slice(1) });
    } else {
      header += line + '\n';
    }
  }
  if (currentHunk) hunks.push(currentHunk);
  return { header, hunks };
}

export function GitChanges({
  workspaceId,
  token,
  files,
  loading,
  onRefresh,
  worktreePath,
  onOpenBranchModal,
  onFileOpen,
  workspacePath,
}: GitChangesProps) {
  const [activeTab, setActiveTab] = useState<'changes' | 'history'>('changes');
  const [selectedFile, setSelectedFile] = useState<GitFileStatus | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);
  
  const [commitMessage, setCommitMessage] = useState('');
  const [stageAllBeforeCommit, setStageAllBeforeCommit] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleFileSelect = useCallback(async (file: GitFileStatus) => {
    setSelectedFile(file);
    setDiff('');

    // Open the file as a tab if handler is provided and file is not deleted
    if (onFileOpen && file.status !== 'deleted') {
      const basePath = worktreePath || workspacePath || '';
      const sep = basePath.endsWith('/') || basePath.endsWith('\\') ? '' : '/';
      const fullPath = basePath ? `${basePath}${sep}${file.path.replace(/\\/g, '/')}` : file.path;
      const fileName = file.path.split(/[/\\]/).pop() ?? file.path;
      onFileOpen(fullPath, fileName);
    }

    if (file.status === 'untracked' || file.status === 'added') {
      setDiff('(New/untracked file – no diff available)');
      return;
    }
    if (file.status === 'deleted') {
      setDiff('(File deleted)');
      return;
    }
    setDiffLoading(true);
    try {
      const queryParam = worktreePath ? `&worktreePath=${encodeURIComponent(worktreePath)}` : '';
      const res = await fetch(
        `/api/workspaces/${workspaceId}/git/diff?filePath=${encodeURIComponent(file.path)}${queryParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setDiff(data.diff || '(Empty diff)');
      }
    } catch {
      setDiff('(Error loading diff)');
    } finally {
      setDiffLoading(false);
    }
  }, [workspaceId, token, worktreePath, workspacePath, onFileOpen]);

  const handleStage = useCallback(async (filePath?: string, all = false) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/git/stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ filePath, all, worktreePath })
      });
      if (res.ok) {
        onRefresh();
        if (filePath && selectedFile?.path === filePath) {
          setSelectedFile(null);
          setDiff('');
        }
      } else {
        const err = await res.json();
        alert(`Failed to stage changes: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error staging changes: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [workspaceId, token, worktreePath, onRefresh, selectedFile]);

  const handleUnstage = useCallback(async (filePath?: string, all = false) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/git/unstage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ filePath, all, worktreePath })
      });
      if (res.ok) {
        onRefresh();
        if (filePath && selectedFile?.path === filePath) {
          setSelectedFile(null);
          setDiff('');
        }
      } else {
        const err = await res.json();
        alert(`Failed to unstage changes: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error unstaging changes: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [workspaceId, token, worktreePath, onRefresh, selectedFile]);

  const handleDiscard = useCallback(async (filePath?: string, all = false) => {
    const confirmMessage = all 
      ? 'Are you sure you want to discard ALL changes? This action cannot be undone.'
      : `Are you sure you want to discard changes in ${filePath}? Untracked files will be deleted. This action cannot be undone.`;
      
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/git/discard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ filePath, all, worktreePath })
      });
      if (res.ok) {
        onRefresh();
        if (all || (filePath && selectedFile?.path === filePath)) {
          setSelectedFile(null);
          setDiff('');
        }
      } else {
        const err = await res.json();
        alert(`Failed to discard changes: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error discarding changes: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [workspaceId, token, worktreePath, onRefresh, selectedFile]);

  const handleCommit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commitMessage.trim()) {
      alert('Please enter a commit message.');
      return;
    }

    const hasStaged = files.some(f => f.staged);
    let commitAll = stageAllBeforeCommit;

    if (!hasStaged && !commitAll) {
      const confirmAll = window.confirm('There are no staged changes. Do you want to stage all changes and commit them?');
      if (confirmAll) {
        commitAll = true;
      } else {
        return;
      }
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/git/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: commitMessage.trim(), commitAll, worktreePath })
      });
      if (res.ok) {
        setCommitMessage('');
        onRefresh();
        setSelectedFile(null);
        setDiff('');
      } else {
        const err = await res.json();
        alert(`Failed to commit: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error committing changes: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [workspaceId, token, worktreePath, commitMessage, files, stageAllBeforeCommit, onRefresh]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCommit();
    }
  };

  const parsed = diff ? parseDiff(diff) : null;
  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => f.unstaged);

  return (
    <div className="panel-container">
      <style>{`
        /* Segmented tab styling */
        .git-tabs-container {
          display: flex;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.15);
          flex-shrink: 0;
        }
        .git-tab-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border-bottom: 2px solid transparent;
        }
        .git-tab-btn:hover {
          color: var(--text-main);
          background: rgba(255,255,255,0.02);
        }
        .git-tab-btn-active {
          color: var(--color-primary, #a855f7) !important;
          border-bottom-color: var(--color-primary, #a855f7);
          background: rgba(168, 85, 247, 0.04);
        }

        .git-commit-container {
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .git-commit-textarea {
          width: 100%;
          min-height: 52px;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 6px 8px;
          color: var(--text-main);
          font-family: inherit;
          font-size: 0.8rem;
          resize: vertical;
          outline: none;
          transition: border-color 0.2s;
        }
        .git-commit-textarea:focus {
          border-color: var(--color-primary, #a855f7);
        }
        .git-commit-options {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: var(--text-muted);
          cursor: pointer;
          user-select: none;
        }
        .git-commit-btn {
          background: var(--color-primary, #a855f7);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .git-commit-btn:hover:not(:disabled) {
          background: #9333ea;
        }
        .git-commit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .git-section-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px 4px 12px;
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-top: 1px solid rgba(255,255,255,0.03);
        }
        .git-section-title:first-of-type {
          border-top: none;
        }
        .git-action-btn {
          background: none;
          border: none;
          padding: 2px;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          opacity: 0;
          transition: opacity 0.2s, color 0.2s, background 0.2s;
        }
        .explorer-item:hover .git-action-btn {
          opacity: 0.6;
        }
        .git-action-btn:hover {
          opacity: 1 !important;
          color: var(--text-main) !important;
          background: rgba(255,255,255,0.08);
        }
        .git-action-btn.hover-danger:hover {
          color: var(--color-danger, #ef4444) !important;
          background: rgba(239,68,68,0.1);
        }
        .git-header-actions {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .git-actions-wrapper {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-right: 8px;
        }
      `}</style>

      <div className="git-tabs-container">
        <button
          className={`git-tab-btn ${activeTab === 'changes' ? 'git-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('changes')}
        >
          Changes
        </button>
        <button
          className={`git-tab-btn ${activeTab === 'history' ? 'git-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      {activeTab === 'changes' ? (
        <div className="panel-split">
          {/* Changed files list */}
          <div className="explorer-tree">
            <div className="panel-section-header">
              <span className="panel-section-title">
                SOURCE CONTROL
                {files.length > 0 && (
                  <span className="changes-badge">{files.length}</span>
                )}
              </span>
              <div className="git-header-actions">
                {onOpenBranchModal && (
                  <button
                    className="action-btn"
                    onClick={onOpenBranchModal}
                    title="Branch Management & Sync"
                  >
                    <GitBranch size={13} />
                  </button>
                )}
                {unstagedFiles.length > 0 && (
                  <button
                    className="action-btn"
                    onClick={() => handleStage(undefined, true)}
                    title="Stage All Changes"
                    disabled={loading || actionLoading}
                  >
                    <Plus size={13} />
                  </button>
                )}
                {stagedFiles.length > 0 && (
                  <button
                    className="action-btn"
                    onClick={() => handleUnstage(undefined, true)}
                    title="Unstage All Changes"
                    disabled={loading || actionLoading}
                  >
                    <Minus size={13} />
                  </button>
                )}
                {files.length > 0 && (
                  <button
                    className="action-btn action-btn-danger"
                    onClick={() => handleDiscard(undefined, true)}
                    title="Discard All Changes"
                    disabled={loading || actionLoading}
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
                <button
                  className="action-btn"
                  onClick={onRefresh}
                  title="Refresh"
                  disabled={loading || actionLoading}
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Commit container */}
            {files.length > 0 && (
              <div className="git-commit-container">
                <textarea
                  className="git-commit-textarea"
                  placeholder="Commit message (Ctrl+Enter to commit...)"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={actionLoading}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="git-commit-options">
                    <input
                      type="checkbox"
                      checked={stageAllBeforeCommit}
                      onChange={(e) => setStageAllBeforeCommit(e.target.checked)}
                      disabled={actionLoading}
                    />
                    <span>Stage all & commit</span>
                  </label>
                  <button
                    className="git-commit-btn"
                    onClick={() => handleCommit()}
                    disabled={actionLoading || !commitMessage.trim()}
                  >
                    Commit
                  </button>
                </div>
              </div>
            )}

            <div className="explorer-scroll">
              {loading ? (
                <div className="panel-loading">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Checking...</span>
                </div>
              ) : files.length === 0 ? (
                <div className="panel-empty">
                  <GitCommit size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <span>No changes</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  {/* Staged Changes Section */}
                  {stagedFiles.length > 0 && (
                    <>
                      <div className="git-section-title">
                        <span>Staged Changes ({stagedFiles.length})</span>
                        <button
                          className="action-btn"
                          style={{ padding: '2px', background: 'none' }}
                          onClick={() => handleUnstage(undefined, true)}
                          title="Unstage All"
                          disabled={actionLoading}
                        >
                          <Minus size={11} />
                        </button>
                      </div>
                      {stagedFiles.map(file => {
                        const { label, color } = STATUS_LABEL[file.status];
                        const isActive = selectedFile?.path === file.path;
                        const fileName = file.path.split(/[/\\]/).pop() ?? file.path;
                        const dirName = file.path.split(/[/\\]/).slice(0, -1).join('/');
                        return (
                          <div
                            key={`staged-${file.path}`}
                            className={`explorer-item ${isActive ? 'explorer-item-active' : ''}`}
                            style={{ paddingLeft: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}
                            onClick={() => handleFileSelect(file)}
                            title={file.path}
                          >
                            <StatusIcon status={file.status} />
                            <span className="flex-1 min-w-0 text-left" style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="explorer-item-name">{fileName}</span>
                              {dirName && (
                                <span className="explorer-item-dir">{dirName}</span>
                              )}
                            </span>
                            
                            <div className="git-actions-wrapper">
                              <button
                                className="git-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnstage(file.path);
                                }}
                                title="Unstage Changes"
                                disabled={actionLoading}
                              >
                                <Minus size={13} />
                              </button>
                            </div>

                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color, flexShrink: 0, width: '12px', textAlign: 'center', marginRight: '4px' }}>
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Unstaged Changes Section */}
                  {unstagedFiles.length > 0 && (
                    <>
                      <div className="git-section-title" style={{ marginTop: stagedFiles.length > 0 ? '8px' : '0px' }}>
                        <span>Changes ({unstagedFiles.length})</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="action-btn"
                            style={{ padding: '2px', background: 'none' }}
                            onClick={() => handleStage(undefined, true)}
                            title="Stage All"
                            disabled={actionLoading}
                          >
                            <Plus size={11} />
                          </button>
                          <button
                            className="action-btn action-btn-danger"
                            style={{ padding: '2px', background: 'none' }}
                            onClick={() => handleDiscard(undefined, true)}
                            title="Discard All"
                            disabled={actionLoading}
                          >
                            <RotateCcw size={11} />
                          </button>
                        </div>
                      </div>
                      {unstagedFiles.map(file => {
                        const { label, color } = STATUS_LABEL[file.status];
                        const isActive = selectedFile?.path === file.path;
                        const fileName = file.path.split(/[/\\]/).pop() ?? file.path;
                        const dirName = file.path.split(/[/\\]/).slice(0, -1).join('/');
                        return (
                          <div
                            key={`unstaged-${file.path}`}
                            className={`explorer-item ${isActive ? 'explorer-item-active' : ''}`}
                            style={{ paddingLeft: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}
                            onClick={() => handleFileSelect(file)}
                            title={file.path}
                          >
                            <StatusIcon status={file.status} />
                            <span className="flex-1 min-w-0 text-left" style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="explorer-item-name">{fileName}</span>
                              {dirName && (
                                <span className="explorer-item-dir">{dirName}</span>
                              )}
                            </span>
                            
                            <div className="git-actions-wrapper">
                              <button
                                className="git-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStage(file.path);
                                }}
                                title="Stage Changes"
                                disabled={actionLoading}
                              >
                                <Plus size={13} />
                              </button>
                              <button
                                className="git-action-btn hover-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDiscard(file.path);
                                }}
                                title="Discard Changes"
                                disabled={actionLoading}
                              >
                                <RotateCcw size={13} />
                              </button>
                            </div>

                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color, flexShrink: 0, width: '12px', textAlign: 'center', marginRight: '4px' }}>
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Diff viewer */}
          {selectedFile && (
            <div className="file-preview">
              <div className="panel-section-header">
                <div className="flex items-center gap-2 truncate">
                  <StatusIcon status={selectedFile.status} />
                  <span className="panel-section-title truncate">
                    {selectedFile.path.split(/[/\\]/).pop()}
                  </span>
                </div>
                <button className="action-btn" onClick={() => setSelectedFile(null)} title="Close">
                  <X size={13} />
                </button>
              </div>
              <div className="file-preview-content">
                {diffLoading ? (
                  <div className="panel-loading">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Loading diff...</span>
                  </div>
                ) : parsed && parsed.hunks.length > 0 ? (
                  <div className="diff-viewer">
                    {parsed.hunks.map((hunk, hi) => (
                      <div key={hi} className="diff-hunk">
                        <div className="diff-hunk-header">{hunk.header}</div>
                        {hunk.lines.map((line, li) => (
                          <div
                            key={li}
                            className={`diff-line ${
                              line.type === '+' ? 'diff-line-add' :
                              line.type === '-' ? 'diff-line-del' : 'diff-line-ctx'
                            }`}
                          >
                            <span className="diff-line-sign">
                              {line.type === ' ' ? ' ' : line.type}
                            </span>
                            <span className="diff-line-text">{line.text}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="file-preview-code">{diff}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <GitHistory workspaceId={workspaceId} token={token} worktreePath={worktreePath} />
      )}
    </div>
  );
}
