import { useState, useCallback, useEffect } from 'react';
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
  Loader2
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
    label: 'modif',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.2)'
  },
  added: {
    label: 'baru',
    color: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.1)',
    border: '1px solid rgba(74, 222, 128, 0.2)'
  },
  untracked: {
    label: 'baru',
    color: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.1)',
    border: '1px solid rgba(74, 222, 128, 0.2)'
  },
  deleted: {
    label: 'hapus',
    color: '#f87171',
    bg: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid rgba(248, 113, 113, 0.2)'
  },
  renamed: {
    label: 'rename',
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
  changedFiles = []
}: {
  node: TreeNode;
  depth: number;
  token: string;
  onFileClick: (path: string, name: string) => void;
  rootPath: string;
  changedFiles?: GitFileStatus[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);

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
              textTransform: 'lowercase',
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
  onRefresh
}: ExplorerProps) {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ path: string; name: string; content: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchExplore(rootPath, token);
      setRoots(items.map(i => ({ ...i })));
      if (onRefresh) onRefresh();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [rootPath, token, onRefresh]);

  useEffect(() => { load(); }, [load]);

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
}

interface GitChangesProps {
  workspaceId: string;
  token: string;
  files: GitFileStatus[];
  loading: boolean;
  onRefresh: () => void;
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
  onRefresh
}: GitChangesProps) {
  const [selectedFile, setSelectedFile] = useState<GitFileStatus | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);

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
      const res = await fetch(
        `/api/workspaces/${workspaceId}/git/diff?filePath=${encodeURIComponent(file.path)}`,
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
  }, [workspaceId, token]);

  const parsed = diff ? parseDiff(diff) : null;

  return (
    <div className="panel-container">
      <div className="panel-split">
        {/* Changed files list */}
        <div className="explorer-tree">
          <div className="panel-section-header">
            <span className="panel-section-title">
              CHANGES
              {files.length > 0 && (
                <span className="changes-badge">{files.length}</span>
              )}
            </span>
            <button
              className="action-btn"
              onClick={onRefresh}
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
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
              files.map(file => {
                const { label, color } = STATUS_LABEL[file.status];
                const isActive = selectedFile?.path === file.path;
                const fileName = file.path.split(/[/\\]/).pop() ?? file.path;
                const dirName = file.path.split(/[/\\]/).slice(0, -1).join('/');
                return (
                  <button
                    key={file.path}
                    className={`explorer-item ${isActive ? 'explorer-item-active' : ''}`}
                    style={{ paddingLeft: '8px' }}
                    onClick={() => handleFileSelect(file)}
                    title={file.path}
                  >
                    <StatusIcon status={file.status} />
                    <span className="flex-1 min-w-0 text-left">
                      <span className="explorer-item-name">{fileName}</span>
                      {dirName && (
                        <span className="explorer-item-dir">{dirName}</span>
                      )}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color, flexShrink: 0, width: '12px', textAlign: 'center' }}>
                      {label}
                    </span>
                  </button>
                );
              })
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
