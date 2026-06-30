import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  GitCommit,
  FileCode,
  FilePlus,
  FileMinus,
  FileX,
  X,
  Loader2,
  Plus,
  Minus,
  RotateCcw
} from 'lucide-react';

// ─── File Explorer ────────────────────────────────────────────────────────────

interface FsItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface TreeNode extends FsItem {
  children?: TreeNode[];
  expanded?: boolean;
  loaded?: boolean;
}

interface ExplorerProps {
  rootPath: string;
  token: string;
  onFileClick?: (path: string, name: string) => void;
  changedFiles?: GitFileStatus[];
  onRefresh?: () => void;
  refreshTrigger?: number;
}

async function fetchExplore(dirPath: string, token: string): Promise<FsItem[]> {
  const res = await fetch(`/api/fs/explore?path=${encodeURIComponent(dirPath)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch directory');
  const data = await res.json();
  return data.contents as FsItem[];
}

async function fetchFileContent(filePath: string, token: string): Promise<string> {
  const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to read file');
  const data = await res.json();
  return data.content as string;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const iconMap: Record<string, { color: string }> = {
    ts: { color: '#3b82f6' },
    tsx: { color: '#06b6d4' },
    js: { color: '#eab308' },
    jsx: { color: '#f97316' },
    json: { color: '#a3e635' },
    md: { color: '#a78bfa' },
    css: { color: '#ec4899' },
    html: { color: '#f87171' },
    yml: { color: '#fb923c' },
    yaml: { color: '#fb923c' },
    sh: { color: '#34d399' },
    py: { color: '#60a5fa' },
    env: { color: '#facc15' },
    gitignore: { color: '#f97316' }
  };
  return iconMap[ext] ?? { color: 'var(--text-muted)' };
}

function getRelativePath(rootPath: string, itemPath: string): string {
  const normRoot = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
  const normItem = itemPath.replace(/\\/g, '/');
  
  if (normItem.startsWith(normRoot)) {
    return normItem.slice(normRoot.length).replace(/^\//, '');
  }
  return normItem;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  modified: {
    label: 'M',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.2)'
  },
  added: {
    label: 'A',
    color: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.1)',
    border: '1px solid rgba(74, 222, 128, 0.2)'
  },
  untracked: {
    label: 'U',
    color: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.1)',
    border: '1px solid rgba(74, 222, 128, 0.2)'
  },
  deleted: {
    label: 'D',
    color: '#f87171',
    bg: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid rgba(248, 113, 113, 0.2)'
  },
  renamed: {
    label: 'R',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.1)',
    border: '1px solid rgba(167, 139, 250, 0.2)'
  }
};

function TreeNodeItem({
  node,
  depth,
  token,
  onFileClick,
  rootPath,
  changedFiles = [],
  refreshTrigger = 0
}: {
  node: TreeNode;
  depth: number;
  token: string;
  onFileClick: (path: string, name: string) => void;
  rootPath: string;
  changedFiles?: GitFileStatus[];
  refreshTrigger?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  const lastTriggerRef = useRef(refreshTrigger);

  useEffect(() => {
    if (expanded && refreshTrigger !== lastTriggerRef.current) {
      lastTriggerRef.current = refreshTrigger;
      const reloadChildren = async () => {
        try {
          const items = await fetchExplore(node.path, token);
          setChildren(items.map(i => ({ ...i })));
        } catch {
          // ignore
        }
      };
      reloadChildren();
    }
  }, [refreshTrigger, expanded, node.path, token]);

  const toggle = useCallback(async () => {
    if (!node.isDirectory) {
      onFileClick(node.path, node.name);
      return;
    }
    if (!expanded && children.length === 0) {
      setLoading(true);
      try {
        const items = await fetchExplore(node.path, token);
        setChildren(items.map(i => ({ ...i })));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    setExpanded(prev => !prev);
  }, [expanded, children.length, node, token, onFileClick]);

  const iconColor = !node.isDirectory ? getFileIcon(node.name).color : undefined;
  const indent = depth * 14;

  const relPath = getRelativePath(rootPath, node.path).toLowerCase();
  
  const fileGitStatus = !node.isDirectory 
    ? changedFiles.find(f => f.path.replace(/\\/g, '/').toLowerCase() === relPath)
    : null;

  const dirChangesCount = node.isDirectory
    ? changedFiles.filter(f => {
        const fPath = f.path.replace(/\\/g, '/').toLowerCase();
        return fPath.startsWith(relPath + '/');
      }).length
    : 0;

  return (
    <div>
      <button
        className="explorer-item"
        style={{ paddingLeft: `${8 + indent}px` }}
        onClick={toggle}
        title={node.path}
      >
        <span className="explorer-item-arrow">
          {node.isDirectory
            ? loading
              ? <Loader2 size={12} className="animate-spin" />
              : expanded
              ? <ChevronDown size={12} />
              : <ChevronRight size={12} />
            : null}
        </span>
        {node.isDirectory ? (
          expanded
            ? <FolderOpen size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
            : <Folder size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
        ) : (
          <File size={14} style={{ color: iconColor, flexShrink: 0 }} />
        )}
        <span className="explorer-item-name">{node.name}</span>

        {!node.isDirectory && fileGitStatus && statusConfig[fileGitStatus.status] && (
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1,
              color: statusConfig[fileGitStatus.status].color,
              background: statusConfig[fileGitStatus.status].bg,
              border: statusConfig[fileGitStatus.status].border,
              flexShrink: 0
            }}
          >
            {statusConfig[fileGitStatus.status].label}
          </span>
        )}

        {node.isDirectory && dirChangesCount > 0 && (
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '14px',
              height: '14px',
              lineHeight: 1,
              color: '#fbbf24',
              background: 'rgba(251, 191, 36, 0.15)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              flexShrink: 0
            }}
            title={`${dirChangesCount} changed file(s) inside`}
          >
            {dirChangesCount}
          </span>
        )}
      </button>
      {expanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              token={token}
              onFileClick={onFileClick}
              rootPath={rootPath}
              changedFiles={changedFiles}
              refreshTrigger={refreshTrigger}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorer({
  rootPath,
  token,
  onFileClick,
  changedFiles = [],
  onRefresh,
  refreshTrigger = 0
}: ExplorerProps) {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ path: string; name: string; content: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [localTrigger, setLocalTrigger] = useState(0);

  // Keep onRefresh in a ref so it never causes load() to be recreated.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchExplore(rootPath, token);
      setRoots(items.map(i => ({ ...i })));
      setLocalTrigger(prev => prev + 1);
      if (onRefreshRef.current) onRefreshRef.current();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [rootPath, token]); // onRefresh intentionally excluded — accessed via ref

  // Load once on mount or when rootPath/token changes.
  useEffect(() => { load(); }, [load]);

  // Reload when an external refresh trigger fires (e.g. after a git action).
  const prevRefreshTrigger = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger > 0 && refreshTrigger !== prevRefreshTrigger.current) {
      prevRefreshTrigger.current = refreshTrigger;
      load();
    }
  }, [refreshTrigger, load]);

  const combinedTrigger = refreshTrigger + localTrigger;


  const handleFileClick = useCallback(async (path: string, name: string) => {
    if (onFileClick) {
      onFileClick(path, name);
      return;
    }
    setPreviewLoading(true);
    setPreview(null);
    try {
      const content = await fetchFileContent(path, token);
      setPreview({ path, name, content });
    } catch {
      setPreview({ path, name, content: '(Unable to read file)' });
    } finally {
      setPreviewLoading(false);
    }
  }, [token, onFileClick]);

  return (
    <div className="panel-container">
      <div className="panel-split">
        {/* Tree panel */}
        <div className="explorer-tree">
          <div className="panel-section-header">
            <span className="panel-section-title">EXPLORER</span>
            <button
              className="action-btn"
              onClick={load}
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="explorer-scroll">
            {loading && roots.length === 0 ? (
              <div className="panel-loading">
                <Loader2 size={16} className="animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              roots.map(node => (
                <TreeNodeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  token={token}
                  onFileClick={handleFileClick}
                  rootPath={rootPath}
                  changedFiles={changedFiles}
                  refreshTrigger={combinedTrigger}
                />
              ))
            )}
          </div>
        </div>

        {/* Preview panel */}
        {(preview || previewLoading) && (
          <div className="file-preview">
            <div className="panel-section-header">
              <div className="flex items-center gap-2 truncate">
                <FileCode size={13} style={{ color: preview ? getFileIcon(preview.name).color : 'var(--text-muted)', flexShrink: 0 }} />
                <span className="panel-section-title truncate">{preview?.name ?? '...'}</span>
              </div>
              <button className="action-btn" onClick={() => setPreview(null)} title="Close preview">
                <X size={13} />
              </button>
            </div>
            <div className="file-preview-content">
              {previewLoading ? (
                <div className="panel-loading">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Reading file...</span>
                </div>
              ) : (
                <pre className="file-preview-code">{preview?.content}</pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Git Changed Files ────────────────────────────────────────────────────────

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
  worktreePath
}: GitChangesProps) {
  const [selectedFile, setSelectedFile] = useState<GitFileStatus | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);
  
  const [commitMessage, setCommitMessage] = useState('');
  const [stageAllBeforeCommit, setStageAllBeforeCommit] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleFileSelect = useCallback(async (file: GitFileStatus) => {
    setSelectedFile(file);
    setDiff('');
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
  }, [workspaceId, token, worktreePath]);

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
    </div>
  );
}
